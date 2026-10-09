export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Bad request', details, code = 'BAD_REQUEST') =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'Unauthorized', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);
export const forbidden = (message = 'Forbidden', code = 'FORBIDDEN') =>
  new AppError(403, code, message);
export const notFound = (message = 'Not found', code = 'NOT_FOUND') =>
  new AppError(404, code, message);
export const conflict = (message = 'Conflict', code = 'CONFLICT', details) =>
  new AppError(409, code, message, details);
