import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar({ onOpenAuth }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar__brand">
        <span className="navbar__icon">🎵</span>
        VinylVault
      </Link>
      <div className="navbar__actions">
        {user ? (
          <>
            <span className="navbar__user">Hi, {user.name}</span>
            <Link to="/profile" className="navbar__link">My Collection</Link>
            <button className="btn btn--ghost" onClick={handleLogout}>Sign out</button>
          </>
        ) : (
          <button className="btn btn--primary" onClick={onOpenAuth}>Sign in</button>
        )}
      </div>
    </nav>
  );
}
