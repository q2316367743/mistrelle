import type { MenuOptions } from '@imengyu/vue3-context-menu'
import Cxt from '@imengyu/vue3-context-menu'
import { isDark } from '@/global/BeanFactory'

export const useContextMenu = (e: MouseEvent, options: Omit<MenuOptions, 'x' | 'y' | 'theme'>) => {
  e.preventDefault()
  e.stopPropagation()
  Cxt.showContextMenu({
    ...options,
    x: e.x,
    y: e.y,
    theme: isDark.value ? 'mac dark' : 'mac'
  })
}
