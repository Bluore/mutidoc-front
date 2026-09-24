/**
 * 统一业务异常：http 层失败与「code !== 0」都会抛出它，
 * 业务层只需 catch (e) 后读取 message 即可。
 */
export class ApiError extends Error {
  readonly code: number
  readonly status?: number

  constructor(message: string, code = -1, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}
