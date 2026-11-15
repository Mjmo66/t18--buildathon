import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { RewardsSummary, WarningsBanner } from '../../features/attendance/index.jsx';
import { Button } from '../../components/ui/index.js';
import SignOutButton from '../../components/SignOutButton.jsx';
import { SlidersHorizontal } from 'lucide-react';
import { Loading } from './ui.jsx';

export default function Profile() {
  const { user, profile, loading } = useAuth();

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

      <Button to="/user/preferences" variant="secondary" block icon={<SlidersHorizontal size={20} aria-hidden="true" />}
        hint="Choose where you are, how you travel and when you're free.">
        Change what I'm shown
      </Button>

      <SignOutButton />
    </div>
  );
}
