import { Link } from 'react-router-dom';

export default function Header({ onMenuClick }) {
  return (
    <header className="header">
      <button className="menu-button" onClick={onMenuClick} aria-label="Toggle menu">
        ☰
      </button>
      <Link to="/" className="logo">
        Buildathon
      </Link>
      <div className="header-actions">
        <button className="button">Sign in</button>
      </div>
    </header>
  );
}
