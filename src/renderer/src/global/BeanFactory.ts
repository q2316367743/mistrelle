import { useColorMode } from '@/hooks'
import { useBoolState } from '@/hooks/UseState'

export const { isDark, mode, setColorMode } = useColorMode()
export const [collapsed, toggleCollapsed] = useBoolState(false)
