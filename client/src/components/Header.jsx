import { NavLink, Link, useNavigate } from 'react-router-dom';
import { routes } from '../routes.js';
import { useAuth } from '../store/auth.js';
import { logout } from '../api/auth.js';

// nav.when: 'guest' (logged out only) | 'auth' (logged in only) | omitted (always)
// nav.roles: restrict a link to certain roles
function isVisible(nav, user) {
  if (nav.when === 'guest') return !user;
  if (nav.when === 'auth' && !user) return false;
  if (nav.roles) return !!user && nav.roles.includes(user.role);
  return true;
}

export default function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const links = routes.filter((r) => r.nav && isVisible(r.nav, user));

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="brand">
          Ticket<span>Hub</span>
        </Link>
        <nav className="nav">
          {links.map((r) => (
            <NavLink key={r.path} to={r.nav.to ?? r.path} end>
              {r.nav.label}
            </NavLink>
          ))}
          {user && (
            <button
              onClick={async () => {
                await logout();
                navigate('/');
              }}
            >
              Logout ({user.name.split(' ')[0]})
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
