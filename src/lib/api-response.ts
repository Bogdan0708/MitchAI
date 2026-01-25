import { Response } from 'express';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}

interface ErrorResponse {
  success: false;
  error: string;
  details?: unknown;
  code?: string;
}

interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Standardized API response utilities
 */
export const apiResponse = {
  /**
   * Send a successful response
   */
  success: <T>(res: Response, data: T, status = 200): Response => {
    return res.status(status).json({
      success: true,
      data
    } as SuccessResponse<T>);
  },

  /**
   * Send an error response
   */
  error: (
    res: Response,
    message: string,
    status = 500,
    details?: unknown,
    code?: string
  ): Response => {
    const response: ErrorResponse = {
      success: false,
      error: message
    };
    if (details !== undefined) response.details = details;
    if (code) response.code = code;
    return res.status(status).json(response);
  },

  /**
   * Send a paginated response
   */
  paginated: <T>(
    res: Response,
    data: T[],
    pagination: PaginationMeta
  ): Response => {
    return res.status(200).json({
      success: true,
      data,
      pagination
    } as PaginatedResponse<T>);
  },

  /**
   * Send a 201 Created response
   */
  created: <T>(res: Response, data: T): Response => {
    return apiResponse.success(res, data, 201);
  },

  /**
   * Send a 204 No Content response
   */
  noContent: (res: Response): Response => {
    return res.status(204).send();
  },

  /**
   * Send a 400 Bad Request error
   */
  badRequest: (res: Response, message: string, details?: unknown): Response => {
    return apiResponse.error(res, message, 400, details, 'BAD_REQUEST');
  },

  /**
   * Send a 401 Unauthorized error
   */
  unauthorized: (res: Response, message = 'Unauthorized'): Response => {
    return apiResponse.error(res, message, 401, undefined, 'UNAUTHORIZED');
  },

  /**
   * Send a 403 Forbidden error
   */
  forbidden: (res: Response, message = 'Forbidden'): Response => {
    return apiResponse.error(res, message, 403, undefined, 'FORBIDDEN');
  },

  /**
   * Send a 404 Not Found error
   */
  notFound: (res: Response, message = 'Resource not found'): Response => {
    return apiResponse.error(res, message, 404, undefined, 'NOT_FOUND');
  },

  /**
   * Send a 500 Internal Server Error
   */
  serverError: (res: Response, message = 'Internal server error', details?: unknown): Response => {
    return apiResponse.error(res, message, 500, details, 'SERVER_ERROR');
  }
};

export type { PaginationMeta, SuccessResponse, ErrorResponse, PaginatedResponse };
