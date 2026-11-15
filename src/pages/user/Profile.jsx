import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { RewardsSummary, WarningsBanner } from '../../features/attendance/index.jsx';
import { formatKm } from '../../features/matching/index.js';
import { usePrefs } from './data.js';
import { BadgeCheck, ChevronRight, LogOut, ShieldCheck, SlidersHorizontal } from 'lucide-react';
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
      <div className="v-row" style={{ gap: 14, flexWrap: 'nowrap' }}>
        <span className="avatar" style={{ width: 52, height: 52, fontSize: '1.25rem' }} aria-hidden="true">
          {profile.display_name?.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="v-field" style={{ gap: 2, minWidth: 0 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {profile.display_name}
            {profile.verified && <BadgeCheck size={20} strokeWidth={2} style={{ color: 'var(--accent)' }} aria-label="Verified" />}
          </h1>
          {user?.email && <span className="v-mono" style={{ overflowWrap: 'anywhere' }}>{user.email}</span>}
        </div>
      </div>

      <WarningsBanner profile={profile} />

      <section className="v-card">
        <div className="v-between">
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} strokeWidth={1.75} style={{ color: 'var(--subtle)' }} aria-hidden="true" />
            Verification
          </h2>
          {profile.verified
            ? <span className="v-chip"><BadgeCheck size={14} strokeWidth={2} aria-hidden="true" />Verified</span>
            : <span className="v-chip v-chip-plain">Not verified</span>}
        </div>
        {!profile.verified && profile.role === 'volunteer' && (
          <button type="button" className="v-btn v-btn-secondary" onClick={verify} disabled={verifying}>
            {verifying ? 'Verifying…' : 'Verify me'}
          </button>
        )}
        {error && <p className="v-error" role="alert">{error}</p>}
      </section>

      <section className="v-field" style={{ gap: 10 }}>
        <h2 className="v-section-label" style={{ margin: 0 }}>Rewards</h2>
        <RewardsSummary profile={profile} />
      </section>

      <Link to="/user/preferences" className="v-card">
        <div className="v-between">
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={18} strokeWidth={1.75} style={{ color: 'var(--subtle)' }} aria-hidden="true" />
            Preferences
          </h2>
          <ChevronRight size={18} strokeWidth={1.75} style={{ color: 'var(--subtle)' }} aria-hidden="true" />
        </div>
        <span className="v-mono">
          {prefs
            ? `${LABELS.transport[prefs.transport]} · up to ${formatKm(Number(prefs.max_km))} · ${slotCount ? `${slotCount} time slots` : 'any time'}`
            : 'Not set yet'}
        </span>
      </Link>

      <button type="button" className="v-btn v-btn-secondary" onClick={() => signOut()}>
        <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />Sign out
      </button>
    </div>
  );
}
