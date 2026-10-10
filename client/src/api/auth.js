import axios from 'axios';
import { post, get } from './http.js';
import { useAuth } from '../store/auth.js';

export async function login(body) {
  const { data } = await post('/auth/login', body);
  useAuth.getState().setSession(data);
  return data.user;
}

export async function register(body) {
  const { data } = await post('/auth/register', body);
  useAuth.getState().setSession(data);
  return data.user;
}

export async function logout() {
  try {
    await post('/auth/logout');
  } finally {
    useAuth.getState().clear();
  }
}

export const fetchMe = () => get('/users/me').then((r) => r.data);

/** On page load, try to restore the session from the httpOnly refresh cookie. */
export async function bootstrapSession() {
  try {
    const res = await axios.post('/api/v1/auth/refresh', null, { withCredentials: true });
    useAuth.getState().setSession(res.data.data);
  } catch {
    useAuth.getState().clear();
  }
}
