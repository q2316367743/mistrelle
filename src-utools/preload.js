const net = require('./src/net')
const inject = require('./src/inject')
const fs = require('./src/fs')
const path = require('./src/path')
const axios = require('axios')

window.preload = {
  net,
  inject,
  fs,
  path,
  axios: axios.create({
    adapter: 'http'
  })
}
