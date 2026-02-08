import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { logger } from '../services/logger.service';

// Custom error class for application errors
export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handling middleware
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error with request context
  logger.logRequestError(err, req, err.statusCode);

  // Capture to Sentry (skip 4xx client errors)
  if (err.statusCode >= 500 && process.env.SENTRY_DSN) {
    Sentry.captureException(err, {
      extra: {
        url: req.originalUrl,
        method: req.method,
        tenantId: (req as any).tenant?.tenantId,
      },
    });
  }

  // Development vs Production error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === '23505') error = handleDuplicateFieldsDB(error); // Postgres unique violation
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};

const sendErrorDev = (err: any, req: Request, res: Response) => {
  res.status(err.statusCode).json({
    status: err.status,
    requestId: req.requestId,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: any, req: Request, res: Response) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      requestId: req.requestId,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak details
    // Log the actual error for debugging
    console.error('[UNHANDLED ERROR]', {
      path: req.path,
      method: req.method,
      error: err.message,
      stack: err.stack,
      name: err.name,
    });
    res.status(500).json({
      status: 'error',
      requestId: req.requestId,
      message: 'Something went very wrong',
    });
  }
};

// DB Error Handlers

const handleCastErrorDB = (err: any) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (_err: any) => {
  // Regex to extract field value if possible, or just generic message
  const message = `Duplicate field value entered. Please use another value!`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);
