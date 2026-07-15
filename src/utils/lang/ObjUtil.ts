export function objectify<T extends Record<string, any>, K extends string, V, KG extends keyof T>(
  arr: Array<T>,
  key: KG | ((val: T) => K),
  value?: (val: T) => V
): Record<K, V> {
  const keyFunc = typeof key === 'function' ? key : (val: T) => val[key] as K
  const valueFunc = value ? value : (val: T) => val as unknown as V
  return arr.reduce(
    (acc, val) => {
      acc[keyFunc(val)] = valueFunc(val)
      return acc
    },
    {} as Record<K, V>
  )
}
/**
 * Convert an object to a list, mapping each entry
 * into a list item
 */
export function listify<TValue, TKey extends string | number | symbol, KResult>(
  obj: Record<TKey, TValue>,
  toItem: (key: TKey, value: TValue) => KResult
): KResult[] {
  return (Object.keys(obj) as TKey[]).map(key => toItem(key, obj[key]))
}
