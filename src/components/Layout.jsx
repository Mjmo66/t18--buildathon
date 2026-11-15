import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { charityLinks } from '../pages/charity/links.js';
import { userLinks } from '../pages/user/links.js';
import Header from './Header.jsx';
import BottomNav from './BottomNav.jsx';

const chatLink = { to: '/chat', label: 'Messages', icon: 'chat' };

/** Nav links for the signed-in user's space. Charities get a Messages tab before Account;
 *  volunteers reach Messages from a header button instead. */
export function linksFor(role) {
  if (role !== 'charity') return userLinks;
  const at = charityLinks.findIndex((l) => /profile/.test(l.to));
  return [...charityLinks.slice(0, at), chatLink, ...charityLinks.slice(at)];
}

// Sub-pages: header title and where the back arrow goes. First match wins.
const subPages = [
  [/^\/user\/requests\/[^/]+/, 'Opportunity', '/user'],
  [/^\/user\/preferences/, 'Preferences', '/user/profile'],
  [/^\/charity\/requests\/new/, 'Ask for volunteers', '/charity/requests'],
  [/^\/charity\/requests\/[^/]+/, 'Request', '/charity/requests'],
  [/^\/chat\/[^/]+/, 'Conversation', '/chat'],
];

/** Header for the current path: logo on a tab root, else a back arrow and a title. */
function headerFor(path, links, role) {
  const clean = path.replace(/\/+$/, '') || '/';
  if (links.some((l) => l.tab !== false && l.to === clean)) return {};
  for (const [re, title, back] of subPages) if (re.test(clean)) return { title, back };
  if (clean === '/chat') return { title: 'Messages', back: role === 'charity' ? '/charity' : '/user' };
  const link = links.find((l) => l.to === clean);
  return link ? { title: link.label, back: links[0].to } : {};
}

// App shell for signed-in pages: a phone frame (centred on wide screens, full screen on phones)
// with a header, the scrolling page body (.shell-body) and the bottom tab bar.
export default function Layout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const role = profile?.role;
  const links = linksFor(role);
  const { title, back } = headerFor(pathname, links, role);
  return (
    <div className="shell-stage">
      <div className="shell-frame">
        <Header title={title} back={back} messages={role !== 'charity' && !pathname.startsWith('/chat')} />
        <div className="shell-main">
          <main className="shell-body content">
            <Outlet />
          </main>
        </div>
        <BottomNav links={links} />
      </div>
    </div>
  );
}

// Shell for public pages (landing, login, sign-up, charity details): the same frame, header only.
export function PublicLayout() {
  return (
    <div className="shell-stage">
      <div className="shell-frame shell-public">
        <Header />
        <div className="shell-main">
          <main className="shell-body content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
