import axios from 'axios';
import { useAuth } from '../store/auth.js';

export const http = axios.create({ baseURL: '/api/v1', withCredentials: true });

// Unwraps the `{ success, data, meta }` envelope and normalizes errors to `{ code, message, details, status }`.
const unwrap = (res) => res.data;

http.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A single in-flight refresh is shared by every request that hits a 401 at the same time.
let refreshing = null;

async function refreshSession() {
  if (!refreshing) {
    refreshing = axios
      .post('/api/v1/auth/refresh', null, { withCredentials: true })
      .then((res) => {
        useAuth.getState().setSession(res.data.data);
        return res.data.data.accessToken;
      })
      .catch((err) => {
        useAuth.getState().clear();
        throw err;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const code = response?.data?.error?.code;
    const isAuthRoute = config?.url?.startsWith('/auth/');
    if (response?.status === 401 && !config._retried && !isAuthRoute && code !== 'INVALID_TOKEN') {
      config._retried = true;
      try {
        const token = await refreshSession();
        config.headers.Authorization = `Bearer ${token}`;
        return http(config);
      } catch {
        /* fall through to the original error */
      }
    }
    const apiError = response?.data?.error ?? { code: 'NETWORK_ERROR', message: error.message };
    return Promise.reject({ ...apiError, status: response?.status });
  },
);

export const get = (url, params) => http.get(url, { params }).then(unwrap);
export const post = (url, body) => http.post(url, body).then(unwrap);
export const patch = (url, body) => http.patch(url, body).then(unwrap);
export const del = (url) => http.delete(url).then(unwrap);
