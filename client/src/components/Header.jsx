import { NavLink, Link } from 'react-router-dom';
import { routes } from '../routes.js';

export default function Header() {
  const links = routes.filter((r) => r.nav);
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
        </nav>
      </div>
    </header>
  );
}
