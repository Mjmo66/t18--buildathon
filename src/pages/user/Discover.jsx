import { useEffect, useMemo, useState } from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { rankRequests } from '../../features/matching/index.js';
import { Alert, Button, EmptyState } from '../../components/ui/index.js';
import { formatDay, formatDistance, formatDuration, formatTime } from '../../components/format.js';
import { REQUEST_SELECT, skippedPrefs, usePrefs } from './data.js';
import {
  Award, CalendarClock, CalendarDays, ChevronRight, Clock, HeartHandshake, MapPin, Moon, Power, SearchX, Sparkles,
} from 'lucide-react';
import { LABELS, Loading } from './ui.jsx';
import { useAvailability } from './availability.js';
import StAndrewsMap from '../../components/map/StAndrewsMap.jsx';
import photo from '../../assets/community-volunteers.jpg';
import './board.css';

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

/** One open request as a Lovable opportunity card; the whole card links to the request. */
export function RequestCard({ request, match, transport, other = false, selected = false }) {
  const where = match.distanceKm != null ? formatDistance(match.distanceKm, transport) : request.address;
  const category = LABELS.category[request.category] ?? 'Volunteering';
  return (
    <Link to={`/user/requests/${request.id}`} id={`request-${request.id}`}
      className={`opportunity-link board-card${selected ? ' is-selected' : ''}`}>
      <article className="opportunity">
        <div className="opportunity-top">
          <span className={`task-tag task-tag-${request.category ?? 'other'}`}>{category}</span>
          {request.duration_hours ? <span className="spots">{formatDuration(request.duration_hours)}</span> : null}
        </div>
        <h3>{request.title}</h3>
        <p className="charity-line">
          <HeartHandshake aria-hidden="true" /> {request.charities?.org_name ?? 'Charity'}
        </p>
        <div className="opportunity-details">
          <span><CalendarDays aria-hidden="true" />{match.shiftAt ? formatDay(match.shiftAt) : 'No dates yet'}</span>
          {match.shiftAt && <span><Clock aria-hidden="true" />{formatTime(match.shiftAt)}</span>}
          {where && <span className="board-where"><MapPin aria-hidden="true" />{where}</span>}
        </div>
        {other && match.blockers.length > 0 && <p className="board-why">{plainBlocker(match.blockers)}</p>}
      </article>
    </Link>
  );
}

function AvailabilityCard({ on, setOn }) {
  return (
    <div className={`availability-card ${on ? 'is-on' : 'is-off'}`}>
      <span className="availability-icon" aria-hidden="true"><Power /></span>
      <div className="availability-text">
        <strong>{on ? 'You’re ON' : 'You’re OFF'}</strong>
        <p>{on ? 'You’ll see new requests that fit you.' : 'You won’t see new requests until you switch on.'}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Available for new requests"
        className="board-switch" onClick={() => setOn(!on)}>
        <span aria-hidden="true" />
      </button>
    </div>
  );
}

function PointsCard({ points, badges }) {
  const toNext = 50 - (points % 50);
  return (
    <Link to="/user/profile" className="points-card">
      <span className="points-card-icon" aria-hidden="true"><Award /></span>
      <span className="points-card-text">
        <strong>{points} points · {badges} {badges === 1 ? 'badge' : 'badges'}</strong>
        <span>{toNext} more for your next reward</span>
      </span>
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}

export default function Discover() {
  const { user, profile, loading: authLoading } = useAuth();
  const { prefs, loading: prefsLoading } = usePrefs(user?.id);
  const [on, setOn] = useAvailability();
  const [requests, setRequests] = useState(null);
  const [badges, setBadges] = useState(0);
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

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    supabase.from('badges').select('code').eq('volunteer_id', user.id)
      .then(({ data }) => { if (!cancelled) setBadges(data?.length ?? 0); });
    return () => { cancelled = true; };
  }, [user?.id]);

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

  if (authLoading || prefsLoading) return <div className="lv"><div className="phone-padding"><Loading /></div></div>;
  if (user && !prefs && !skippedPrefs()) return <Navigate to="/user/preferences?welcome=1" replace />;

  const firstName = (profile?.display_name ?? '').replace(/\s*\(demo\)\s*$/i, '').trim().split(/\s+/)[0];

  const showAllButton = (
    <Button variant="primary" block icon={<SearchX size={20} aria-hidden="true" />} onClick={() => setShowAll(true)}>
      Show all shifts
    </Button>
  );
  const changeTimesButton = (
    <Button to="/user/preferences" variant="secondary" block icon={<CalendarClock size={20} aria-hidden="true" />}>
      Change my times
    </Button>
  );

  return (
    <div className="lv">
      <div className="phone-padding board">
        <div className="phone-intro">
          <div>
            <span className="eyebrow">Your community, your time</span>
            <h2>Hello{firstName ? `, ${firstName}` : ''}</h2>
            <p>A little kindness starts right here.</p>
          </div>
          <Sparkles className="welcome-spark" strokeWidth={1.3} aria-hidden="true" />
        </div>

        <AvailabilityCard on={on} setOn={setOn} />
        <PointsCard points={profile?.points ?? 0} badges={badges} />

        {!on ? (
          <div className="empty-state board-off">
            <Moon aria-hidden="true" />
            <h3>You’re off. Turn on to see requests.</h3>
          </div>
        ) : (
          <>
            <div className="community-photo">
              <img src={photo} alt="Volunteers packing food parcels" width={1536} height={1024} />
              <div className="community-photo-text">
                <span>St Andrews, Fife</span>
                <h3>Small acts. Stronger communities.</h3>
              </div>
            </div>

            {!prefs && (
              <Link to="/user/preferences" className="points-card board-prefs">
                <span className="points-card-icon" aria-hidden="true"><MapPin /></span>
                <span className="points-card-text">
                  <strong>Tell us where and when</strong>
                  <span>So we can show shifts that suit you.</span>
                </span>
                <ChevronRight aria-hidden="true" />
              </Link>
            )}
            {error && <Alert tone="danger" title="Could not load shifts">{error}</Alert>}

            {requests != null && (pins.length > 0 || me) && (
              <div className="board-map">
                <StAndrewsMap
                  pins={pins}
                  me={me}
                  radiusKm={me ? Number(prefs.max_km) || undefined : undefined}
                  selectedId={selectedId}
                  onSelect={selectPin}
                  height={220}
                  interactive
                  ariaLabel="Map of St Andrews with your shifts"
                />
              </div>
            )}

            <div className="section-heading">
              <h2>Community opportunities</h2>
              {requests != null && <span>{matching.length} open</span>}
            </div>

            {requests == null ? <Loading /> : (
              <div className="board-list">
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
                  <button type="button" className="board-more" onClick={() => setShowAll(true)}>
                    Show all shifts
                  </button>
                )}

                {showAll && other.length > 0 && (
                  <>
                    <div className="section-heading board-other-heading">
                      <h2>Doesn’t fit your choices</h2>
                      <span>{other.length}</span>
                    </div>
                    {other.map(({ request, match }) => (
                      <RequestCard key={request.id} request={request} match={match} transport={transport} other selected={request.id === selectedId} />
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
