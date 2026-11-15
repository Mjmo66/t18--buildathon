import { useEffect, useMemo, useState } from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { rankRequests } from '../../features/matching/index.js';
import { Alert, Button, EmptyState } from '../../components/ui/index.js';
import { formatDayTime, formatDistance, formatDuration } from '../../components/format.js';
import { REQUEST_SELECT, skippedPrefs, usePrefs } from './data.js';
import { CalendarClock, ChevronRight, Clock, MapPin, SearchX } from 'lucide-react';
import { Loading } from './ui.jsx';
import StAndrewsMap from '../../components/map/StAndrewsMap.jsx';

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

/** Short pin text: "Sat 10am", "Today 2pm". */
function pinLabel(shiftAt) {
  if (!shiftAt) return 'Open';
  const d = new Date(shiftAt);
  const day = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE');
  return `${day} ${format(d, d.getMinutes() ? 'h:mmaaa' : 'haaa')}`;
}

export function RequestCard({ request, match, transport, other = false, selected = false }) {
  const where = match.distanceKm != null ? formatDistance(match.distanceKm, transport) : request.address;
  const line = [
    match.shiftAt ? formatDayTime(match.shiftAt).replace(', ', ' ') : 'No dates yet',
    request.duration_hours ? formatDuration(request.duration_hours) : null,
    where,
  ].filter(Boolean).join(' · ');
  return (
    <Link to={`/user/requests/${request.id}`} id={`request-${request.id}`}
      className={`v-card v-request v-card-link${selected ? ' v-card-selected' : ''}`}>
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
  const [selectedId, setSelectedId] = useState(null);
  const pins = useMemo(() => ranked.filter(({ match }) => match.eligible || (showAll && match.shiftAt))
    .filter(({ request }) => request.lat != null && request.lng != null)
    .map(({ request, match }) => ({
      id: request.id, lat: request.lat, lng: request.lng,
      label: pinLabel(match.shiftAt), title: request.title, tone: match.eligible ? 'match' : 'other',
    })), [ranked, showAll]);
  const me = prefs?.lat != null && prefs?.lng != null ? { lat: prefs.lat, lng: prefs.lng } : null;
  const selectPin = (id) => {
    setSelectedId(id);
    document.getElementById(`request-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

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

      {requests != null && (pins.length > 0 || me) && (
        <StAndrewsMap
          pins={pins}
          me={me}
          radiusKm={me ? Number(prefs.max_km) || undefined : undefined}
          selectedId={selectedId}
          onSelect={selectPin}
          height={260}
          interactive
          ariaLabel="Map of St Andrews with your shifts"
        />
      )}

      {requests == null ? <Loading /> : (
        <div className="v-list">
          {matching.map(({ request, match }) => (
            <RequestCard key={request.id} request={request} match={match} transport={transport} selected={request.id === selectedId} />
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
                <RequestCard key={request.id} request={request} match={match} transport={transport} other selected={request.id === selectedId} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
