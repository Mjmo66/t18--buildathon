import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { formatKm, rankRequests } from '../../features/matching/index.js';
import { REQUEST_SELECT, skippedPrefs, usePrefs } from './data.js';
import { BadgeCheck, CalendarDays, ChevronRight, Hourglass, MapPin, MapPinned, Repeat, SearchX, SlidersHorizontal } from 'lucide-react';
import { Chips, Empty, Loading, Meta, formatHours, formatWhen } from './ui.jsx';

export function RequestCard({ request, match, dim = false }) {
  // Distance is shown in the meta row, so drop it from the reason chips.
  const reasons = match.reasons.filter((r) => !/ away$/.test(r));
  return (
    <Link to={`/user/requests/${request.id}`} className={`v-card${dim ? ' v-dim' : ''}`}>
      <div className="v-between" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <h3>{request.title}</h3>
          <span className="v-card-org">
            {request.charities?.org_name ?? 'Charity'}
            {request.charities?.verified_at && (
              <BadgeCheck className="v-verified" size={15} strokeWidth={2} aria-label="Verified charity" />
            )}
          </span>
        </div>
        {request.category && <span className="v-chip v-chip-plain">{request.category}</span>}
      </div>
      <div className="v-meta">
        <Meta icon={CalendarDays}>{match.shiftAt ? formatWhen(match.shiftAt) : 'No upcoming shifts'}</Meta>
        <Meta icon={Hourglass}>{formatHours(request.duration_hours)}</Meta>
        {match.distanceKm != null && <Meta icon={MapPin}>{formatKm(match.distanceKm)}</Meta>}
        {match.distanceKm == null && request.address && <Meta icon={MapPin}>{request.address}</Meta>}
        {request.schedule_type === 'recurring' && <Meta icon={Repeat}>recurring</Meta>}
      </div>
      <Chips yes={reasons} no={dim ? match.blockers : []} />
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
        <div className="v-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
          <label className="v-switch">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Show all
          </label>
          <Link to="/user/preferences" className="v-btn v-btn-ghost v-btn-sm" aria-label="Preferences" title="Preferences">
            <SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {!prefs && (
        <Link to="/user/preferences" className="v-notice">
          <MapPinned size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>Set your location and free times to see what fits</span>
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      )}
      {error && <p className="v-error" role="alert">Could not load requests: {error}</p>}

      {requests == null ? <Loading /> : (
        <div className="v-list">
          {matching.map(({ request, match }) => <RequestCard key={request.id} request={request} match={match} />)}
          {matching.length === 0 && !showAll && (
            <Empty icon={<SearchX size={22} strokeWidth={1.75} />} action={other.length > 0 && (
              <button type="button" className="v-btn v-btn-secondary" onClick={() => setShowAll(true)}>
                Show {other.length} other {other.length === 1 ? 'request' : 'requests'}
              </button>
            )}>
              {requests.length === 0 ? 'No open requests yet.' : 'Nothing fits your preferences right now.'}
            </Empty>
          )}
          {showAll && other.length > 0 && (
            <>
              <h2 className="v-section-label">Doesn't fit</h2>
              {other.map(({ request, match }) => <RequestCard key={request.id} request={request} match={match} dim />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
