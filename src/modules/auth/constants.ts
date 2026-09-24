import type { RuleItem } from '@pixelium/web-vue/es'

/**
 * 与后端 `pkg/globalkey/regexp.go` 的邮箱规则保持兼容。
 * 后端原规则为 `^[\w-]+@[\w-]+.[a-zA-Z]{2,4}$`（点号未转义），这里做等价收敛。
 */
export const EMAIL_PATTERN = /^[\w-]+@[\w-]+\.[a-zA-Z]{2,}$/

export const NICKNAME_MAX_LENGTH = 20
export const EMAIL_CODE_LENGTH = 6

/**
 * 人机校验码占位值。
 * 登录接口的 `robot_code` 为必填字段，但后端目前未做校验（todo），
 * 这里统一传占位值，待后端接入真实验证码后再替换。
 */
export const ROBOT_CODE_PLACEHOLDER = '1'

/** 验证码倒计时秒数，规避后端 1 分钟一次的发送限流（code 1014003） */
export const EMAIL_CODE_COOLDOWN = 60

/**
 * 登录表单校验规则。
 * 注意：
 * - `login` 既可以是邮箱，也可以是登录名（后端由 user-rpc 决定），因此**不做邮箱格式校验**；
 * - 密码只要求非空，后端没有任何格式 / 长度要求。
 */
export const LOGIN_RULES: Record<string, RuleItem | RuleItem[]> = {
  login: [{ required: true, message: '请输入邮箱或登录名' }],
  password: [{ required: true, message: '请输入密码' }],
}

/** 注册表单校验规则 */
export const REGISTER_RULES: Record<string, RuleItem | RuleItem[]> = {
  email: [
    { required: true, message: '请输入邮箱' },
    { email: true, message: '邮箱格式不正确' },
  ],
  email_code: [
    { required: true, message: '请输入邮箱验证码' },
    { numberString: true, message: '验证码为 6 位数字' },
    { minLength: EMAIL_CODE_LENGTH, message: '验证码为 6 位数字' },
    { maxLength: EMAIL_CODE_LENGTH, message: '验证码为 6 位数字' },
  ],
  nick_name: [
    { required: true, message: '请输入昵称' },
    { maxLength: NICKNAME_MAX_LENGTH, message: `昵称不超过 ${NICKNAME_MAX_LENGTH} 个字符` },
  ],
  password: [{ required: true, message: '请输入密码' }],
}
