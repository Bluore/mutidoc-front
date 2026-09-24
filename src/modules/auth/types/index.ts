/** 鉴权页模式（登录 / 注册） */
export type AuthMode = 'login' | 'register'

/** 登录请求体（对应 POST /api/user/v1/login） */
export interface LoginPayload {
  /** 登录名：邮箱或用户名皆可 */
  login: string
  password: string
  /**
   * 人机校验码。接口要求必填（可传占位值），后端目前尚未校验（todo 验证 robot）。
   */
  robot_code: string
}

/** 注册请求体（对应 POST /user/v1/user） */
export interface RegisterPayload {
  email: string
  email_code: string
  nick_name: string
  password: string
}

/**
 * 鉴权凭证。
 * 注意：`access_expire` 是**绝对过期时间的 Unix 秒级时间戳**，不是时长。
 */
export interface AuthToken {
  access_token: string
  access_expire: number
}
