/**
 * drizzle-kit 迁移配置：从 main 进程 schema 生成 SQL 迁移文件。
 * 迁移文件输出到 resources/drizzle（electron-vite 主进程 publicDir，
 * 随应用打包并 asarUnpack，运行时由 main 的 client.ts 经 migrate() 应用）。
 */
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/src/db/schema/index.ts',
  out: './resources/drizzle',
  strict: true
})