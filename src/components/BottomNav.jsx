import { NavLink } from 'react-router-dom';
import { Icon, iconFor } from './icons.jsx';

const exactPaths = ['/user', '/charity'];

// Phone tab bar (hidden on desktop). At most 5 tabs: the first 4 links and the last (Chats).
export default function BottomNav({ links }) {
  const tabs = links.length > 5 ? [...links.slice(0, 4), links[links.length - 1]] : links;
  return (
    <nav className="bottom-nav" aria-label="Main">
      {tabs.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={exactPaths.includes(link.to)}
          className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
        >
          <Icon name={iconFor(link)} />
          <span className="tab-label">{link.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
