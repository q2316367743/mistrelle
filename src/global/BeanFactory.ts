import { useBoolState, useUtoolsColorMode } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'

export const { isDark, colorMode } = useUtoolsColorMode()
export const [collapsed, toggleCollapsed] = useBoolState(false, LocalNameEnum.KEY_APP_COLLAPSED)
