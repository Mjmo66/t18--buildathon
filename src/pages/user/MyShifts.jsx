import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isToday } from 'date-fns';
import { CalendarCheck2, CalendarDays, Clock3, HeartHandshake, MapPin, ScanLine } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { ScanCheckin } from '../../features/attendance/index.jsx';
import { Button, ConfirmDialog, useToast } from '../../components/ui/index.js';
import { formatDayTime, formatShiftRange } from '../../components/format.js';
import { SIGNUP_SELECT } from './data.js';
import { LABELS, Loading, SIGNUP_STATUS, capital } from './ui.jsx';
import './commitments.css';

const CHECK_IN_HELP = "Scan the organiser's code when you arrive.";
const DAY_MS = 24 * 3600000;
// SIGNUP_SELECT plus the request's category for the task tag.
const COMMITMENT_SELECT = SIGNUP_SELECT.replace('requests(id, title,', 'requests(id, title, category,');

/** "East Sands" from "East Sands, St Andrews KY16 8LJ". */
const shortPlace = (address) => address?.split(',')[0]?.trim() || null;

const STATUS_CLASS = {
  applied: 'status-pending', accepted: 'status-verified', attended: 'status-completed', no_show: 'status-closed',
};

function CancelNotice({ shiftAt }) {
  const start = new Date(shiftAt).getTime();
  if (start - Date.now() < DAY_MS) return <span className="cancel-chip cancel-chip-late">Starts within 24 hours</span>;
  return <span className="cancel-chip cancel-chip-free">Free cancellation until {formatDayTime(new Date(start - DAY_MS)).replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase())}</span>;
}

function CommitmentCard({ s, upcoming, children }) {
  const r = s.requests;
  const charityCancelled = r?.status === 'closed' && ['applied', 'accepted'].includes(s.status);
  const st = charityCancelled ? { label: 'Cancelled by charity', cls: 'status-closed' }
    : { label: SIGNUP_STATUS[s.status]?.label ?? s.status, cls: STATUS_CLASS[s.status] ?? 'status-draft' };
  const category = r?.category ? (LABELS.category[r.category] ?? capital(r.category)) : null;
  return (
    <article className="opportunity commitment-card">
      <Link to={`/user/requests/${s.request_id}`} className="commitment-link">
        <div className="opportunity-top">
          <span className="commitment-tags">
            {category && <span className={`task-tag task-tag-${r.category}`}>{category}</span>}
            <span className={`status ${st.cls}`}>{st.label}</span>
          </span>
          {upcoming && !charityCancelled && <CancelNotice shiftAt={s.shift_at} />}
        </div>
        <h3>{r?.title ?? 'Shift'}</h3>
        {r?.charities?.org_name && (
          <p className="charity-line"><HeartHandshake aria-hidden="true" /> {r.charities.org_name}</p>
        )}
        <div className="opportunity-details">
          <span><CalendarDays aria-hidden="true" />{formatShiftRange(s.shift_at, s.hours_credited ?? r?.duration_hours)}</span>
          {shortPlace(r?.address) && <span><MapPin aria-hidden="true" />{shortPlace(r?.address)}</span>}
        </div>
      </Link>
      {!charityCancelled && children && <div className="commitment-actions">{children}</div>}
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
    const { data, error: err } = await supabase.from('signups').select(COMMITMENT_SELECT)
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

  if (!signups) return <div className="lv"><div className="phone-padding"><Loading /></div></div>;

  const upcoming = signups.filter((s) => ['applied', 'accepted'].includes(s.status));
  const past = signups.filter((s) => ['attended', 'no_show'].includes(s.status)).reverse();
  const hasAccepted = upcoming.some((s) => s.status === 'accepted');
  const acceptedToday = upcoming.some((s) => s.status === 'accepted' && isToday(new Date(s.shift_at)));

  const checkInButton = (
    <>
      <button type="button" className="commitment-checkin" onClick={() => setScanning(true)}>
        <ScanLine aria-hidden="true" /> Check in
      </button>
      <p className="commitment-help">{CHECK_IN_HELP}</p>
    </>
  );

  return (
    <div className="lv">
      <div className="phone-padding">
        <div className="phone-intro">
          <div>
            <span className="eyebrow">Time well given</span>
            <h2>You’re making a difference.</h2>
            <p>{upcoming.length} upcoming {upcoming.length === 1 ? 'commitment' : 'commitments'}</p>
          </div>
        </div>

        {profile?.suspended && (
          <p className="commitment-alert" role="status">You can't sign up for new shifts after 3 missed shifts.</p>
        )}
        {error && <p className="commitment-alert is-danger" role="alert">{error}</p>}

        {/* Check-in for an accepted shift on another day (the card shows it on the shift day). */}
        {hasAccepted && !acceptedToday && <div className="commitment-checkin-top">{checkInButton}</div>}

        <section aria-labelledby="v-coming-up">
          {upcoming.length === 0 ? (
            <div className="empty-state">
              <CalendarCheck2 aria-hidden="true" style={{ color: 'var(--lv-primary)' }} />
              <h3 id="v-coming-up">Nothing booked yet</h3>
              <p>Shifts you sign up for on the Board will appear here.</p>
              <Link to="/user" className="commitment-find">Go to the Board</Link>
            </div>
          ) : (
            <>
              <h2 id="v-coming-up" className="commitment-date">COMING UP</h2>
              {upcoming.map((s) => (
                <CommitmentCard key={s.id} s={s} upcoming>
                  {s.status === 'accepted' && isToday(new Date(s.shift_at)) ? checkInButton : (
                    <button type="button" className="commitment-cancel" disabled={busyId === s.id} onClick={() => setCancelling(s)}>
                      Cancel my place
                    </button>
                  )}
                </CommitmentCard>
              ))}
              <p className="readonly-note commitment-note">
                <Clock3 aria-hidden="true" /> Cancel for free up to 24 hours before. Tap a commitment to manage it.
              </p>
            </>
          )}
        </section>

        <section className="commitment-past" aria-labelledby="v-done">
          <h2 id="v-done" className="commitment-date">PAST</h2>
          {past.length === 0 && <p className="commitment-none">No finished shifts yet.</p>}
          {past.map((s) => <CommitmentCard key={s.id} s={s} />)}
        </section>
      </div>

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
