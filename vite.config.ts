import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vite'
import path from 'path'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { TDesignResolver } from 'unplugin-vue-components/resolvers'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'
import { visualizer } from 'rollup-plugin-visualizer' // 引入插件

function _resolve(dir: string) {
  return path.resolve(__dirname, dir)
}

export default defineConfig({
  resolve: {
    alias: {
      '@': _resolve('src')
    }
  },
  plugins: [
    vue(),
    vueJsx(),
    UnoCSS(),
    AutoImport({
      resolvers: [
        TDesignResolver({
          library: 'vue-next'
        })
      ],
      imports: ['vue', '@vueuse/core', 'vue-router'],
      eslintrc: {
        enabled: true
      }
    }),
    Components({
      resolvers: [
        TDesignResolver({
          library: 'vue-next'
        })
      ]
    }),
    typeof monacoEditorPlugin === 'function'
      ? monacoEditorPlugin({})
      : // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        monacoEditorPlugin.default({}),
    visualizer({
      // 配置项（可选，下面是常用配置）
      open: false, // 打包后自动打开浏览器展示图表
      filename: 'stats.html', // 生成分析图表的文件名
      gzipSize: true, // 显示 Gzip 压缩后的大小
      brotliSize: true, // 显示 Brotli 压缩后的大小
      emitFile: false // 是否将生成的文件输出到打包目录中（false 表示不输出，仅临时生成）
    })
  ],
  base: './',
  build: {
    outDir: 'src-utools/dist'
  },
  server: {
    port: 7743
  }
})
