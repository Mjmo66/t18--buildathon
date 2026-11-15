import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, MessageCircle, UserX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, ConfirmDialog, useToast } from '../../components/ui/index.js';
import { formatDayTime, formatDuration } from '../../components/format.js';
import '../../pages/charity/charity.css';

const ORDER = { applied: 0, accepted: 1, attended: 2, no_show: 3, declined: 4, cancelled: 5 };

const SELECT =
  'id, request_id, volunteer_id, shift_at, status, hours_credited, marked_at, created_at, ' +
  'volunteer:profiles(display_name, verified, warnings_count, suspended)';

/** One-time shift that ended more than 24 h ago: unmarked accepted signups become no-shows. */
function sweepDue(request) {
  if (!request || request.schedule_type !== 'one_time' || !request.starts_at) return false;
  const end = new Date(request.starts_at).getTime() + Number(request.duration_hours || 0) * 3600e3;
  return end + 24 * 3600e3 < Date.now();
}

/** Has this signup's shift started? ("Came" / "Didn't come" only from the start time.) */
function hasStarted(s, request) {
  const at = s.shift_at ?? request.starts_at;
  return at ? new Date(at).getTime() <= Date.now() : false;
}

/** One plain sentence about where this volunteer stands. */
function statusSentence(s, started) {
  switch (s.status) {
    case 'applied': return 'Wants to help. Waiting for your reply.';
    case 'accepted': return started ? 'Confirmed. Did they come?' : `Confirmed. Coming ${s.shift_at ? formatDayTime(s.shift_at) : 'soon'}.`;
    case 'attended': return s.hours_credited != null ? `Came. ${formatDuration(s.hours_credited)} recorded.` : 'Came.';
    case 'no_show': return 'Did not come.';
    case 'declined': return 'You said no.';
    case 'cancelled': return 'Cancelled their place.';
    default: return '';
  }
}

/** Charity: the one "Volunteers" list for a request. Each row shows the name, a plain status sentence and
 *  only the actions valid now: Accept / Say no while waiting, Message always, Came / Didn't come from the
 *  shift start. Calls onChange() after any change so the parent can reload.
 *  onMessage(volunteerId) opens a chat; messagingId is the volunteer whose chat is opening. */
