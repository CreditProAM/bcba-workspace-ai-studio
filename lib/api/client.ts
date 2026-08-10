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

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
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

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const err = body as ApiErrorBody | undefined;
    throw new ApiClientError(
      response.status,
      err?.error?.code ?? 'HTTP_ERROR',
      err?.error?.message ?? `Request failed (${response.status})`,
    );
  }

  return body as T;
}

export type HealthResponse = {
  ok: boolean;
  service: string;
  version: string;
  db: 'up' | 'down' | 'unknown';
};

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/v1/health');
}

export function getReady(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/v1/ready');
}
