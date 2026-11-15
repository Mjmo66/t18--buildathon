import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { homePathFor } from './RequireAuth.jsx';
import Logo from './brand/Logo.jsx';

const DETAIL_TITLES = [
  [/^\/user\/requests\//, 'Shift details'],
  [/^\/user\/preferences/, 'My choices'],
  [/^\/charity\/requests\/new/, 'Ask for volunteers'],
  [/^\/charity\/requests\//, 'Request'],
  [/^\/chat\/.+/, 'Messages'],
];

/** Page title for the phone header: the matching nav link, else a detail-page name. */
function titleFor(pathname, links = []) {
  const exact = links.find((l) => l.to === pathname);
  if (exact) return exact.label;
  const detail = DETAIL_TITLES.find(([re]) => re.test(pathname));
  return detail?.[1] ?? '';
}

// Top bar: phones in the app (logo + page title), every size on public pages (logo only).
export default function Header({ links }) {
  const { user, profile, charity } = useAuth();
  const { pathname } = useLocation();
  const title = links ? titleFor(pathname, links) : '';
  return (
    <header className="header">
      <Link to={user && profile ? homePathFor(profile, charity) : '/'} className="logo" aria-label="Kindred home">
        <Logo size={30} />
      </Link>
      {title && <span className="header-title">{title}</span>}
    </header>
  );
}
