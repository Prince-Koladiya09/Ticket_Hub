import { create } from 'zustand';

/** Auth state. The access token lives in memory only (never localStorage), so XSS can't steal a long-lived credential. */
export const useAuth = create((set) => ({
  user: null,
  accessToken: null,
  ready: false, // true once the initial silent refresh attempt has finished
  setSession: ({ user, accessToken }) => set({ user, accessToken, ready: true }),
  clear: () => set({ user: null, accessToken: null, ready: true }),
}));
