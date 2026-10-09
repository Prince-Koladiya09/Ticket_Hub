import { ZodError } from 'zod';
import { AppError, notFound } from './errors.js';

export function notFoundHandler(req, res, next) {
  next(notFound(`Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid input';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err?.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = `Invalid ${err.path}`;
  } else if (err?.name === 'ValidationError' && err.errors) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid input';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err?.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = 'Resource already exists';
    details = err.keyValue;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON body';
  }

  if (status >= 500) req.log?.error({ err }, 'unhandled error');

  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}), requestId: req.id },
  });
}
