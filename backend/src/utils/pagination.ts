import { PaginationMeta } from './apiResponse';

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, string>;
}

export function parsePaginationAndFilters(
  query: Record<string, unknown>,
  allowedFilterFields: readonly string[] = [],
  allowedSortFields: readonly string[] = ['createdAt'],
  defaultSortBy = 'createdAt',
  maxLimit = 100
): ParsedPagination {
  const rawPage = Number(query.page ?? 1);
  const rawLimit = Number(query.limit ?? 20);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : 20;
  const skip = (page - 1) * limit;

  const requestedSortBy = typeof query.sortBy === 'string' ? query.sortBy : defaultSortBy;
  const sortBy = allowedSortFields.includes(requestedSortBy) ? requestedSortBy : defaultSortBy;

  const requestedOrder =
    typeof query.sortOrder === 'string' ? query.sortOrder.toLowerCase() : 'desc';
  const sortOrder: 'asc' | 'desc' = requestedOrder === 'asc' ? 'asc' : 'desc';

  const filters: Record<string, string> = {};
  for (const field of allowedFilterFields) {
    const val = query[field];
    if (typeof val === 'string' && val.trim().length > 0) {
      filters[field] = val.trim();
    }
  }

  return { page, limit, skip, sortBy, sortOrder, filters };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
