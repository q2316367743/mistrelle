import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { TDesignResolver } from 'unplugin-vue-components/resolvers'
import { visualizer } from 'rollup-plugin-visualizer' // 引入插件

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        $: resolve('src/main/src'),
        '~': resolve('src/preload/src'),
        '@resources': resolve('resources'),
        '@common': resolve('src/common')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '~': resolve('src/preload/src'),
        $: resolve('src/main/src'),
        '@common': resolve('src/common')
      }
    },
    // 双入口：index=主窗口全量 API，buddy=伙伴窗口仅 inject/serial/trafficLight（产物 out/preload/buddy.js）
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          buddy: resolve('src/preload/buddy.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@common': resolve('src/common')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          buddy: resolve('src/renderer/buddy.html')
        }
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
    server: {
      port: 7743
    }
  }
})
