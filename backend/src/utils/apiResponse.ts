import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
  meta: PaginationMeta | Record<string, unknown> | null;
}

export function apiResponse<T>(
  res: Response,
  statusCode: number,
  message: string,
  data: T,
  meta: PaginationMeta | Record<string, unknown> | null = null
): Response<ApiSuccessEnvelope<T>> {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  });
}
