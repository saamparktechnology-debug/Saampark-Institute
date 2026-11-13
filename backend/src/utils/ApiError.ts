export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_UNAUTHORIZED'
  | 'OTP_EXPIRED_OR_INVALID'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ACCOUNT_SUSPENDED'
  | 'INSTALLMENT_OVERDUE_LOCKED'
  | 'ROLE_PANEL_MISMATCH'
  | 'PERMISSION_DENIED'
  | 'RESOURCE_FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'DUPLICATE_RESOURCE'
  | 'BUSINESS_RULE_VIOLATION'
  | 'INSUFFICIENT_WALLET_BALANCE'
  | 'ATTENDANCE_CODE_EXPIRED'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'INTERNAL_SERVER_ERROR';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly errors: Record<string, unknown> | unknown[] | null;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    errors: Record<string, unknown> | unknown[] | null = null,
    isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(
    message: string,
    code: ErrorCode = 'VALIDATION_ERROR',
    errors: Record<string, unknown> | null = null
  ) {
    return new ApiError(400, code, message, errors);
  }

  static unauthorized(
    message = 'Authentication required',
    code: ErrorCode = 'AUTH_UNAUTHORIZED'
  ) {
    return new ApiError(401, code, message);
  }

  static forbidden(
    message = 'You do not have permission to access this resource',
    code: ErrorCode = 'RESOURCE_FORBIDDEN'
  ) {
    return new ApiError(403, code, message);
  }

  static notFound(
    message = 'Requested resource not found',
    code: ErrorCode = 'RESOURCE_NOT_FOUND'
  ) {
    return new ApiError(404, code, message);
  }

  static conflict(message: string, code: ErrorCode = 'DUPLICATE_RESOURCE') {
    return new ApiError(409, code, message);
  }

  static unprocessable(
    message: string,
    code: ErrorCode = 'BUSINESS_RULE_VIOLATION'
  ) {
    return new ApiError(422, code, message);
  }
}
