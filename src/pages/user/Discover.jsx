import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { rankRequests } from '../../features/matching/index.js';
import { REQUEST_SELECT, skippedPrefs, usePrefs } from './data.js';
import { Chips, Empty, Loading, formatHours, formatWhen } from './ui.jsx';

export function RequestCard({ request, match, dim = false }) {
  return (
    <Link to={`/user/requests/${request.id}`} className={`v-card${dim ? ' v-dim' : ''}`}>
      <div className="v-between">
        <h3>{request.title}</h3>
        {request.category && <span className="v-chip v-chip-plain">{request.category}</span>}
      </div>
      <span className="v-muted v-small">
        {request.charities?.org_name ?? 'Charity'}
        {request.charities?.verified_at ? ' ✓' : ''}
      </span>
      <span className="v-small">
        {match.shiftAt ? formatWhen(match.shiftAt) : 'No upcoming shifts'} · {formatHours(request.duration_hours)}
        {request.schedule_type === 'recurring' ? ' · recurring' : ''}
        {match.distanceKm == null && request.address ? ` · ${request.address}` : ''}
      </span>
      <Chips yes={match.reasons} no={dim ? match.blockers : []} />
    </Link>
  );
}

export default function Discover() {
  const { user, loading: authLoading } = useAuth();
  const { prefs, loading: prefsLoading } = usePrefs(user?.id);
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from('requests').select(REQUEST_SELECT).eq('status', 'open').order('starts_at')
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        setRequests(data ?? []);
      });
    return () => { cancelled = true; };
  }, []);

  const ranked = useMemo(() => (requests ? rankRequests(prefs, requests) : []), [prefs, requests]);
  const matching = ranked.filter((x) => x.match.eligible);
  const other = ranked.filter((x) => !x.match.eligible && x.match.shiftAt);

  if (authLoading || prefsLoading) return <div className="v-page"><Loading /></div>;
  if (user && !prefs && !skippedPrefs()) return <Navigate to="/user/preferences?welcome=1" replace />;

  return (
    <div className="v-page">
      <div className="v-between">
        <h1>For you</h1>
        <label className="v-switch">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show all
        </label>
      </div>

      {!prefs && (
        <Link to="/user/preferences" className="v-notice">Set your location and free times to see what fits →</Link>
      )}
      {error && <p className="v-error" role="alert">Could not load requests: {error}</p>}

      {requests == null ? <Loading /> : (
        <div className="v-list">
          {matching.map(({ request, match }) => <RequestCard key={request.id} request={request} match={match} />)}
          {matching.length === 0 && !showAll && (
            <Empty action={other.length > 0 && (
              <button type="button" className="v-btn v-btn-secondary" onClick={() => setShowAll(true)}>
                Show {other.length} other {other.length === 1 ? 'request' : 'requests'}
              </button>
            )}>
              {requests.length === 0 ? 'No open requests yet.' : 'Nothing fits your preferences right now.'}
            </Empty>
          )}
          {showAll && other.length > 0 && (
            <>
              <h2 className="v-muted" style={{ marginTop: 8 }}>Doesn't fit</h2>
              {other.map(({ request, match }) => <RequestCard key={request.id} request={request} match={match} dim />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
