declare interface PathApi {
  join: (...paths: Array<string>) => string
  resolve: (...paths: Array<string>) => string
  basename: (path: string, ext?: string) => string
  dirname: (path: string) => string
  extname: (path: string) => string
  sep: string
}
