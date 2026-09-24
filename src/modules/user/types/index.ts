/** 用户实体（对应后端 User，接口返回时包在 user_info 里） */
export interface UserInfo {
  id: string
  nick_name: string
  email: string
  avatar: string
}

/** 修改资料的入参（当前后端仅预留昵称字段） */
export interface UpdateProfilePayload {
  nick_name: string
}
