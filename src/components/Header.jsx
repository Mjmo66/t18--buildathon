import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { homePathFor } from './RequireAuth.jsx';
import Logo from './brand/Logo.jsx';

// Top bar: phones in the app, every size on public pages (desktop app pages use the sidebar).
export default function Header({ space }) {
  const { user, profile, charity, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <header className="header">
      <Link to={user && profile ? homePathFor(profile, charity) : '/'} className="logo" aria-label="Kindred home">
        <Logo size={28} />
      </Link>
      {space && <span className="space-badge">{space}</span>}
      <div className="header-actions">
        {user ? (
          <>
            {profile && (
              <span className="header-user" title={profile.display_name}>
                <span className="header-user-name">{profile.display_name}</span>
                {profile.verified && (
                  <span className="header-verified" title="Verified">
                    <BadgeCheck size={16} strokeWidth={2} aria-label="Verified" />
                  </span>
                )}
              </span>
            )}
            <button type="button" className="icon-button" onClick={handleSignOut} aria-label="Sign out" title="Sign out">
              <LogOut size={18} strokeWidth={1.75} />
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn-secondary btn-sm">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
