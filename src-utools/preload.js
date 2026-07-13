const net = require('./src/net')

if (window.ztools) window.utools = window.ztools

window.preload = {
  getPlatform: () => {
    if (window.ztools) {
      return 'ZTools'
    } else if (window.utools) {
      return 'utools'
    }
    return 'browser'
  },
  net
}
