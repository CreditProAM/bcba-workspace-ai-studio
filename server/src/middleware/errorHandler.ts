import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { toErrorBody } from '../shared/errors.js';

export function errorHandler(err: Error, c: Context) {
  const { status, body } = toErrorBody(err);
  if (status >= 500) {
    console.error('[api]', c.get('requestId'), err);
  }
  return c.json(body, status as ContentfulStatusCode);
}
