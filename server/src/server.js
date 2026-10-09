import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/logger.js';

const app = createApp();
app.listen(env.PORT, () => logger.info(`API listening on :${env.PORT}`));
