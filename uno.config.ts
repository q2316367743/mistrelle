import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  // unocss v66 已移除 important 选项，改用 postprocess 统一为工具类追加 !important：
  // 构建后 uno 位于最先加载的共享样式表，与 TDesign（懒加载 chunk 的 CSS 后置注入）
  // 等单类选择器优先级相同时会被覆盖，故在此提升优先级。
  postprocess: (util) => {
    for (const entry of util.entries) {
      const value = entry[1]
      if (value != null && !String(value).includes('!important')) {
        entry[1] = `${value} !important`
      }
    }
  },
  presets: [
    presetUno({
      dark: 'class'
    })
  ],
  theme: {
    colors: {
      'td-brand': 'var(--td-brand-color)',
      'td-brand-hover': 'var(--td-brand-color-hover)',
      'td-text-primary': 'var(--td-text-color-primary)',
      'td-text-secondary': 'var(--td-text-color-secondary)',
      'td-text-placeholder': 'var(--td-text-color-placeholder)',
      'td-bg-container': 'var(--td-bg-color-container)',
      'td-bg-secondarycontainer': 'var(--td-bg-color-secondarycontainer)',
      'td-bg-component': 'var(--td-bg-color-component)',
      'td-bg-component-hover': 'var(--td-bg-color-component-hover)',
      'td-border-1': 'var(--td-border-level-1-color)',
      'td-border-2': 'var(--td-border-level-2-color)'
    }
  },
  shortcuts: {
    'bg-td-container': 'bg-td-bg-container',
    'bg-td-secondary': 'bg-td-bg-secondarycontainer',
    'text-td-primary': 'text-td-text-primary',
    'text-td-secondary': 'text-td-text-secondary',
    'text-td-placeholder': 'text-td-text-placeholder',
    'border-td-1': 'border-td-border-1',
    'border-td-2': 'border-td-border-2'
  },
  rules: [
    [
      /^abs-(\d+)$/,
      ([, size]) => ({
        position: 'absolute',
        top: `${size}px`,
        left: `${size}px`,
        right: `${size}px`,
        bottom: `${size}px`
      })
    ]
  ]
})
