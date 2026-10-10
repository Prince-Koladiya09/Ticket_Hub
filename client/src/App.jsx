import { useEffect } from 'react';
import { Link, Outlet, Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { bootstrapSession } from './api/auth.js';
import { routes } from './routes.js';

function Layout() {
  return (
    <>
      <Header />
      <main className="container">
        <Outlet />
      </main>
      <footer className="footer">TicketHub - portfolio project</footer>
    </>
  );
}

function NotFound() {
  return (
    <div className="empty">
      <h2>Page not found</h2>
      <Link to="/">Back to events</Link>
    </div>
  );
}

export default function App() {
  // Restore the session from the refresh cookie before rendering protected pages.
  useEffect(() => {
    bootstrapSession();
  }, []);

  return (
    <Routes>
      <Route element={<Layout />}>
        {routes.map(({ path, Component, auth, roles }) => (
          <Route
            key={path}
            path={path}
            element={
              auth || roles ? (
                <ProtectedRoute roles={roles}>
                  <Component />
                </ProtectedRoute>
              ) : (
                <Component />
              )
            }
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
