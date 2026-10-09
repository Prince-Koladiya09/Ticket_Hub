import fs from 'node:fs';
import { Router } from 'express';

/**
 * Feature modules self-register. Each `modules/<name>/index.js` exports
 * `routes = [{ path, router }]`, which are mounted under /api/v1.
 * Adding a module never requires touching this file.
 */
const modulesDir = new URL('./modules/', import.meta.url);

export const apiRouter = Router();

for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const indexUrl = new URL(`./${entry.name}/index.js`, modulesDir);
  if (!fs.existsSync(indexUrl)) continue;
  const mod = await import(indexUrl.href);
  for (const { path, router } of mod.routes ?? []) apiRouter.use(path, router);
}
