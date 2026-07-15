const net = require('./src/net')
const inject = require('./src/inject')
const fs = require('./src/fs')

if (window.ztools) window.utools = window.ztools

window.preload = {
  net,
  inject,
  fs
}
