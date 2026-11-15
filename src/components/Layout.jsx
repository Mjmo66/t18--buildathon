import { Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { charityLinks } from '../pages/charity/links.js';
import { userLinks } from '../pages/user/links.js';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';

const chatLink = { to: '/chat', label: 'Chats', icon: 'chat' };

/** Nav links for the signed-in user's space (area links + Chats). */
export function linksFor(role) {
  const own = role === 'charity' ? charityLinks : userLinks;
  return [...own, chatLink];
}

// App shell for signed-in pages: header, sidebar on desktop, bottom tab bar on phones.
export default function Layout() {
  const { profile } = useAuth();
  const links = linksFor(profile?.role);
  const space = profile?.role === 'charity' ? 'Charity' : 'Volunteer';
  return (
    <div className="layout">
      <Header space={space} />
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
