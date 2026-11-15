import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { RewardsSummary, WarningsBanner } from '../../features/attendance/index.jsx';
import { formatKm } from '../../features/matching/index.js';
import { usePrefs } from './data.js';
import { LABELS, Loading } from './ui.jsx';

export default function Profile() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const { prefs } = usePrefs(user?.id);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  if (loading) return <div className="v-page"><Loading /></div>;
  if (!user || !profile) return <div className="v-page"><p className="v-muted">Sign in to see your profile.</p></div>;

  const verify = async () => {
    setVerifying(true); setError(null);
    const { error: err } = await supabase.rpc('demo_verify_volunteer');
    if (err) setError(`Could not verify: ${err.message}`);
    else await refreshProfile();
    setVerifying(false);
  };

  const slotCount = prefs ? Object.values(prefs.availability ?? {}).reduce((n, s) => n + (s?.length ?? 0), 0) : 0;

  return (
    <div className="v-page">
      <div className="v-field" style={{ gap: 4 }}>
        <h1>{profile.display_name}</h1>
        {user?.email && <span className="v-muted v-small">{user.email}</span>}
      </div>

      <WarningsBanner profile={profile} />

      <section className="v-card">
        <div className="v-between">
          <h2 style={{ margin: 0 }}>Verification</h2>
          {profile.verified
            ? <span className="v-chip">✓ Verified</span>
            : <span className="v-chip v-chip-plain">Not verified</span>}
        </div>
        {!profile.verified && profile.role === 'volunteer' && (
          <button type="button" className="v-btn v-btn-secondary" onClick={verify} disabled={verifying}>
            {verifying ? 'Verifying…' : 'Verify me'}
          </button>
        )}
        {error && <p className="v-error" role="alert">{error}</p>}
      </section>

      <section className="v-card">
        <h2>Rewards</h2>
        <RewardsSummary profile={profile} />
      </section>

      <Link to="/user/preferences" className="v-card">
        <div className="v-between">
          <h2 style={{ margin: 0 }}>Preferences</h2>
          <span aria-hidden="true">›</span>
        </div>
        <span className="v-muted v-small">
          {prefs
            ? `${LABELS.transport[prefs.transport]} · up to ${formatKm(Number(prefs.max_km))} · ${slotCount ? `${slotCount} time slots` : 'any time'}`
            : 'Not set yet'}
        </span>
      </Link>

      <button type="button" className="v-btn v-btn-secondary" onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
