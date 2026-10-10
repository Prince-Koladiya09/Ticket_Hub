import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../api/auth.js';
import { ErrorBox } from '../components/ui.jsx';

export const route = { path: '/login', nav: { label: 'Login', order: 90, when: 'guest' } };

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card auth-card">
      <h2>Welcome back</h2>
      {params.get('verified') && <div className="success-box">Email verified. You can log in now.</div>}
      <form onSubmit={submit}>
        <label>Email</label>
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label>Password</label>
        <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <ErrorBox error={error} />
        <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
          {busy ? 'Signing in...' : 'Log in'}
        </button>
      </form>
      <p className="muted" style={{ marginBottom: 0 }}>
        New here? <Link to="/register">Create an account</Link>
      </p>
    </div>
  );
}
