import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { healthRoutes } from './modules/health/routes.js';

export function createApp() {
  const env = getEnv();
  const app = new Hono();

  app.onError(errorHandler);
  app.use('*', requestIdMiddleware);
  app.use(
    '*',
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  app.route('/api/v1', healthRoutes);

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404),
  );

  return app;
}

export type AppType = ReturnType<typeof createApp>;
