import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { rankRequests } from '../../features/matching/index.js';
import { Alert, Button, EmptyState } from '../../components/ui/index.js';
import { formatDayTime, formatDistance, formatDuration } from '../../components/format.js';
import { REQUEST_SELECT, skippedPrefs, usePrefs } from './data.js';
import { CalendarClock, ChevronRight, Clock, MapPin, SearchX } from 'lucide-react';
import { Loading } from './ui.jsx';

/** Why a shift is outside the volunteer's choices, in plain words (one line). */
function plainBlocker(blockers) {
  const b = blockers[0] ?? '';
  if (/km away/.test(b)) return 'Further than you want to travel';
  if (/^Not free|^Outside/.test(b)) return 'Not in your free times';
  if (/physical work$/.test(b)) return 'Heavier work than you chose';
  if (/experience/i.test(b)) return b;
  if (b === 'Filled') return 'Has enough volunteers';
  return b;
}

export function RequestCard({ request, match, transport, other = false }) {
  const where = match.distanceKm != null ? formatDistance(match.distanceKm, transport) : request.address;
  const line = [
    match.shiftAt ? formatDayTime(match.shiftAt).replace(', ', ' ') : 'No dates yet',
    request.duration_hours ? formatDuration(request.duration_hours) : null,
    where,
  ].filter(Boolean).join(' · ');
  return (
    <Link to={`/user/requests/${request.id}`} className="v-card v-request v-card-link">
      <div className="v-request-head">
        <h2 className="v-request-title">{request.title}</h2>
        <p className="v-request-org">{request.charities?.org_name ?? 'Charity'}</p>
        <p className="v-request-line">{line}</p>
        {other && match.blockers.length > 0 && <p className="v-request-why">{plainBlocker(match.blockers)}</p>}
      </div>
      <ChevronRight className="v-chevron" size={24} aria-hidden="true" />
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
  const transport = prefs?.transport;

  if (authLoading || prefsLoading) return <div className="v-page"><Loading /></div>;
  if (user && !prefs && !skippedPrefs()) return <Navigate to="/user/preferences?welcome=1" replace />;

  const showAllButton = (
    <Button variant="primary" block icon={<SearchX size={20} aria-hidden="true" />} onClick={() => setShowAll(true)}
      hint="Also show shifts that don't match your choices.">
      Show all shifts
    </Button>
  );
  const changeTimesButton = (
    <Button to="/user/preferences" variant="secondary" block icon={<CalendarClock size={20} aria-hidden="true" />}
      hint="Choose where you are, how far you can go and when you're free.">
      Change my times
    </Button>
  );

  return (
    <div className="v-page">
      <h1>Shifts for you</h1>

      {!prefs && (
        <Button to="/user/preferences" variant="secondary" block icon={<MapPin size={20} aria-hidden="true" />}
          hint="Choose where you are and when you're free, so we can show shifts that suit you.">
          Tell us where and when
        </Button>
      )}
      {error && <Alert tone="danger" title="Could not load shifts">{error}</Alert>}

      {requests == null ? <Loading /> : (
        <div className="v-list">
          {matching.map(({ request, match }) => (
            <RequestCard key={request.id} request={request} match={match} transport={transport} />
          ))}

          {matching.length === 0 && !showAll && (
            requests.length === 0 ? (
              <EmptyState icon={<Clock size={26} aria-hidden="true" />} title="No shifts yet." />
            ) : (
              <EmptyState
                icon={<SearchX size={26} aria-hidden="true" />}
                title="No shifts match your times yet."
                action={<>{other.length > 0 && showAllButton}{changeTimesButton}</>}
              />
            )
          )}

          {matching.length > 0 && !showAll && other.length > 0 && (
            <Button variant="secondary" block onClick={() => setShowAll(true)}
              hint="Also show shifts that don't match your choices.">
              Show all shifts
            </Button>
          )}

          {showAll && other.length > 0 && (
            <>
              <h2 className="v-section-title">Other shifts</h2>
              {other.map(({ request, match }) => (
                <RequestCard key={request.id} request={request} match={match} transport={transport} other />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
