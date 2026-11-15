import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { Spinner } from './ui/index.js';

/** Where a signed-in user belongs. */
export function homePathFor(profile, charity) {
  if (profile?.role === 'charity') return charity ? '/charity' : '/charity-details';
  return '/user';
}

function FullPageSpinner({ onSignOut }) {
  return (
    <div className="full-page-center">
      <Spinner size="lg" label="Loading" />
      {onSignOut && (
        <button type="button" className="link-button" onClick={onSignOut}>
          Sign out
        </button>
      )}
    </div>
  );
}

/**
 * Protects a route tree.
 * role: 'charity' | 'volunteer' (optional; wrong role → own space).
 * needsCharity: charity accounts without a `charities` row go to /charity-details.
 */
export function RequireAuth({ role, needsCharity = false, children }) {
  const { user, profile, charity, loading, signOut } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  // Profile is loaded right after the session changes; wait for it instead of guessing the role.
  if (!profile) return <FullPageSpinner onSignOut={signOut} />;
  if (role && profile.role !== role) return <Navigate to={homePathFor(profile, charity)} replace />;
  if (needsCharity && profile.role === 'charity' && !charity) return <Navigate to="/charity-details" replace />;
  return children;
}

/** Public-only pages (landing, login, sign-up): signed-in users go to their space. */
export function PublicOnly({ children }) {
  const { user, profile, charity, loading, signOut } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (user && !profile) return <FullPageSpinner onSignOut={signOut} />;
  if (user && profile) {
    const from = location.state?.from;
    const home = homePathFor(profile, charity);
    // Return to the page that sent them to /login, but only inside their own space or chat.
    const target = from && (from.startsWith(home) || from.startsWith('/chat')) ? from : home;
    return <Navigate to={target} replace />;
  }
  return children;
}