export function AttendancePanel({ request, onChange, onMessage, messagingId = null }) {
  const requestId = request?.id;
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);       // signup id being changed
  const [confirmId, setConfirmId] = useState(null);
  const signupsRef = useRef([]);
  const ownChanges = useRef(new Set());          // ids we changed ourselves (skip "checked in" note)
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const sweptFor = useRef(null);
  const closeConfirm = useCallback(() => setConfirmId(null), []);

  const load = useCallback(async () => {
    if (!requestId) return;
    const { data, error: err } = await supabase.from('signups').select(SELECT)
      .eq('request_id', requestId).order('shift_at').order('created_at');
    if (err) setError(err.message);
    else {
      const rows = (data ?? []).slice().sort((a, b) => ORDER[a.status] - ORDER[b.status]);
      signupsRef.current = rows;
      setSignups(rows);
      setError('');
    }
    setLoading(false);
  }, [requestId]);

  // Initial load; once per request, sweep past one-time shifts for no-shows.
  useEffect(() => {
    setLoading(true);
    (async () => {
      if (sweepDue(request) && sweptFor.current !== requestId) {
        sweptFor.current = requestId;
        const { data: n } = await supabase.rpc('sweep_no_shows', { p_request: requestId });
        if (n > 0) {
          toastRef.current(
            `${n} ${n === 1 ? 'volunteer' : 'volunteers'} marked as did not come (no check-in within a day of the shift).`,
            'info',
          );
          onChangeRef.current?.();
        }
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, load]);

  // Live updates: a volunteer checking in by QR flips their signup to 'attended'.
  useEffect(() => {
    if (!requestId) return undefined;
    const channel = supabase
      .channel(`attendance:${requestId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'signups', filter: `request_id=eq.${requestId}` },
        (payload) => {
          const row = payload.new;
          const before = signupsRef.current.find((s) => s.id === row?.id);
          if (row?.status === 'attended' && before && before.status !== 'attended'
              && !ownChanges.current.has(row.id)) {
            toastRef.current(`${before.volunteer?.display_name ?? 'A volunteer'} has checked in.`, 'success');
          }
          load();
          onChangeRef.current?.();
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId, load]);

  async function run(id, fn, done, own = false) {
    setBusy(id);
    setError('');
    if (own) {
      ownChanges.current.add(id);
      setTimeout(() => ownChanges.current.delete(id), 15000);
    }
    const { error: err } = await fn();
    setBusy(null);
    setConfirmId(null);
    if (err) { setError(err.message); return; }
    if (done) toast(done, 'success');
    await load();
    onChangeRef.current?.();
  }

  const nameOf = (s) => s?.volunteer?.display_name ?? 'Volunteer';
  const setStatus = (s, status, done) =>
    run(s.id, () => supabase.from('signups').update({ status }).eq('id', s.id), done);
  const mark = (s, attended, done) =>
    run(s.id, () => supabase.rpc('mark_attendance', { p_signup: s.id, p_attended: attended }), done, true);

  if (!requestId) return null;

  const taken = signups.filter((s) => ['accepted', 'attended'].includes(s.status)).length;
  const recurring = request.schedule_type === 'recurring';
  const confirming = signups.find((s) => s.id === confirmId);

  return (
    <section className="ch-att" aria-labelledby={`att-h-${requestId}`}>
      <div className="ch-att-head">
        <h2 id={`att-h-${requestId}`}>Volunteers</h2>
        <span className="ch-att-places">{taken} of {request.slots ?? '–'} places filled</span>
      </div>

      {error && <p className="ch-error" role="alert">{error}</p>}
      {loading && <p className="ch-muted" role="status">Loading…</p>}
      {!loading && signups.length === 0 && <p className="ch-att-empty">No one has signed up yet.</p>}

      {signups.length > 0 && (
        <ul className="ch-att-list">
          {signups.map((s) => {
            const name = nameOf(s);
            const warns = s.volunteer?.warnings_count ?? 0;
            const started = hasStarted(s, request);
            const isBusy = busy === s.id;
            return (
              <li key={s.id} className={`ch-att-row ch-att-row-${s.status}`}>
                <div className="ch-att-main">
                  <strong className="ch-att-name">{name}</strong>
                  <span className="ch-att-status">{statusSentence(s, started)}</span>
                  {recurring && s.shift_at && s.status !== 'accepted' && (
                    <span className="ch-muted">Shift: {formatDayTime(s.shift_at)}</span>
                  )}
                  {warns > 0 && (
                    <span className="ch-att-warn">{warns} {warns === 1 ? 'warning' : 'warnings'} for not coming</span>
                  )}
                </div>

                <div className="ch-att-actions">
                  {s.status === 'applied' && (
                    <>
                      <Button
                        variant="primary"
                        icon={<Check size={20} aria-hidden="true" />}
                        loading={isBusy}
                        disabled={isBusy}
                        hint={`Tell ${name} they can come.`}
                        onClick={() => setStatus(s, 'accepted', `${name} is confirmed.`)}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={isBusy}
                        hint={`Let ${name} know you don't need them this time.`}
                        onClick={() => setStatus(s, 'declined', `You said no to ${name}.`)}
                      >
                        Say no
                      </Button>
                    </>
                  )}
                  {s.status === 'accepted' && started && (
                    <>
                      <Button
                        variant="success"
                        icon={<Check size={20} aria-hidden="true" />}
                        loading={isBusy}
                        disabled={isBusy}
                        hint={`Record ${name}'s hours for this shift.`}
                        onClick={() => mark(s, true, `${name} came. Hours recorded.`)}
                      >
                        Came
                      </Button>
                      <Button
                        variant="secondary"
                        icon={<UserX size={20} aria-hidden="true" />}
                        disabled={isBusy}
                        hint={`Mark that ${name} did not come. They get a warning.`}
                        onClick={() => setConfirmId(s.id)}
                      >
                        Didn&rsquo;t come
                      </Button>
                    </>
                  )}
                  {onMessage && (
                    <Button
                      variant="secondary"
                      icon={<MessageCircle size={20} aria-hidden="true" />}
                      loading={messagingId === s.volunteer_id}
                      disabled={messagingId === s.volunteer_id}
                      hint={`Send ${name} a private message.`}
                      onClick={() => onMessage(s.volunteer_id)}
                    >
                      {messagingId === s.volunteer_id ? 'Opening…' : 'Message'}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={`Mark ${nameOf(confirming)} as did not come?`}
        confirmLabel="Yes, mark as did not come"
        cancelLabel="No, go back"
        tone="danger"
        busy={busy === confirmId}
        onConfirm={() => confirming && mark(confirming, false, `${nameOf(confirming)} is marked as did not come.`)}
        onCancel={closeConfirm}
      >
        This gives {nameOf(confirming)} a warning.
      </ConfirmDialog>
    </section>
  );
}
