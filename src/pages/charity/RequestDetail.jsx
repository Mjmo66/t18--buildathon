import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { getOrCreateConversation } from '../../lib/chat';
import { AttendancePanel, CheckinQR } from '../../features/attendance/index.jsx';
import { CharityGate, Empty, ErrorNote, Loading, StatusPill } from './components.jsx';
import {
  CATEGORIES, EXPERIENCE_LEVELS, PHYSICAL_LEVELS, fmtHours, fmtShift, labelOf, nextShifts, scheduleSummary,
} from './shared.js';

const ACTIVE = ['applied', 'accepted', 'attended', 'no_show'];

function Detail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState(undefined); // undefined = loading, null = not found
  const [signups, setSignups] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [messaging, setMessaging] = useState(null);

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

  const setStatus = async (status) => {
    setBusy(true);
    const { error: err } = await supabase.from('requests').update({ status }).eq('id', id);
    setBusy(false);
    if (err) setError(err); else reload();
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
        <p>Request not found.</p>
        <Link className="button" to="/charity/requests">Back to requests</Link>
      </Empty>
    );
  }
  if (request.charity_id !== user.id) return <Empty><p>This request belongs to another charity.</p></Empty>;

  // One row per volunteer with their latest signup status (a volunteer may have several shifts).
  const applicants = [];
  const byVolunteer = new Map();
  for (const s of signups.filter((x) => ACTIVE.includes(x.status))) {
    if (!byVolunteer.has(s.volunteer_id)) {
      const row = { volunteerId: s.volunteer_id, name: s.volunteer?.display_name ?? 'Volunteer', verified: s.volunteer?.verified, statuses: [] };
      byVolunteer.set(s.volunteer_id, row);
      applicants.push(row);
    }
    byVolunteer.get(s.volunteer_id).statuses.push(s.status);
  }
  const confirmed = signups.filter((s) => ['accepted', 'attended'].includes(s.status)).length;
  const upcoming = nextShifts(request, 3);

  return (
    <section className="ch-page">
      <Link className="ch-back" to="/charity/requests">← Requests</Link>
      <header className="ch-head">
        <div>
          <h1>{request.title}</h1>
          <div className="ch-row">
            <StatusPill status={request.status} />
            <span className="ch-muted ch-small">{labelOf(CATEGORIES, request.category)}</span>
          </div>
        </div>
      </header>

      <ErrorNote error={error} />

      <div className="ch-card ch-details">
        {request.description && <p className="ch-desc">{request.description}</p>}
        <dl>
          <dt>Schedule</dt><dd>{scheduleSummary(request)}</dd>
          <dt>{request.schedule_type === 'recurring' ? 'Next shifts' : 'Shift'}</dt>
          <dd>
            {upcoming.length ? (
              <ul className="ch-plain">{upcoming.map((d) => <li key={d.toISOString()}>{fmtShift(d)}</li>)}</ul>
            ) : 'No upcoming shifts'}
          </dd>
          <dt>Duration</dt><dd>{fmtHours(request.duration_hours)} h</dd>
          <dt>Volunteers</dt><dd>{confirmed}/{request.slots} confirmed</dd>
          <dt>Physical</dt><dd>{labelOf(PHYSICAL_LEVELS, request.physical_level)}</dd>
          <dt>Experience</dt>
          <dd>
            {labelOf(EXPERIENCE_LEVELS, request.experience)}
            {request.experience_notes && <span className="ch-muted"> · {request.experience_notes}</span>}
          </dd>
          <dt>Location</dt><dd>{request.address || '—'}</dd>
        </dl>
      </div>

      <div className="ch-actions">
        {request.status === 'open' ? (
          <>
            <button type="button" className="ch-btn-secondary" disabled={busy} onClick={() => setStatus('filled')}>Mark filled</button>
            <button type="button" className="ch-btn-danger" disabled={busy} onClick={() => setStatus('closed')}>Close request</button>
          </>
        ) : (
          <button type="button" className="button" disabled={busy} onClick={() => setStatus('open')}>Reopen</button>
        )}
        <button type="button" className="ch-btn-secondary" onClick={() => setShowQR((v) => !v)}>
          {showQR ? 'Hide check-in QR' : 'Show check-in QR'}
        </button>
      </div>

      {showQR && (
        <div className="ch-card ch-qr">
          <CheckinQR request={request} />
        </div>
      )}

      <h2>Signups</h2>
      <div className="ch-card">
        <AttendancePanel request={request} onChange={reload} />
      </div>

      <h2>Applicants</h2>
      {applicants.length === 0 ? (
        <Empty><p>No applicants yet.</p></Empty>
      ) : (
        <ul className="ch-list">
          {applicants.map((a) => (
            <li key={a.volunteerId} className="ch-card ch-row ch-between">
              <div>
                <strong>{a.name}</strong>{a.verified && <span className="ch-ok" title="Verified"> ✓</span>}
                <div className="ch-row ch-small">
                  {[...new Set(a.statuses)].map((st) => <StatusPill key={st} status={st} />)}
                </div>
              </div>
              <button
                type="button"
                className="ch-btn-secondary"
                disabled={messaging === a.volunteerId}
                onClick={() => message(a.volunteerId)}
              >
                {messaging === a.volunteerId ? 'Opening…' : '💬 Message'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function RequestDetail() {
  return <CharityGate><Detail /></CharityGate>;
}
