import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth.js';
import { ErrorBox } from '../components/ui.jsx';

export const route = { path: '/register', nav: { label: 'Sign up', order: 91, when: 'guest' } };

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card auth-card">
      <h2>Create your account</h2>
      <form onSubmit={submit}>
        <label>Name</label>
        <input required minLength={2} value={form.name} onChange={set('name')} />
        <label>Email</label>
        <input type="email" required value={form.email} onChange={set('email')} />
        <label>Password</label>
        <input type="password" required minLength={8} value={form.password} onChange={set('password')} />
        <small className="muted">At least 8 characters, with a letter and a number.</small>
        <label>I want to</label>
        <select value={form.role} onChange={set('role')}>
          <option value="user">Buy tickets</option>
          <option value="organizer">Organize events</option>
        </select>
        <ErrorBox error={error} />
        <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
          {busy ? 'Creating...' : 'Sign up'}
        </button>
      </form>
      <p className="muted" style={{ marginBottom: 0 }}>
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
