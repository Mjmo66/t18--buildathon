import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { ScanCheckin } from '../../features/attendance/index.jsx';
import { SIGNUP_SELECT } from './data.js';
import { Empty, Loading, formatHours, formatWhen } from './ui.jsx';

const STATUS = {
  applied: { label: 'Waiting for charity', cls: 'v-chip v-chip-plain' },
  accepted: { label: 'Accepted', cls: 'v-chip' },
  attended: { label: 'Attended', cls: 'v-chip' },
  no_show: { label: 'No-show', cls: 'v-chip v-chip-no' },
  declined: { label: 'Declined', cls: 'v-chip v-chip-plain' },
  cancelled: { label: 'Cancelled', cls: 'v-chip v-chip-plain' },
};

function ShiftCard({ s, children }) {
  const r = s.requests;
  return (
    <div className="v-card">
      <div className="v-between">
        <Link to={`/user/requests/${s.request_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          <h3>{r?.title ?? 'Request'}</h3>
        </Link>
        <span className={STATUS[s.status].cls}>{STATUS[s.status].label}</span>
      </div>
      <span className="v-muted v-small">{r?.charities?.org_name ?? ''}</span>
      <span className="v-small">
        {formatWhen(s.shift_at)}
        {r ? ` · ${formatHours(s.hours_credited ?? r.duration_hours)}` : ''}
        {r?.address ? ` · ${r.address}` : ''}
      </span>
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
      {profile?.suspended && <div className="v-notice v-notice-warn">Your account is suspended after 3 no-shows.</div>}
      <div className="v-tabs" role="group" aria-label="Shifts">
        <button type="button" aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming ({upcoming.length})</button>
        <button type="button" aria-pressed={tab === 'past'} onClick={() => setTab('past')}>Past ({past.length})</button>
      </div>
      {notice && <div className="v-notice">{notice}</div>}
      {error && <p className="v-error" role="alert">{error}</p>}

      {tab === 'upcoming' && (
        <div className="v-list">
          {hasAccepted && (
            <button type="button" className="v-btn v-btn-block" onClick={() => setScanning(true)}>📷 Check in</button>
          )}
          {upcoming.length === 0 && (
            <Empty action={<Link to="/user" className="v-btn">Find a shift</Link>}>No upcoming shifts.</Empty>
          )}
          {upcoming.map((s) => (
            <ShiftCard key={s.id} s={s}>
              <div className="v-row">
                {s.status === 'accepted' && (
                  <button type="button" className="v-btn v-btn-sm" onClick={() => setScanning(true)}>Check in</button>
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
          {past.length === 0 && <Empty>No past shifts yet.</Empty>}
          {past.map((s) => <ShiftCard key={s.id} s={s} />)}
        </div>
      )}

      {scanning && (
        <div className="v-sheet-backdrop" onClick={() => setScanning(false)}>
          <div className="v-sheet" role="dialog" aria-modal="true" aria-label="Check in" onClick={(e) => e.stopPropagation()}>
            <div className="v-between">
              <h2 style={{ margin: 0 }}>Scan the charity's QR code</h2>
              <button type="button" className="v-btn v-btn-secondary v-btn-sm" onClick={() => setScanning(false)}>Close</button>
            </div>
            <ScanCheckin onCheckedIn={onCheckedIn} />
          </div>
        </div>
      )}
    </div>
  );
}
