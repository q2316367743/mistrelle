const STORAGE_KEY = 'mistrelle-color-mode'

export type ColorModeName = 'light' | 'dark'

function readStoredMode(): ColorModeName | null {
  const value = localStorage.getItem(STORAGE_KEY)
  if (value === 'light' || value === 'dark') return value
  return null
}

export const useColorMode = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const stored = readStoredMode()
  const isDark = ref(stored ? stored === 'dark' : mediaQuery.matches)

  function renderColorMode() {
    document.documentElement.setAttribute('theme-mode', isDark.value ? 'dark' : 'light')
  }

  function setColorMode(mode: ColorModeName) {
    isDark.value = mode === 'dark'
    localStorage.setItem(STORAGE_KEY, mode)
    renderColorMode()
  }

  mediaQuery.addEventListener('change', (e: MediaQueryListEvent) => {
    if (readStoredMode()) return
    isDark.value = e.matches
    renderColorMode()
  })

  renderColorMode()

  return { isDark, setColorMode }
}
