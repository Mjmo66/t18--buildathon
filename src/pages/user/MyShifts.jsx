import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isToday } from 'date-fns';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { ScanCheckin } from '../../features/attendance/index.jsx';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, useToast } from '../../components/ui/index.js';
import { formatDayTime, formatShiftRange } from '../../components/format.js';
import { SIGNUP_SELECT } from './data.js';
import { CalendarX2, ScanLine, Search } from 'lucide-react';
import { Loading, SIGNUP_STATUS } from './ui.jsx';

const CHECK_IN_HELP = "Scan the organiser's code when you arrive.";
const CANCEL_HINT = "Let the charity know you can't come. You can sign up again later.";

/** "East Sands" from "East Sands, St Andrews KY16 8LJ". */
const shortPlace = (address) => address?.split(',')[0]?.trim() || null;

function ShiftCard({ s, children }) {
  const r = s.requests;
  const charityCancelled = r?.status === 'closed' && ['applied', 'accepted'].includes(s.status);
  const st = charityCancelled ? { label: 'Cancelled by charity', tone: 'danger' }
    : SIGNUP_STATUS[s.status] ?? { label: s.status, tone: 'neutral' };
  const line = [
    formatShiftRange(s.shift_at, s.hours_credited ?? r?.duration_hours).replace(', ', ' · '),
    shortPlace(r?.address),
  ].filter(Boolean).join(' · ');
  return (
    <article className="v-card v-shift">
      <Badge tone={st.tone}>{st.label}</Badge>
      <h3 className="v-request-title">
        <Link to={`/user/requests/${s.request_id}`} className="v-title-link">{r?.title ?? 'Shift'}</Link>
      </h3>
      <p className="v-request-line">{line}</p>
      {!charityCancelled && children}
    </article>
  );
}

export default function MyShifts() {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [signups, setSignups] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!user) { setSignups([]); return; }
    const { data, error: err } = await supabase.from('signups').select(SIGNUP_SELECT)
      .eq('volunteer_id', user.id).order('shift_at', { ascending: true });
    if (err) setError(err.message);
    setSignups(data ?? []);
  }, [user]);
  useEffect(() => { reload(); }, [reload]);

  const closeCancel = useCallback(() => setCancelling(null), []);
  const closeScanner = useCallback(() => setScanning(false), []);

  useEffect(() => {
    if (!scanning) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeScanner(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [scanning, closeScanner]);

  const cancel = async () => {
    const s = cancelling;
    if (!s) return;
    setBusyId(s.id); setError(null);
    const { error: err } = await supabase.from('signups').update({ status: 'cancelled' }).eq('id', s.id);
    setBusyId(null);
    setCancelling(null);
    if (err) setError(`Could not cancel: ${err.message}`);
    else toast('Your place is cancelled.', 'success');
    reload();
  };

  // The sheet stays open on ScanCheckin's success panel; its "Done" button closes it.
  const onCheckedIn = async () => {
    await reload();
    refreshProfile();
  };

  if (!signups) return <div className="v-page"><Loading /></div>;

  const upcoming = signups.filter((s) => ['applied', 'accepted'].includes(s.status));
  const past = signups.filter((s) => ['attended', 'no_show'].includes(s.status)).reverse();
  const hasAccepted = upcoming.some((s) => s.status === 'accepted');
  const acceptedToday = upcoming.some((s) => s.status === 'accepted' && isToday(new Date(s.shift_at)));

  const checkInButton = (
    <Button size="lg" block icon={<ScanLine size={22} aria-hidden="true" />} help={CHECK_IN_HELP} onClick={() => setScanning(true)}>
      Check in
    </Button>
  );

  return (
    <div className="v-page">
      <h1>My shifts</h1>
      {profile?.suspended && (
        <Alert tone="warning">You can't sign up for new shifts after 3 missed shifts.</Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      {/* Check-in for an accepted shift on another day (the card shows it on the shift day). */}
      {hasAccepted && !acceptedToday && checkInButton}

      <section className="v-list" aria-labelledby="v-coming-up">
        <h2 id="v-coming-up" className="v-section-title">Coming up</h2>
        {upcoming.length === 0 && (
          <EmptyState
            icon={<CalendarX2 size={26} aria-hidden="true" />}
            title="No shifts coming up."
            action={<Button to="/user" block icon={<Search size={20} aria-hidden="true" />}>Find shifts</Button>}
          />
        )}
        {upcoming.map((s) => (
          <ShiftCard key={s.id} s={s}>
            {s.status === 'accepted' && isToday(new Date(s.shift_at)) ? checkInButton : (
              <Button variant="secondary" block hint={CANCEL_HINT} loading={busyId === s.id} onClick={() => setCancelling(s)}>
                Cancel my place
              </Button>
            )}
          </ShiftCard>
        ))}
      </section>

      <section className="v-list" aria-labelledby="v-done">
        <h2 id="v-done" className="v-section-title">Past</h2>
        {past.length === 0 && <p className="v-muted">No finished shifts yet.</p>}
        {past.map((s) => <ShiftCard key={s.id} s={s} />)}
      </section>

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel your place?"
        confirmLabel="Yes, cancel my place"
        cancelLabel="No, keep it"
        tone="danger"
        busy={!!busyId}
        onConfirm={cancel}
        onCancel={closeCancel}
      >
        {cancelling && `${cancelling.requests?.title ?? 'This shift'}, ${formatDayTime(cancelling.shift_at)}`}
      </ConfirmDialog>

      {scanning && (
        <div className="v-sheet-backdrop" onClick={closeScanner}>
          <div className="v-sheet" role="dialog" aria-modal="true" aria-labelledby="v-checkin-title" onClick={(e) => e.stopPropagation()}>
            <div className="v-sheet-head">
              <h2 id="v-checkin-title">Check in</h2>
              <Button variant="secondary" onClick={closeScanner}>Close</Button>
            </div>
            <ScanCheckin onCheckedIn={onCheckedIn} onDone={closeScanner} />
          </div>
        </div>
      )}
    </div>
  );
}
