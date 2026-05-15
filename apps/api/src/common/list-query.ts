export interface ListQueryOptions {
  defaultPageSize?: number
  maxPageSize?: number
}

export interface Pagination {
  page: number
  pageSize: number
  skip: number
  take: number
}

export function parsePagination(
  query: Record<string, unknown>,
  options: ListQueryOptions = {}
): Pagination {
  const defaultPageSize = options.defaultPageSize ?? 20
  const maxPageSize = options.maxPageSize ?? 100
  const page = parsePositiveInteger(query.page, 1)
  const requestedPageSize = parsePositiveInteger(query.pageSize, defaultPageSize)
  const pageSize = Math.min(requestedPageSize, maxPageSize)

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  }
}

export function parseSearch(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseSortDirection(value: unknown): 'asc' | 'desc' {
  return value === 'asc' ? 'asc' : 'desc'
}

export function parseEnumFilter<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): T | undefined {
  return typeof value === 'string' && allowedValues.includes(value as T)
    ? (value as T)
    : undefined
}

function parsePositiveInteger(value: unknown, fallback: number) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}
