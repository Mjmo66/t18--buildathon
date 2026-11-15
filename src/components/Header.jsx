import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { homePathFor } from './RequireAuth.jsx';
import Logo from './brand/Logo.jsx';

// Top bar: phones in the app and public pages. Logo only; each page has its own heading.
export default function Header() {
  const { user, profile, charity } = useAuth();
  return (
    <header className="header">
      <Link to={user && profile ? homePathFor(profile, charity) : '/'} className="logo" aria-label="Kindred home">
        <Logo size={30} />
      </Link>
    </header>
  );
}
