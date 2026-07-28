import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import {defineConfig} from "vite";
import path from "path";
import UnoCSS from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite';
import {TDesignResolver} from 'unplugin-vue-components/resolvers';
import monacoEditorPlugin from 'vite-plugin-monaco-editor'
import { fileViewerRenderers } from '@file-viewer/vite-plugin'

function _resolve(dir: string) {
  return path.resolve(__dirname, dir);
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
    fileViewerRenderers({
      preset: 'office',
      copyAssets: true
    })
  ],
  base: './',
  build: {
    outDir: 'src-utools/dist'
  }
})
