import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { homePathFor } from './RequireAuth.jsx';
import { Icon, iconFor } from './icons.jsx';
import Logo from './brand/Logo.jsx';
import Tooltip from './ui/Tooltip.jsx';

// Links whose path is the root of a space should only be active on an exact match
const exactPaths = ['/', '/user', '/charity', '/charity/requests'];

// Desktop navigation (hidden on phones, where BottomNav takes over). One flat list of links,
// with the account link as a button at the foot (avatar, name, gear).
export default function Sidebar({ links }) {
  const { profile, charity } = useAuth();
  const name = profile?.display_name ?? '';
  const account = links.find((l) => l.account);
  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <Link to={profile ? homePathFor(profile, charity) : '/'} className="sidebar-brand" aria-label="Kindred home">
          <Logo size={32} />
        </Link>
        <nav aria-label="Main">
          {links.filter((l) => !l.account).map((link) => {
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
        {profile && account && (
          <div className="sidebar-foot">
            <Tooltip hint="Account and settings" block>
              <NavLink
                to={account.to}
                className={({ isActive }) => `account-button ${isActive ? 'active' : ''}`}
                aria-label={`${name}, account and settings`}
              >
                <span className="avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>
                <span className="account-text">
                  <span className="sidebar-user">{name}</span>
                  <span className="account-sub">Account</span>
                </span>
                <Icon name="settings" size={22} />
              </NavLink>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  );
}
