import { useColorMode } from '@/hooks'
import { useBoolState } from '@/hooks/UseState'

export const { isDark } = useColorMode()
export const [collapsed, toggleCollapsed] = useBoolState(false)
