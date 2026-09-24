import { onScopeDispose, ref } from 'vue'

/**
 * 防抖函数（组合式）。
 * 在组件作用域内使用时会自动在销毁时清理定时器。
 *
 * @example
 * const { run } = useDebounceFn((value: string) => search(value), 300)
 */
export function useDebounceFn<T extends (...args: never[]) => void>(fn: T, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const pending = ref(false)

  function cancel() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
      pending.value = false
    }
  }

  function run(...args: Parameters<T>) {
    cancel()
    pending.value = true
    timer = setTimeout(() => {
      pending.value = false
      timer = undefined
      fn(...args)
    }, wait)
  }

  onScopeDispose(cancel)

  return { run, cancel, pending }
}
