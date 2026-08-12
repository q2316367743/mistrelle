export const useColorMode = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const isDark = ref(mediaQuery.matches)

  function renderColorMode() {
    document.documentElement.setAttribute('theme-mode', isDark.value ? 'dark' : 'light')
  }

  mediaQuery.addEventListener('change', (e: MediaQueryListEvent) => {
    isDark.value = e.matches
    renderColorMode()
  })

  renderColorMode()

  return { isDark }
}
