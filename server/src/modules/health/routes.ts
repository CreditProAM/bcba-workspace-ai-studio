import { Hono } from 'hono';
import { checkDatabaseConnectivity } from '../../db/client.js';

export const healthRoutes = new Hono();

const SERVICE = 'bcba-workspace-api';
const VERSION = '0.0.0';

healthRoutes.get('/health', async (c) => {
  const dbUp = await checkDatabaseConnectivity();
  return c.json({
    ok: true,
    service: SERVICE,
    version: VERSION,
    db: dbUp ? 'up' : 'down',
  });
});

healthRoutes.get('/ready', async (c) => {
  const dbUp = await checkDatabaseConnectivity();
  if (!dbUp) {
    return c.json(
      {
        ok: false,
        service: SERVICE,
        version: VERSION,
        db: 'down',
      },
      503,
    );
  }

  return c.json({
    ok: true,
    service: SERVICE,
    version: VERSION,
    db: 'up',
  });
});
