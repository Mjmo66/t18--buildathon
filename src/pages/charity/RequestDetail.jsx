import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { isToday, startOfDay } from 'date-fns';
import { ArrowLeft, CalendarDays, Dumbbell, MapPin, QrCode, Repeat, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { getOrCreateConversation } from '../../lib/chat';
import { AttendancePanel, CheckinQR } from '../../features/attendance/index.jsx';
import { Button, ConfirmDialog, useToast } from '../../components/ui/index.js';
import { formatShiftRange } from '../../components/format.js';
import { CharityGate, Empty, ErrorNote, Loading, StatusPill } from './components.jsx';
import {
  EXPERIENCE_LEVELS, PHYSICAL_LEVELS, labelOf, nextShifts, scheduleSummary, volunteers,
} from './shared.js';

const ICON = { size: 22, strokeWidth: 1.75, 'aria-hidden': true };

/** One labelled fact: icon, small label, value. */
function Fact({ icon: I, label, children }) {
  return (
    <li>
      <I {...ICON} />
      <span className="ch-fact">
        <span className="ch-fact-label">{label}</span>
        <span className="ch-fact-value">{children}</span>
      </span>
    </li>
  );
}

function Detail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [request, setRequest] = useState(undefined); // undefined = loading, null = not found
  const [signups, setSignups] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showQR, setShowQR] = useState(params.get('checkin') === '1');
  const [messaging, setMessaging] = useState(null);
  const [askCancel, setAskCancel] = useState(false);
  const closeAsk = useCallback(() => setAskCancel(false), []);

  const reload = useCallback(async () => {
    setError(null);
    const [r, s] = await Promise.all([
      supabase.from('requests').select('*').eq('id', id).maybeSingle(),
      supabase.from('signups')
        .select('id, status, shift_at, volunteer_id, volunteer:profiles(display_name, verified)')
        .eq('request_id', id)
        .order('created_at', { ascending: true }),
    ]);
    if (r.error) { setError(r.error); setRequest(null); return; }
    setRequest(r.data ?? null);
    if (s.error) setError(s.error); else setSignups(s.data ?? []);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const setStatus = async (status, done) => {
    setBusy(true);
    const { error: err } = await supabase.from('requests').update({ status }).eq('id', id);
    setBusy(false);
    setAskCancel(false);
    if (err) setError(err);
    else { toast(done, 'success'); reload(); }
  };

  const message = async (volunteerId) => {
    setMessaging(volunteerId);
    try {
      const convId = await getOrCreateConversation({ requestId: id, charityId: user.id, volunteerId });
      navigate(`/chat/${convId}`);
    } catch (e) {
      setError(e);
      setMessaging(null);
    }
  };

  if (request === undefined) return <Loading />;
  if (request === null) {
    return (
      <Empty>
        <ErrorNote error={error} />
        <p>We can&rsquo;t find this request.</p>
        <Button variant="secondary" to="/charity/requests">Back to all requests</Button>
      </Empty>
    );
  }
  if (request.charity_id !== user.id) return <Empty><p>This request belongs to another charity.</p></Empty>;

  const confirmed = signups.filter((s) => ['accepted', 'attended'].includes(s.status)).length;
  const coming = signups.filter((s) => s.status === 'accepted').length;
  const upcoming = nextShifts(request, 3);
  // Shift day: a shift of this request starts today (also once it has started).
  // A confirmed signup dated today counts too, so the page agrees with Home's "Check in".
  const seriesToday = nextShifts(request, 1, startOfDay(new Date()))[0];
  const signupToday = signups.find((s) => ['accepted', 'attended'].includes(s.status) && s.shift_at && isToday(new Date(s.shift_at)));
  const todayShift = seriesToday && isToday(seriesToday) ? seriesToday : signupToday ? new Date(signupToday.shift_at) : null;
  const shiftDay = Boolean(todayShift) && request.status !== 'closed';
  const shownShift = shiftDay ? todayShift : upcoming[0];
  const recurring = request.schedule_type === 'recurring';
  const physical = PHYSICAL_LEVELS.find((o) => o.value === request.physical_level);
  const experience = EXPERIENCE_LEVELS.find((o) => o.value === request.experience);

  return (
    <section className="ch-page">
      <Link className="back-link" to="/charity/requests">
        <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />Back to all requests
      </Link>
      <header className="ch-title">
        <h1>{request.title}</h1>
        {request.status !== 'open' && <div className="ch-row"><StatusPill status={request.status} /></div>}
      </header>

      <ErrorNote error={error} />

      {showQR ? (
        <div className="ch-card ch-qr">
          <CheckinQR request={request} />
          <Button variant="secondary" block onClick={() => setShowQR(false)}>Hide check-in code</Button>
        </div>
      ) : (
        <Button
          variant={shiftDay ? 'primary' : 'secondary'}
          size={shiftDay ? 'lg' : 'md'}
          block={shiftDay}
          className="ch-checkin-btn"
          icon={<QrCode size={22} aria-hidden="true" />}
          hint="Show a code that volunteers scan when they arrive."
          onClick={() => setShowQR(true)}
        >
          Show check-in code
        </Button>
      )}

      <div className="ch-card ch-facts">
        {request.description && <p className="ch-desc">{request.description}</p>}
        <ul className="ch-fact-list">
          <Fact icon={CalendarDays} label={recurring && !shiftDay ? 'Next shift' : 'When'}>
            {shownShift ? formatShiftRange(shownShift, request.duration_hours) : 'No shifts coming up'}
          </Fact>
          {recurring && <Fact icon={Repeat} label="Repeats">{scheduleSummary(request)}</Fact>}
          <Fact icon={MapPin} label="Where">{request.address || 'No place given'}</Fact>
          <Fact icon={Users} label="Places">
            {confirmed} of {request.slots} filled
            <span className="ch-meter" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.round((confirmed / Math.max(1, request.slots)) * 100))}%` }} />
            </span>
          </Fact>
          <Fact icon={Dumbbell} label="What it involves">
            {physical?.detail ?? labelOf(PHYSICAL_LEVELS, request.physical_level)}
            {request.experience && request.experience !== 'none'
              && ` · ${experience?.label ?? labelOf(EXPERIENCE_LEVELS, request.experience)}`}
          </Fact>
        </ul>
      </div>

      <div className="ch-card">
        <AttendancePanel request={request} onChange={reload} onMessage={message} messagingId={messaging} />
      </div>

      <div className="ch-end-actions">
        {request.status === 'open' ? (
          <>
            <Button
              variant="secondary"
              block
              disabled={busy}
              hint="Stop new sign-ups. Volunteers you confirmed still come."
              onClick={() => setStatus('filled', 'Done.')}
            >
              We have enough volunteers
            </Button>
            <Button
              variant="danger-outline"
              block
              disabled={busy}
              hint="Take this request down. Volunteers can no longer sign up."
              onClick={() => setAskCancel(true)}
            >
              Cancel this request
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            block
            disabled={busy}
            hint="Let volunteers sign up again."
            onClick={() => setStatus('open', 'Open again.')}
          >
            Open this request again
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={askCancel}
        title="Cancel this request?"
        confirmLabel="Yes, cancel it"
        cancelLabel="No, keep it"
        tone="danger"
        busy={busy}
        onConfirm={() => setStatus('closed', 'Cancelled.')}
        onCancel={closeAsk}
      >
        {coming > 0
          ? `${volunteers(coming)} will see it's cancelled in My shifts.`
          : 'No one can sign up any more.'}
      </ConfirmDialog>
    </section>
  );
}

export default function RequestDetail() {
  return <CharityGate><Detail /></CharityGate>;
}
