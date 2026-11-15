import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { getOrCreateConversation } from '../../lib/chat';
import { matchRequest, nextShifts } from '../../features/matching/index.js';
import { Alert, Badge, Button, ConfirmDialog, useToast } from '../../components/ui/index.js';
import { formatDayTime, formatDistance, formatLongDate, formatShiftRange } from '../../components/format.js';
import { REQUEST_SELECT, usePrefs } from './data.js';
import {
  ArrowLeft, CalendarDays, CalendarCheck, Check, CircleCheck, Dumbbell, GraduationCap, MapPin, MessageCircle, Navigation,
} from 'lucide-react';
import { LABELS, Loading, SIGNUP_STATUS } from './ui.jsx';

const SIGN_UP_HELP = "Tell the charity you'd like to come. They'll confirm by message.";
const CANCEL_HELP = "Let the charity know you can't come. You can sign up again later.";
const LONG_DESCRIPTION = 240;

function Fact({ icon: I, children }) {
  return (
    <li>
      <I size={22} strokeWidth={1.75} aria-hidden="true" />
      <div className="v-fact-body">{children}</div>
    </li>
  );
}

function mapsUrl(request) {
  const q = request.lat != null && request.lng != null ? `${request.lat},${request.lng}` : request.address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { prefs } = usePrefs(user?.id);
  const toast = useToast();
  const [request, setRequest] = useState(undefined);
  const [mySignups, setMySignups] = useState([]);
  const [shift, setShift] = useState('');
  const [busy, setBusy] = useState(null); // 'signup' | 'chat' | 'cancel'
  const [error, setError] = useState(null);
  const [justSignedUp, setJustSignedUp] = useState(null); // ISO shift time signed up for on this visit
  const [cancelling, setCancelling] = useState(null); // signup row to cancel (dialog open)
  const [readMore, setReadMore] = useState(false);
  const successRef = useRef(null);
  const closeCancel = useCallback(() => setCancelling(null), []);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('requests').select(REQUEST_SELECT).eq('id', id).maybeSingle();
    if (err) setError(err.message);
    setRequest(data ?? null);
    if (user) {
      const { data: s } = await supabase.from('signups').select('*').eq('request_id', id).eq('volunteer_id', user.id);
      setMySignups(s ?? []);
    }
  }, [id, user]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (justSignedUp) successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [justSignedUp]);

  const shifts = useMemo(() => (request ? nextShifts(request, new Date(), 6) : []), [request]);
  const match = useMemo(() => (request ? matchRequest(prefs, request) : null), [prefs, request]);
  const activeSignups = mySignups.filter((s) => ['applied', 'accepted'].includes(s.status));
  const activeShiftTimes = new Set(activeSignups.map((s) => new Date(s.shift_at).getTime()));
  const freeShifts = shifts.filter((d) => !activeShiftTimes.has(d.getTime()));

  // Selected shift: the user's pick if still free, else the matched shift, else the next free one.
  const preferred = match?.shiftAt && freeShifts.find((d) => d.getTime() === match.shiftAt.getTime());
  const selected = freeShifts.some((d) => d.toISOString() === shift) ? shift
    : (preferred ?? freeShifts[0])?.toISOString() ?? '';

  if (request === undefined) return <div className="v-page"><Loading /></div>;
  if (!request) {
    return (
      <div className="v-page">
        <h1>Shift not found</h1>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button to="/user" variant="secondary" icon={<ArrowLeft size={20} aria-hidden="true" />}>Back to all shifts</Button>
      </div>
    );
  }

  let blockReason = null;
  if (!user) blockReason = 'Sign in to sign up.';
  else if (profile && profile.role !== 'volunteer') blockReason = 'Only volunteer accounts can sign up.';
  else if (profile?.suspended) blockReason = "You can't sign up after 3 missed shifts.";
  else if (request.status !== 'open') blockReason = request.status === 'filled' ? 'This shift has enough volunteers.' : 'This shift has been cancelled.';
  else if (!freeShifts.length) blockReason = shifts.length ? "You're signed up for every date." : 'There are no dates coming up.';

  const signUp = async () => {
    if (!selected) return;
    setBusy('signup'); setError(null);
    const { error: err } = await supabase.from('signups').insert({
      request_id: request.id, volunteer_id: user.id, shift_at: selected,
    });
    setBusy(null);
    if (err) {
      setError(err.code === '23505' ? "You're already signed up for this date." : `Could not sign up: ${err.message}`);
      return;
    }
    setJustSignedUp(selected);
    toast("You're signed up.", 'success');
    load();
  };

  const cancelPlace = async () => {
    const s = cancelling;
    if (!s) return;
    setBusy('cancel'); setError(null);
    const { error: err } = await supabase.from('signups').update({ status: 'cancelled' }).eq('id', s.id);
    setBusy(null);
    setCancelling(null);
    if (err) { setError(`Could not cancel: ${err.message}`); return; }
    if (justSignedUp && new Date(justSignedUp).getTime() === new Date(s.shift_at).getTime()) setJustSignedUp(null);
    toast('Your place is cancelled.', 'success');
    load();
  };

  const message = async () => {
    setBusy('chat'); setError(null);
    try {
      const convId = await getOrCreateConversation({ requestId: request.id, charityId: request.charity_id, volunteerId: user.id });
      navigate(`/chat/${convId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const justSignup = justSignedUp
    && activeSignups.find((s) => new Date(s.shift_at).getTime() === new Date(justSignedUp).getTime());
  const otherSignups = mySignups.filter((s) => s !== justSignup);
  const first = selected ? new Date(selected) : shifts[0];
  const description = request.description?.trim() ?? '';
  const longDescription = description.length > LONG_DESCRIPTION || description.split('\n').length > 3;
  const recurring = request.schedule_type === 'recurring' && request.recurrence;

  return (
    <div className="v-page">
      <Link to="/user" className="back-link"><ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />Back to all shifts</Link>

      <header className="v-detail-head">
        <h1>{request.title}</h1>
        <p className="v-detail-org">
          {request.charities?.org_name ?? 'Charity'}
          {request.charities?.verified_at && (
            <span className="v-verified"><Check size={18} strokeWidth={2.5} aria-hidden="true" />Checked charity</span>
          )}
        </p>
      </header>

      {description && (
        <div className="v-description">
          <p className={longDescription && !readMore ? 'v-clamp' : undefined}>{description}</p>
          {longDescription && (
            <Button variant="secondary" onClick={() => setReadMore((v) => !v)} aria-expanded={readMore}>
              {readMore ? 'Show less' : 'Read more'}
            </Button>
          )}
        </div>
      )}

      {justSignedUp && (
        <section className="v-success" ref={successRef} role="status">
          <h2><CircleCheck size={26} strokeWidth={2} aria-hidden="true" />You're signed up</h2>
          <p>{formatShiftRange(justSignedUp, request.duration_hours)}. The charity will confirm by message.</p>
          <Button to="/user/shifts" size="lg" block icon={<CalendarCheck size={22} aria-hidden="true" />}>Go to My shifts</Button>
          {justSignup && (
            <Button variant="secondary" block help={CANCEL_HELP} onClick={() => setCancelling(justSignup)}>
              Cancel my place
            </Button>
          )}
        </section>
      )}

      <section className="v-card">
        <ul className="v-facts">
          <Fact icon={CalendarDays}>
            <span>{first ? formatShiftRange(first, request.duration_hours) : 'No dates coming up'}</span>
            {recurring && (
              <span className="v-fact-sub">
                {LABELS.recurrence[request.recurrence]}
                {request.ends_on ? ` until ${formatLongDate(request.ends_on)}` : ''}
              </span>
            )}
          </Fact>
          {request.address && (
            <Fact icon={MapPin}>
              <span>
                {request.address}
                {match?.distanceKm != null && ` (${formatDistance(match.distanceKm, prefs?.transport)})`}
              </span>
              <Button href={mapsUrl(request)} target="_blank" rel="noopener noreferrer" variant="secondary"
                icon={<Navigation size={20} aria-hidden="true" />} hint="Open the address in your maps app.">
                Open in Maps
              </Button>
            </Fact>
          )}
          {request.physical_level && <Fact icon={Dumbbell}><span>{LABELS.physical[request.physical_level]}</span></Fact>}
          <Fact icon={GraduationCap}>
            <span>
              {LABELS.experience[request.experience ?? 'none']}
              {request.experience_notes ? `: ${request.experience_notes}` : ''}
            </span>
          </Fact>
        </ul>
      </section>

      {otherSignups.length > 0 && (
        <section className="v-card">
          <h2>Your places</h2>
          <ul className="v-places">
            {otherSignups.map((s) => {
              const st = SIGNUP_STATUS[s.status] ?? { label: s.status, tone: 'neutral' };
              const active = ['applied', 'accepted'].includes(s.status);
              return (
                <li key={s.id}>
                  <span className="v-place-when">{formatDayTime(s.shift_at)}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {active && (
                    <Button variant="secondary" hint={CANCEL_HELP} onClick={() => setCancelling(s)}>Cancel my place</Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!justSignedUp && freeShifts.length > 1 && !blockReason && (
        <fieldset className="v-card v-choices">
          <legend>Choose a date</legend>
          {freeShifts.map((d) => {
            const iso = d.toISOString();
            return (
              <label key={iso} className="v-choice">
                <input type="radio" name="v-shift" value={iso} checked={selected === iso} onChange={() => setShift(iso)} />
                <span>{formatShiftRange(d, request.duration_hours)}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      {user && (
        <Button variant="secondary" block loading={busy === 'chat'} onClick={message}
          icon={<MessageCircle size={20} aria-hidden="true" />} hint="Open a private chat with the charity.">
          {busy === 'chat' ? 'Opening…' : 'Ask the charity a question'}
        </Button>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {!justSignedUp && (
        <div className="v-action-bar">
          <Button size="lg" block onClick={signUp} loading={busy === 'signup'}
            disabled={!!blockReason || !selected} hint={blockReason ?? undefined}
            help={blockReason ?? SIGN_UP_HELP}>
            {busy === 'signup' ? 'Signing you up…' : selected && !blockReason ? `Sign up for ${formatDayTime(selected).replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase())}` : 'Sign up to help'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel your place?"
        confirmLabel="Yes, cancel my place"
        cancelLabel="No, keep it"
        tone="danger"
        busy={busy === 'cancel'}
        onConfirm={cancelPlace}
        onCancel={closeCancel}
      >
        {cancelling && `${request.title}, ${formatDayTime(cancelling.shift_at)}`}
      </ConfirmDialog>
    </div>
  );
}
