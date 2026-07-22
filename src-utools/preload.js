const net = require('./src/net')
const inject = require('./src/inject')
const fs = require('./src/fs')
const path = require('./src/path')
const iconv = require('./src/IconvAPI')
const crypto = require('./src/CryptoApi')
const zip = require('./src/zip')
const shellExec = require('./src/shellExec')
const axios = require('axios')

window.preload = {
  net,
  inject,
  fs,
  path,
  iconv,
  crypto,
  zip,
  shellExec,
  axios: axios.create({
    adapter: 'http'
  })
}
