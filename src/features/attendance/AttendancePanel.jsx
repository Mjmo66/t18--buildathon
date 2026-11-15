import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatHours, formatShift } from './shared';
import './attendance.css';

const STATUS_LABEL = {
  applied: 'Applied',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
  attended: 'Attended',
  no_show: 'No-show',
};
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

/** Charity: list of signups for one request with Accept/Decline and Attended/No-show actions.
 *  Calls onChange() after any change so the parent can reload. */
export function AttendancePanel({ request, onChange }) {
  const requestId = request?.id;
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);       // signup id being changed
  const [confirmId, setConfirmId] = useState(null);
  const [flash, setFlash] = useState('');
  const signupsRef = useRef([]);
  const ownChanges = useRef(new Set());          // ids we changed ourselves (skip "checked in" flash)
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const sweptFor = useRef(null);

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
          setFlash(`${n} marked no-show (no check-in within 24 h of the shift)`);
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
            setFlash(`${before.volunteer?.display_name ?? 'A volunteer'} checked in`);
          }
          load();
          onChangeRef.current?.();
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId, load]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(''), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  async function run(id, fn, own = false) {
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
    await load();
    onChangeRef.current?.();
  }

  const setStatus = (id, status) =>
    run(id, () => supabase.from('signups').update({ status }).eq('id', id));
  const mark = (id, attended) =>
    run(id, () => supabase.rpc('mark_attendance', { p_signup: id, p_attended: attended }), true);

  if (!requestId) return null;

  const taken = signups.filter((s) => ['accepted', 'attended'].includes(s.status)).length;
  const recurring = request.schedule_type === 'recurring';

  return (
    <div className="att-panel">
      <div className="att-panel-head">
        <h3 className="att-h">Volunteers</h3>
        <span className="att-chip">{taken} / {request.slots ?? '–'} places</span>
      </div>

      {flash && <div className="att-flash" role="status"><CircleCheck size={18} strokeWidth={2} aria-hidden="true" />{flash}</div>}
      {error && <div className="att-error" role="alert">{error}</div>}
      {loading && <div className="att-muted">Loading…</div>}
      {!loading && signups.length === 0 && <div className="att-empty">No signups yet</div>}

      <ul className="att-list">
        {signups.map((s) => {
          const name = s.volunteer?.display_name ?? 'Volunteer';
          const warns = s.volunteer?.warnings_count ?? 0;
          return (
            <li key={s.id} className={`att-row att-row-${s.status}`}>
              <div className="att-row-main">
                <div className="att-row-name">
                  {name}
                  {s.volunteer?.verified && <span className="att-chip att-chip-ok">Verified</span>}
                  {warns > 0 && (
                    <span className="att-chip att-chip-warn">{warns} warning{warns > 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="att-muted att-small">
                  <span className={`att-status att-status-${s.status}`}>{STATUS_LABEL[s.status]}</span>
                  {recurring && <> · {formatShift(s.shift_at)}</>}
                  {s.status === 'attended' && s.hours_credited != null && <> · {formatHours(s.hours_credited)}</>}
                </div>
              </div>

              <div className="att-actions">
                {s.status === 'applied' && (
                  <>
                    <button type="button" className="att-btn att-btn-primary" disabled={busy === s.id}
                            onClick={() => setStatus(s.id, 'accepted')}>Accept</button>
                    <button type="button" className="att-btn" disabled={busy === s.id}
                            onClick={() => setStatus(s.id, 'declined')}>Decline</button>
                  </>
                )}
                {s.status === 'accepted' && confirmId !== s.id && (
                  <>
                    <button type="button" className="att-btn att-btn-primary" disabled={busy === s.id}
                            onClick={() => mark(s.id, true)}>Attended</button>
                    <button type="button" className="att-btn att-btn-danger-outline" disabled={busy === s.id}
                            onClick={() => setConfirmId(s.id)}>No-show</button>
                  </>
                )}
              </div>

              {confirmId === s.id && (
                <div className="att-confirm" role="alertdialog" aria-label={`Confirm no-show for ${name}`}>
                  <div>This gives {name} a warning.</div>
                  <div className="att-actions">
                    <button type="button" className="att-btn" onClick={() => setConfirmId(null)}>Cancel</button>
                    <button type="button" className="att-btn att-btn-danger" disabled={busy === s.id}
                            onClick={() => mark(s.id, false)}>Confirm no-show</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
