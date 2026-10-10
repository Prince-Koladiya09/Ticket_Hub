import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth.js';

/** Guards a route: requires login and, optionally, one of the given roles. */
export default function ProtectedRoute({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <div className="empty">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
