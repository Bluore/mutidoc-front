/** 分页请求参数（所有列表接口复用） */
export interface PageQuery {
  page: number
  pageSize: number
}

/** 分页响应结构 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * 后端统一响应信封。
 * request() 会自动校验 code 并解包 data，业务层拿到的就是 T。
 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}
