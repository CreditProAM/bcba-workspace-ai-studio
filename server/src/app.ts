import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { authRoutes } from './modules/auth/routes.js';
import { clientRoutes } from './modules/clients/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { staffRoutes } from './modules/staff/routes.js';

export function createApp() {
  const env = getEnv();
  const app = new Hono();

  app.onError(errorHandler);
  app.use('*', requestIdMiddleware);
  app.use(
    '*',
    cors({
      origin: (origin) => {
        // Non-browser / same-origin tools may omit Origin
        if (!origin) return env.CORS_ORIGINS[0] ?? 'http://localhost:3000';
        return env.CORS_ORIGINS.includes(origin) ? origin : null;
      },
      credentials: true,
      allowHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
      exposeHeaders: ['X-Request-Id'],
    }),
  );

  app.route('/api/v1', healthRoutes);
  app.route('/api/v1', authRoutes);
  app.route('/api/v1', clientRoutes);
  app.route('/api/v1', staffRoutes);

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404),
  );

  return app;
}

export type AppType = ReturnType<typeof createApp>;
