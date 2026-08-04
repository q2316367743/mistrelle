import { isNull } from '@/utils/lang/FieldUtil'
import { KeyValueUtil } from '@/utils/native/KeyValueUtil'
import { throttle } from 'es-toolkit'

type initialValueFunc<T> = () => T
type initialValue<T> = T | initialValueFunc<T>

/**
 * 基础类型的键值存储
 */
export function useUtoolsKvStorage<T extends string | number | boolean>(
  key: string,
  initial: initialValue<T>
): Ref<T> {
  const db = KeyValueUtil.getItem<T>(key)
  let source: T
  if (isNull(db)) {
    const initialValue = typeof initial === 'function' ? initial() : initial
    KeyValueUtil.setItem<T>(key, initialValue)
    source = initialValue
  } else {
    source = db!
  }
  const updateValue = throttle((value: T) => {
    KeyValueUtil.setItem<T>(key, toRaw(value))
  }, 300)
  return customRef<T>((track, trigger) => ({
    get(): T {
      track()
      return source
    },
    set(value) {
      source = value
      updateValue(value)
      trigger()
    }
  }))
}
