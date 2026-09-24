/** 日期时间格式化：2026-09-24 20:30 */
export function formatDateTime(input: string | number | Date): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '-'

  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join(' ')
}

/** 后端返回的是秒级 Unix 时间戳，转成毫秒后再格式化 */
export function formatUnixSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-'
  return formatDateTime(seconds * 1000)
}
