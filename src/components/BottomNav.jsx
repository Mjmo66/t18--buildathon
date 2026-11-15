import { NavLink } from 'react-router-dom';
import { Icon, iconFor } from './icons.jsx';

const exactPaths = ['/user', '/charity'];

// Tab bar at the foot of the phone frame, always shown. Links marked `tab: false` are left out; at most 5 tabs.
// Every tab shows its text label; the active tab is bold with a bar on top (not colour alone).
export default function BottomNav({ links }) {
  const tabs = links.filter((l) => l.tab !== false).slice(0, 5);
  return (
    <nav className="bottom-nav" aria-label="Main" style={{ '--tabs': tabs.length }}>
      {tabs.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={exactPaths.includes(link.to)}
          className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
        >
          <Icon name={iconFor(link)} size={24} strokeWidth={2} />
          <span className="tab-label">{link.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
