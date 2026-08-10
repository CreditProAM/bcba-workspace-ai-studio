/**
 * Minimal API client spine for Wave 0+.
 * Frontend must run without the server when domains are LOCAL.
 */

function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function prepareBody(body: unknown): { body: BodyInit | undefined; headers: Headers } {
  const headers = new Headers();
  if (body === undefined || body === null) {
    return { body: undefined, headers };
  }
  if (typeof body === 'string' || typeof body === 'object') {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const serialized = typeof body === 'string' ? body : JSON.stringify(body);
    return { body: serialized, headers };
  }
  return { body: body as BodyInit, headers };
}

export type ApiFetchInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export async function apiFetch<T = unknown>(
  path: string,
  init: ApiFetchInit = {},
): Promise<T> {
  const base = apiBaseUrl();
  if (!base) {
    throw new ApiClientError(
      0,
      'API_BASE_URL_MISSING',
      'VITE_API_BASE_URL is not set; API calls are unavailable in this environment.',
    );
  }

  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const method = (init.method ?? 'GET').toUpperCase();
  if (MUTATING_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', token);
    }
  }

  const { body, headers: bodyHeaders } = prepareBody(init.body);
  bodyHeaders.forEach((value, key) => {
    if (!headers.has(key)) headers.set(key, value);
  });

  const response = await fetch(url, {
    ...init,
    method,
    body,
    headers,
    credentials: 'include',
  });

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const err = parsed as ApiErrorBody | undefined;
    throw new ApiClientError(
      response.status,
      err?.error?.code ?? 'HTTP_ERROR',
      err?.error?.message ?? `Request failed (${response.status})`,
    );
  }

  return parsed as T;
}

export type HealthResponse = {
  ok: boolean;
  service: string;
  version: string;
  db?: 'up' | 'down' | 'unknown';
};

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/v1/health');
}

export function getReady(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/v1/ready');
}
