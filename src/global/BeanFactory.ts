import { useBoolState, useColorMode } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'

export const { isDark } = useColorMode()
export const [collapsed, toggleCollapsed] = useBoolState(false, LocalNameEnum.KEY_APP_COLLAPSED)
