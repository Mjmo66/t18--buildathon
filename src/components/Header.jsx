import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { homePathFor } from './RequireAuth.jsx';
import { Icon } from './icons.jsx';
import Logo from './brand/Logo.jsx';

// Top bar of the phone frame. Tab roots and public pages: the logo. Sub-pages: back arrow + title.
// messages: show the Messages button (volunteers, who have no Messages tab).
export default function Header({ title, back, messages = false }) {
  const { user, profile, charity } = useAuth();
  const navigate = useNavigate();

  function goBack(e) {
    // Go back in history when we came from inside the app; otherwise follow the link.
    if (window.history.state?.idx > 0) {
      e.preventDefault();
      navigate(-1);
    }
  }

  return (
    <header className="shell-header">
      <div className="shell-header-left">
        {title ? (
          <>
            {back && (
              <Link to={back} onClick={goBack} className="shell-icon-btn" aria-label="Back">
                <Icon name="back" size={22} strokeWidth={2} />
              </Link>
            )}
            <h1 className="shell-title">{title}</h1>
          </>
        ) : (
          <Link to={user && profile ? homePathFor(profile, charity) : '/'} className="shell-logo" aria-label="Kindred home">
            <Logo size={28} />
          </Link>
        )}
      </div>
      {messages && (
        <div className="shell-header-actions">
          <Link to="/chat" className="shell-icon-btn" aria-label="Messages" title="Messages">
            <Icon name="chat" size={22} strokeWidth={2} />
          </Link>
        </div>
      )}
    </header>
  );
}
