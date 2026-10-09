const modules = import.meta.glob('./pages/*.jsx', { eager: true });

export const routes = Object.values(modules)
  .filter((m) => m.route && m.default)
  .map((m) => ({ ...m.route, Component: m.default }))
  .sort((a, b) => (a.nav?.order ?? 99) - (b.nav?.order ?? 99));
