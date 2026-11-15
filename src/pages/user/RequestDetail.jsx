import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { getOrCreateConversation } from '../../lib/chat';
import { formatKm, matchRequest, nextShifts } from '../../features/matching/index.js';
import { REQUEST_SELECT, usePrefs } from './data.js';
import {
  ArrowLeft, BadgeCheck, CalendarDays, Dumbbell, ExternalLink, GraduationCap, Hourglass, Lock, MapPin, Tag, Users,
} from 'lucide-react';
import { Chips, LABELS, Loading, capital, formatHours, formatWhen } from './ui.jsx';
import { displayWebsite, safeWebsite } from '../../lib/website.js';

function Fact({ icon: I, label, children }) {
  return (
    <li>
      <I size={18} strokeWidth={1.75} aria-hidden="true" />
      <span className="v-fact-body">
        <span className="v-fact-label">{label}</span>
        <span className="v-fact-value">{children}</span>
      </span>
    </li>
  );
}

const STATUS_TONE = { applied: 'v-chip-no', accepted: '', attended: '', declined: 'v-chip-plain', cancelled: 'v-chip-plain', no_show: 'v-chip-danger' };
const STATUS_LABEL = { applied: 'Applied', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', attended: 'Attended', no_show: 'No-show' };

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { prefs } = usePrefs(user?.id);
  const [request, setRequest] = useState(undefined);
  const [mySignups, setMySignups] = useState([]);
  const [shift, setShift] = useState('');
  const [busy, setBusy] = useState(null); // 'signup' | 'chat' | 'verify'
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

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

  const shifts = useMemo(() => (request ? nextShifts(request, new Date(), 6) : []), [request]);
  const match = useMemo(() => (request ? matchRequest(prefs, request) : null), [prefs, request]);
  const activeShiftTimes = new Set(mySignups
    .filter((s) => ['applied', 'accepted'].includes(s.status))
    .map((s) => new Date(s.shift_at).getTime()));
  const freeShifts = shifts.filter((d) => !activeShiftTimes.has(d.getTime()));

  // Selected shift: the user's pick if still free, else the matched shift, else the next free one.
  const preferred = match?.shiftAt && freeShifts.find((d) => d.getTime() === match.shiftAt.getTime());
  const selected = freeShifts.some((d) => d.toISOString() === shift) ? shift
    : (preferred ?? freeShifts[0])?.toISOString() ?? '';

  if (request === undefined) return <div className="v-page"><Loading /></div>;
  if (!request) {
    return (
      <div className="v-page">
        <h1>Not found</h1>
        {error && <p className="v-error">{error}</p>}
        <Link to="/user" className="v-btn v-btn-secondary"><ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />Back to requests</Link>
      </div>
    );
  }

  let blockReason = null;
  if (!user) blockReason = 'Sign in to sign up';
  else if (profile && profile.role !== 'volunteer') blockReason = 'Only volunteer accounts can sign up';
  else if (profile?.suspended) blockReason = 'Your account is suspended after 3 no-shows';
  else if (request.status !== 'open') blockReason = request.status === 'filled' ? 'This request is filled' : 'This request is closed';
  else if (!freeShifts.length) blockReason = shifts.length ? 'You are signed up for every upcoming shift' : 'No upcoming shifts';

  const signUp = async () => {
    if (!selected) return;
    setBusy('signup'); setError(null); setNotice(null);
    const { error: err } = await supabase.from('signups').insert({
      request_id: request.id, volunteer_id: user.id, shift_at: selected,
    });
    setBusy(null);
    if (err) {
      setError(err.code === '23505' ? 'You already signed up for this shift' : `Could not sign up: ${err.message}`);
      return;
    }
    setNotice(`Signed up for ${formatWhen(selected)}. The charity will confirm.`);
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

  const verify = async () => {
    setBusy('verify'); setError(null);
    const { error: err } = await supabase.rpc('demo_verify_volunteer');
    if (err) setError(`Could not verify: ${err.message}`);
    else await refreshProfile();
    setBusy(null);
  };

  return (
    <div className="v-page">
      <Link to="/user" className="back-link"><ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />All requests</Link>
      <div className="v-field" style={{ gap: 6 }}>
        <h1>{request.title}</h1>
        <span className="v-card-org" style={{ fontSize: '0.95rem' }}>
          {request.charities?.org_name ?? 'Charity'}
          {request.charities?.verified_at && (
            <span className="v-chip v-chip-accent"><BadgeCheck size={14} strokeWidth={2} aria-hidden="true" />Verified charity</span>
          )}
        </span>
      </div>

      {match && <Chips yes={match.reasons} no={match.blockers} />}

      <section className="v-card" style={{ gap: 4 }}>
        <ul className="v-facts">
          <Fact icon={CalendarDays} label="When">
            {shifts[0] ? formatWhen(shifts[0]) : 'No upcoming shifts'}
            {request.schedule_type === 'recurring' && request.recurrence ? ` · ${LABELS.recurrence[request.recurrence]}` : ''}
            {request.ends_on ? ` until ${request.ends_on}` : ''}
          </Fact>
          <Fact icon={Hourglass} label="Duration">{formatHours(request.duration_hours)}</Fact>
          {request.address && (
            <Fact icon={MapPin} label="Where">
              {request.address}
              {match?.distanceKm != null && <span className="v-mono"> · {formatKm(match.distanceKm)}</span>}
            </Fact>
          )}
          <Fact icon={Dumbbell} label="Physical">{LABELS.physical[request.physical_level]}</Fact>
          <Fact icon={GraduationCap} label="Experience">
            {LABELS.experience[request.experience]}{request.experience_notes ? ` · ${request.experience_notes}` : ''}
          </Fact>
          <Fact icon={Users} label="Volunteers">{request.slots}</Fact>
          {request.category && <Fact icon={Tag} label="Category">{capital(request.category)}</Fact>}
        </ul>
        {request.description && (
          <p style={{ margin: '8px 0 0', paddingTop: 12, borderTop: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>
            {request.description}
          </p>
        )}
      </section>

      {(request.charities?.description || safeWebsite(request.charities?.website)) && (
        <section className="v-card" style={{ gap: 8 }}>
          <h2>About {request.charities.org_name}</h2>
          {request.charities.description && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{request.charities.description}</p>}
          {safeWebsite(request.charities.website) && (
            <a
              href={safeWebsite(request.charities.website)}
              target="_blank"
              rel="noopener noreferrer nofollow"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflowWrap: 'anywhere' }}
            >
              <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
              {displayWebsite(safeWebsite(request.charities.website))}
            </a>
          )}
        </section>
      )}

      {mySignups.length > 0 && (
        <section className="v-card">
          <h2>Your signups</h2>
          {mySignups.map((s) => (
            <div key={s.id} className="v-between v-small">
              <span className="v-mono" style={{ color: 'var(--text)' }}>{formatWhen(s.shift_at)}</span>
              <span className={`v-chip ${STATUS_TONE[s.status] ?? 'v-chip-plain'}`}>{STATUS_LABEL[s.status]}</span>
            </div>
          ))}
        </section>
      )}

      <section className="v-card">
        {freeShifts.length > 1 && (
          <div className="v-field">
            <label className="v-label" htmlFor="v-shift">Shift</label>
            <select id="v-shift" className="v-select" value={selected} onChange={(e) => setShift(e.target.value)}>
              {freeShifts.map((d) => <option key={d.toISOString()} value={d.toISOString()}>{formatWhen(d)}</option>)}
            </select>
          </div>
        )}
        <button type="button" className="v-btn v-btn-block" onClick={signUp} disabled={!!blockReason || busy === 'signup' || !selected}>
          {busy === 'signup' ? 'Signing up…' : 'Sign up'}
        </button>
        {blockReason && <span className="v-muted v-small">{blockReason}</span>}
        {notice && <span className="v-notice v-notice-ok">{notice}</span>}
        {user && (
          <button type="button" className="v-btn v-btn-secondary v-btn-block" onClick={message} disabled={busy === 'chat'}>
            {busy === 'chat' ? 'Opening chat…' : <><Lock size={16} strokeWidth={2} aria-hidden="true" />Message charity</>}
          </button>
        )}
        {profile && profile.role === 'volunteer' && !profile.verified && (
          <button type="button" className="v-btn v-btn-secondary v-btn-block" onClick={verify} disabled={busy === 'verify'}>
            {busy === 'verify' ? 'Verifying…' : 'Verify me'}
          </button>
        )}
        {error && <p className="v-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
