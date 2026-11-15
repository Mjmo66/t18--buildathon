import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { homePathFor } from './RequireAuth.jsx';
import { Icon, iconFor } from './icons.jsx';
import Logo from './brand/Logo.jsx';
import Tooltip from './ui/Tooltip.jsx';

// Links whose path is the root of a space should only be active on an exact match
const exactPaths = ['/', '/user', '/charity', '/charity/requests'];

// Desktop navigation (hidden on phones, where BottomNav takes over). One flat list of links.
export default function Sidebar({ links }) {
  const { profile, charity } = useAuth();
  const name = profile?.display_name ?? '';
  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <Link to={profile ? homePathFor(profile, charity) : '/'} className="sidebar-brand" aria-label="Kindred home">
          <Logo size={32} />
        </Link>
        <nav aria-label="Main">
          {links.map((link) => {
            const el = (
              <NavLink
                key={link.to}
                to={link.to}
                end={exactPaths.includes(link.to)}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon name={iconFor(link)} size={22} />
                {link.label}
              </NavLink>
            );
            return link.hint ? <Tooltip key={link.to} hint={link.hint} block>{el}</Tooltip> : el;
          })}
        </nav>
        {profile && (
          <div className="sidebar-foot">
            <span className="avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>
            <span className="sidebar-user">{name}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
