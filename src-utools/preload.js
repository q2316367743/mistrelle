const net = require('./src/net')
const inject = require('./src/inject')
const fs = require('./src/fs')
const axios = require('axios')

window.preload = {
  net,
  inject,
  fs,
  axios: axios.create({
    adapter: 'http'
  })
}
