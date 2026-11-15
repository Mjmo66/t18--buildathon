import { NavLink } from 'react-router-dom';
import { Icon, iconFor } from './icons.jsx';

// Links whose path is the root of a space should only be active on an exact match
const exactPaths = ['/', '/user', '/charity'];

// Desktop navigation (hidden on phones, where BottomNav takes over).
export default function Sidebar({ links }) {
  return (
    <aside className="sidebar">
      <nav>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={exactPaths.includes(link.to)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon name={iconFor(link)} size={20} />
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
