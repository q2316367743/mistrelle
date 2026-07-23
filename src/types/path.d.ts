declare interface PathApi {
  join: (...paths: Array<string>) => string
  resolve: (...paths: Array<string>) => string
}
