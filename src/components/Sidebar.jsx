import { Link, NavLink, useNavigate } from 'react-router-dom';
import { BadgeCheck, LogOut, Search } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { homePathFor } from './RequireAuth.jsx';
import { Icon, iconFor } from './icons.jsx';
import Logo from './brand/Logo.jsx';
import { openCommandPalette } from './CommandPalette.jsx';

// Links whose path is the root of a space should only be active on an exact match
const exactPaths = ['/', '/user', '/charity', '/charity/requests'];

/** Group links by their `section`, keeping first-seen order. */
function groups(links) {
  const out = [];
  for (const link of links) {
    const name = link.section ?? '';
    let g = out.find((x) => x.name === name);
    if (!g) out.push((g = { name, links: [] }));
    g.links.push(link);
  }
  return out;
}

// Desktop navigation (hidden on phones, where BottomNav takes over).
export default function Sidebar({ links, space }) {
  const { profile, charity, signOut } = useAuth();
  const navigate = useNavigate();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  const name = profile?.display_name ?? '';
  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <Link to={profile ? homePathFor(profile, charity) : '/'} className="sidebar-brand" aria-label="Kindred home">
          <Logo size={30} />
        </Link>
        <button type="button" className="kbd-hint" onClick={openCommandPalette}>
          <Search size={15} strokeWidth={1.75} aria-hidden="true" />
          Jump to…
          <span className="kbd">{isMac ? '⌘K' : 'Ctrl K'}</span>
        </button>
        <nav aria-label="Main">
          {groups(links).map((g) => (
            <div key={g.name} style={{ display: 'contents' }}>
              {g.name && <div className="nav-section">{g.name}</div>}
              {g.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={exactPaths.includes(link.to)}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name={iconFor(link)} size={18} />
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        {profile && (
          <div className="sidebar-foot">
            <span className="avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>
            <span className="sidebar-user">
              <strong title={name}>
                {name}{' '}
                {profile.verified && <BadgeCheck size={14} strokeWidth={2} style={{ color: 'var(--accent)', verticalAlign: '-2px' }} aria-label="Verified" />}
              </strong>
              <span>{space}</span>
            </span>
            <button type="button" className="icon-button" onClick={handleSignOut} aria-label="Sign out" title="Sign out">
              <LogOut size={18} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
