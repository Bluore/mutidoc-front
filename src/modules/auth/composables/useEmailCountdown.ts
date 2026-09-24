import { computed, onScopeDispose, ref } from 'vue'

/**
 * 邮箱验证码倒计时。
 * 后端对同一邮箱有「1 分钟一次」的发送限流（code 1014003），
 * 发送成功后启动倒计时可避免用户频繁点击。
 */
export function useEmailCountdown(seconds = 60) {
  const total = ref(seconds)
  const remaining = ref(0)
  const counting = computed(() => remaining.value > 0)

  let timer: ReturnType<typeof setInterval> | undefined

  function stop(): void {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function start(resetSeconds = seconds): void {
    stop()
    total.value = resetSeconds
    remaining.value = resetSeconds
    timer = setInterval(() => {
      remaining.value -= 1
      if (remaining.value <= 0) stop()
    }, 1000)
  }

  onScopeDispose(stop)

  return { remaining, total, counting, start, stop }
}
