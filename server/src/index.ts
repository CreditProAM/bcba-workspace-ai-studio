import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { getEnv } from './config/env.js';

const env = getEnv();
const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`bcba-workspace-api listening on http://localhost:${info.port}`);
  },
);
