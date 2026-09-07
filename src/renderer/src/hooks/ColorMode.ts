const STORAGE_KEY = 'mistrelle-color-mode'

export type ColorModeName = 'system' | 'light' | 'dark'

function readStoredMode(): ColorModeName | null {
  const value = localStorage.getItem(STORAGE_KEY)
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return null
}

export const useColorMode = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const stored = readStoredMode()
  const mode = ref<ColorModeName>(stored ?? 'system')
  const isDark = ref(stored === 'dark' || (stored !== 'light' && mediaQuery.matches))

  function renderColorMode() {
    document.documentElement.setAttribute('theme-mode', isDark.value ? 'dark' : 'light')
  }

  function syncIsDark(nextMode: ColorModeName) {
    isDark.value = nextMode === 'dark' || (nextMode === 'system' && mediaQuery.matches)
    renderColorMode()
  }

  function setColorMode(next: ColorModeName) {
    mode.value = next
    localStorage.setItem(STORAGE_KEY, next)
    syncIsDark(next)
  }

  mediaQuery.addEventListener('change', (e: MediaQueryListEvent) => {
    if (mode.value === 'system') {
      isDark.value = e.matches
      renderColorMode()
    }
  })

  renderColorMode()

  return { isDark, mode, setColorMode }
}
