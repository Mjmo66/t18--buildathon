import { NavLink } from 'react-router-dom';
import { Icon, iconFor } from './icons.jsx';

const exactPaths = ['/user', '/charity'];

// Phone tab bar (hidden on desktop). Links marked `tab: false` stay sidebar-only; at most 5 tabs.
export default function BottomNav({ links }) {
  const tabs = links.filter((l) => l.tab !== false).slice(0, 5);
  return (
    <nav className="bottom-nav" aria-label="Main">
      {tabs.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={exactPaths.includes(link.to)}
          className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
        >
          <Icon name={iconFor(link)} size={22} />
          <span className="tab-label">{link.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
