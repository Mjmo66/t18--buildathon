import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { homePathFor } from './RequireAuth.jsx';
import { Icon } from './icons.jsx';
import { Badge } from './ui/index.js';

export default function Header({ space }) {
  const { user, profile, charity, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <header className="header">
      <Link to={user && profile ? homePathFor(profile, charity) : '/'} className="logo">
        <span className="logo-mark" aria-hidden="true">K</span>
        Kindred
      </Link>
      {space && <span className="space-badge">{space}</span>}
      <div className="header-actions">
        {user ? (
          <>
            {profile && (
              <span className="header-user" title={profile.display_name}>
                {profile.display_name}
                {profile.verified && (
                  <Badge tone="success" className="header-verified" title="Verified">
                    ✓
                  </Badge>
                )}
              </span>
            )}
            <button type="button" className="icon-button" onClick={handleSignOut} aria-label="Sign out" title="Sign out">
              <Icon name="logout" size={20} />
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
