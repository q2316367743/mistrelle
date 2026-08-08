export interface CommonSelect<V = string, K = string> {
  value: V
  label: K

  disabled?: boolean
  desc?: string
}
