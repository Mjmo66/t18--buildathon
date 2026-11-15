import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { ScanCheckin } from '../../features/attendance/index.jsx';
import { SIGNUP_SELECT } from './data.js';
import { format } from 'date-fns';
import { CalendarX2, Clock, Hourglass, MapPin, ScanLine, TriangleAlert, CircleCheck, X } from 'lucide-react';
import { Empty, Loading, Meta, formatHours, formatWhen } from './ui.jsx';

const STATUS = {
  applied: { label: 'Pending', cls: 'v-chip v-chip-no' },
  accepted: { label: 'Accepted', cls: 'v-chip' },
  attended: { label: 'Attended', cls: 'v-chip' },
  no_show: { label: 'No-show', cls: 'v-chip v-chip-danger' },
  declined: { label: 'Declined', cls: 'v-chip v-chip-plain' },
  cancelled: { label: 'Cancelled', cls: 'v-chip v-chip-plain' },
};

function ShiftCard({ s, children }) {
  const r = s.requests;
  const d = new Date(s.shift_at);
  return (
    <div className="v-card">
      <div className="v-shift">
        <span className="v-shift-date" aria-hidden="true">
          <small>{format(d, 'MMM')}</small>
          <strong>{format(d, 'd')}</strong>
        </span>
        <div className="v-shift-main">
          <div className="v-between" style={{ alignItems: 'flex-start' }}>
            <Link to={`/user/requests/${s.request_id}`} style={{ color: 'inherit', textDecoration: 'none', minWidth: 0 }}>
              <h3>{r?.title ?? 'Request'}</h3>
            </Link>
            <span className={STATUS[s.status].cls}>{STATUS[s.status].label}</span>
          </div>
          {r?.charities?.org_name && <span className="v-muted v-small">{r.charities.org_name}</span>}
        </div>
      </div>
      <div className="v-meta">
        <Meta icon={Clock}>{formatWhen(s.shift_at)}</Meta>
        {r && <Meta icon={Hourglass}>{formatHours(s.hours_credited ?? r.duration_hours)}</Meta>}
        {r?.address && <Meta icon={MapPin}>{r.address}</Meta>}
      </div>
      {children}
    </div>
  );
}

export default function MyShifts() {
  const { user, profile, refreshProfile } = useAuth();
  const [signups, setSignups] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const reload = useCallback(async () => {
    if (!user) { setSignups([]); return; }
    const { data, error: err } = await supabase.from('signups').select(SIGNUP_SELECT)
      .eq('volunteer_id', user.id).order('shift_at', { ascending: true });
    if (err) setError(err.message);
    setSignups(data ?? []);
  }, [user]);
  useEffect(() => { reload(); }, [reload]);

  const cancel = async (s) => {
    if (!window.confirm(`Cancel ${s.requests?.title ?? 'this shift'} on ${formatWhen(s.shift_at)}?`)) return;
    setBusyId(s.id); setError(null);
    const { error: err } = await supabase.from('signups').update({ status: 'cancelled' }).eq('id', s.id);
    setBusyId(null);
    if (err) setError(`Could not cancel: ${err.message}`);
    reload();
  };

  const onCheckedIn = async () => {
    setScanning(false);
    setNotice('Checked in. Hours and points added.');
    await reload();
    refreshProfile();
  };

  if (!signups) return <div className="v-page"><Loading /></div>;

  const upcoming = signups.filter((s) => ['applied', 'accepted'].includes(s.status));
  const past = signups.filter((s) => ['attended', 'no_show'].includes(s.status)).reverse();
  const hasAccepted = upcoming.some((s) => s.status === 'accepted');

  return (
    <div className="v-page">
      <h1>My shifts</h1>
      {profile?.suspended && <div className="v-notice v-notice-warn"><TriangleAlert size={18} strokeWidth={1.75} aria-hidden="true" /><span>Your account is suspended after 3 no-shows.</span></div>}
      <div className="v-tabs" role="group" aria-label="Shifts">
        <button type="button" aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming <span className="v-mono">{upcoming.length}</span></button>
        <button type="button" aria-pressed={tab === 'past'} onClick={() => setTab('past')}>Past <span className="v-mono">{past.length}</span></button>
      </div>
      {notice && <div className="v-notice v-notice-ok"><CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" /><span>{notice}</span></div>}
      {error && <p className="v-error" role="alert">{error}</p>}

      {tab === 'upcoming' && (
        <div className="v-list">
          {hasAccepted && (
            <button type="button" className="v-btn v-btn-block" onClick={() => setScanning(true)}>
              <ScanLine size={18} strokeWidth={2} aria-hidden="true" />Check in
            </button>
          )}
          {upcoming.length === 0 && (
            <Empty icon={<CalendarX2 size={22} strokeWidth={1.75} />} action={<Link to="/user" className="v-btn">Find a shift</Link>}>No upcoming shifts.</Empty>
          )}
          {upcoming.map((s) => (
            <ShiftCard key={s.id} s={s}>
              <div className="v-row">
                {s.status === 'accepted' && (
                  <button type="button" className="v-btn v-btn-sm" onClick={() => setScanning(true)}>
                    <ScanLine size={16} strokeWidth={2} aria-hidden="true" />Check in
                  </button>
                )}
                <button type="button" className="v-btn v-btn-danger v-btn-sm" disabled={busyId === s.id} onClick={() => cancel(s)}>
                  {busyId === s.id ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            </ShiftCard>
          ))}
        </div>
      )}

      {tab === 'past' && (
        <div className="v-list">
          {past.length === 0 && <Empty icon={<CalendarX2 size={22} strokeWidth={1.75} />}>No past shifts yet.</Empty>}
          {past.map((s) => <ShiftCard key={s.id} s={s} />)}
        </div>
      )}

      {scanning && (
        <div className="v-sheet-backdrop" onClick={() => setScanning(false)}>
          <div className="v-sheet" role="dialog" aria-modal="true" aria-label="Check in" onClick={(e) => e.stopPropagation()}>
            <div className="v-between">
              <h2 style={{ margin: 0 }}>Scan the charity's QR code</h2>
              <button type="button" className="v-btn v-btn-secondary v-btn-sm" onClick={() => setScanning(false)} aria-label="Close">
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <ScanCheckin onCheckedIn={onCheckedIn} />
          </div>
        </div>
      )}
    </div>
  );
}
