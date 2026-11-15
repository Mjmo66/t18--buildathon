import { Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { charityLinks } from '../pages/charity/links.js';
import { userLinks } from '../pages/user/links.js';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';

/** Nav links for the signed-in user's space: area links with Messages before the profile link. */
export function linksFor(role) {
  const own = role === 'charity' ? charityLinks : userLinks;
  const chatLink = { to: '/chat', label: 'Messages', icon: 'chat' };
  const at = own.findIndex((l) => /profile/.test(l.to));
  return at < 0 ? [...own, chatLink] : [...own.slice(0, at), chatLink, ...own.slice(at)];
}

// App shell for signed-in pages: sidebar on desktop; header + bottom tab bar on phones.
export default function Layout() {
  const { profile } = useAuth();
  const links = linksFor(profile?.role);
  return (
    <div className="layout layout-app">
      <Header />
      <div className="layout-body">
        <Sidebar links={links} />
        <main className="content">
          <Outlet />
        </main>
      </div>
      <BottomNav links={links} />
    </div>
  );
}

// Shell for public pages (landing, login, sign-up, charity details): header only.
export function PublicLayout() {
  return (
    <div className="layout layout-public">
      <Header />
      <main className="content content-narrow">
        <Outlet />
      </main>
    </div>
  );
}
