const net = require('./src/net')
const inject = require('./src/inject')
const fs = require('./src/fs')
const path = require('./src/path')
const iconv = require('./src/IconvAPI')
const crypto = require('./src/CryptoApi')
const axios = require('axios')

window.preload = {
  net,
  inject,
  fs,
  path,
  iconv,
  crypto,
  axios: axios.create({
    adapter: 'http'
  })
}
