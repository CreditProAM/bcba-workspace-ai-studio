export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export function toErrorBody(error: unknown): {
  status: number;
  body: { error: { code: string; message: string } };
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message } },
    };
  }

  const message =
    error instanceof Error ? error.message : 'Unexpected server error';

  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message } },
  };
}
