export interface PaginationParams {
    page: number
    limit: number
    skip: number
  }
  
  export const getPagination = (query: Record<string, unknown>): PaginationParams => {
    const page = Math.max(1, parseInt(query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 10))
    const skip = (page - 1) * limit
    return { page, limit, skip }
  }
  
  export const getTotalPages = (total: number, limit: number) =>
    Math.ceil(total / limit)