import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      errors: err.errors,
    });
  }

  // Handle Prisma unique constraint errors safely without leaking raw SQL
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  ) {
    return res.status(409).json({
      success: false,
      message: "A record with the provided unique identifier already exists.",
      code: "DUPLICATE_RESOURCE",
      errors: null,
    });
  }

  // Log unexpected internal errors server-side with request correlation ID
  if (env.NODE_ENV !== "test") {
    console.error(
      `[INTERNAL_ERROR] requestId=${req.requestId || "unknown"}`,
      err,
    );
  }

  return res.status(500).json({
    success: false,
    message: "An unexpected internal error occurred. Please try again later.",
    code: "INTERNAL_SERVER_ERROR",
    errors: null,
  });
}

export function notFoundHandler(req: Request, res: Response): Response {
  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: "RESOURCE_NOT_FOUND",
    errors: null,
  });
}
