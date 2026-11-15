import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { RewardsSummary, WarningsBanner } from '../../features/attendance/index.jsx';
import { isAvailabilityEmpty } from '../../features/matching/index.js';
import { Button } from '../../components/ui/index.js';
import SignOutButton from '../../components/SignOutButton.jsx';
import { formatMiles } from '../../components/format.js';
import { usePrefs } from './data.js';
import { SlidersHorizontal } from 'lucide-react';
import { LABELS, Loading } from './ui.jsx';

/** "Walking · up to 1 mile · any time" */
function prefsSummary(prefs) {
  if (!prefs) return 'Not chosen yet';
  const km = Number(prefs.max_km);
  const distance = km >= 50 ? 'any distance' : `up to ${formatMiles(km).replace(/ away$/, '')}`;
  const times = isAvailabilityEmpty(prefs.availability) ? 'any time' : 'at the times you chose';
  return `${LABELS.transport[prefs.transport] ?? 'Walking'} · ${distance} · ${times}`;
}

export default function Profile() {
  const { user, profile, loading } = useAuth();
  const { prefs } = usePrefs(user?.id);

  if (loading) return <div className="v-page"><Loading /></div>;
  if (!user || !profile) return <div className="v-page"><p className="v-muted">Sign in to see your profile.</p></div>;

  return (
    <div className="v-page">
      <div className="v-profile-head">
        <span className="avatar v-avatar" aria-hidden="true">
          {profile.display_name?.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <h1>{profile.display_name}</h1>
      </div>

      <WarningsBanner profile={profile} />

      <section className="v-card">
        <h2>Your volunteering</h2>
        <RewardsSummary profile={profile} />
      </section>

      <section className="v-card">
        <h2>Shifts I'm shown</h2>
        <p className="v-request-line">{prefsSummary(prefs)}</p>
        <Button to="/user/preferences" variant="secondary" block icon={<SlidersHorizontal size={20} aria-hidden="true" />}
          hint="Choose where you are, how far you can go and when you're free.">
          Change what I'm shown
        </Button>
      </section>

      <SignOutButton />
    </div>
  );
}
