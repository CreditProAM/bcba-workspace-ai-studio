import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const requestId = incoming && incoming.trim() ? incoming.trim() : randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
};

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}
