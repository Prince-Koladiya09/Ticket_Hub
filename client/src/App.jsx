import { Outlet, Route, Routes, Link } from 'react-router-dom';
import Header from './components/Header.jsx';
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
  return (
    <Routes>
      <Route element={<Layout />}>
        {routes.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
