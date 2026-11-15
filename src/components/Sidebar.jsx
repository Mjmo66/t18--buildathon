import { NavLink } from 'react-router-dom';

// Links whose path is the root of a space should only be active on an exact match
const exactPaths = ['/', '/user', '/charity'];

export default function Sidebar({ links, open, onNavigate }) {
  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <nav>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={exactPaths.includes(link.to)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={onNavigate}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
