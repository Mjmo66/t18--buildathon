import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { RewardsSummary, WarningsBanner } from '../../features/attendance/index.jsx';
import { groupsFromAvailability } from '../../features/matching/index.js';
import { Button } from '../../components/ui/index.js';
import SignOutButton from '../../components/SignOutButton.jsx';
import TextSizeSetting from '../../components/TextSizeSetting.jsx';
import { Check, Power, SlidersHorizontal } from 'lucide-react';
import { usePrefs } from './data.js';
import { useAvailability } from './availability.js';
import { LABELS, Loading } from './ui.jsx';
import './profile.css';

const TIME_LABELS = {
  weekdayMornings: 'Weekday mornings', weekdayAfternoons: 'Weekday afternoons', evenings: 'Evenings', weekends: 'Weekends',
};

const cleanName = (name) => (name ?? '').replace(/\s*\(demo\)\s*/i, ' ').trim();

function initials(name) {
  const parts = cleanName(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function miles(km) {
  const m = Math.round(Number(km) * 0.621371 * 10) / 10;
  return `${m} ${m === 1 ? 'mile' : 'miles'}`;
}

/** "You're ON / OFF" card with a switch styled like Lovable's. */
function AvailabilityCard() {
  const [on, setOn] = useAvailability();
  return (
    <div className={`availability-card ${on ? 'is-on' : 'is-off'}`}>
      <span className="availability-icon" aria-hidden="true"><Power /></span>
      <div className="availability-text">
        <strong>{on ? 'You’re ON' : 'You’re OFF'}</strong>
        <p>{on ? 'You’ll see new requests that fit you.' : 'You won’t see new requests until you switch on.'}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Available for new requests"
        className="lv-switch"
        data-state={on ? 'checked' : 'unchecked'}
        onClick={() => setOn(!on)}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}

export default function Profile() {
  const { user, profile, loading } = useAuth();
  const { prefs } = usePrefs(user?.id);

  if (loading) return <div className="v-page"><Loading /></div>;
  if (!user || !profile) return <div className="v-page"><p className="v-muted">Sign in to see your profile.</p></div>;

  const name = cleanName(profile.display_name);
  const place = prefs?.area || prefs?.address_label || prefs?.address || 'St Andrews';
  const hours = Number(profile.hours_total ?? 0);
  const groups = prefs ? groupsFromAvailability(prefs.availability ?? {}) : [];
  const freeTimes = !prefs ? null : groups.length ? groups.map((g) => TIME_LABELS[g]).join(', ') : 'Any time';
  const interests = prefs?.interests ?? [];

  return (
    <div className="lv">
      <div className="phone-padding lv-profile">
        <div className="profile-top">
          <span className="avatar avatar-large" aria-hidden="true">{initials(profile.display_name)}</span>
          <h2>{name}</h2>
          <p className="muted text-xs">{place}</p>
          {profile.verified && (
            <span className="status status-verified"><Check size={12} aria-hidden="true" /> Verified</span>
          )}
        </div>

        <WarningsBanner profile={profile} />

        <AvailabilityCard />

        <div className="profile-section">
          <h3>Your details</h3>
          <div className="detail-row"><span>Email</span><span>{user.email}</span></div>
          <div className="detail-row"><span>Hours given</span><span>{hours} {hours === 1 ? 'hour' : 'hours'}</span></div>
          <div className="detail-row"><span>Points</span><span>{profile.points ?? 0}</span></div>
          {prefs && (
            <div className="detail-row">
              <span>Physical work</span><span>{LABELS.physicalShort[prefs.physical_max] ?? prefs.physical_max}</span>
            </div>
          )}
        </div>

        <div className="profile-section">
          <h3>Your preferences</h3>
          {prefs ? (
            <>
              <div className="detail-row">
                <span>Travel</span>
                <span>
                  {LABELS.transport[prefs.transport] ?? prefs.transport}
                  {prefs.max_km != null && `, up to ${miles(prefs.max_km)}`}
                </span>
              </div>
              <div className="detail-row"><span>Free times</span><span>{freeTimes}</span></div>
              <p className="muted text-xs lv-profile-label">Happy to help with</p>
              {interests.length ? (
                <div className="tag-list">
                  {interests.map((t) => <span key={t} className="task-tag">{LABELS.category[t] ?? t}</span>)}
                </div>
              ) : (
                <p className="lv-profile-note">Anything</p>
              )}
            </>
          ) : (
            <p className="lv-profile-note">Not set yet.</p>
          )}
          <Button to="/user/preferences" variant="secondary" block className="lv-profile-button"
            icon={<SlidersHorizontal size={18} aria-hidden="true" />}>
            Change preferences
          </Button>
        </div>

        <div className="profile-section lv-profile-rewards">
          <h3>Your volunteering</h3>
          <RewardsSummary profile={profile} />
        </div>

        <div className="profile-section">
          <TextSizeSetting />
        </div>

        <div className="profile-section lv-profile-signout">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
