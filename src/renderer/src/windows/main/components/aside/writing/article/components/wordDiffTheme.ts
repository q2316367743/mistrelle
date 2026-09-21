import * as monaco from 'monaco-editor'

/**
 * 只高亮变化字符的 diff 主题：整行背景透明，字符级 diff 背景继承内置主题（vs / vs-dark）。
 * monaco 主题是全局态：定义后须经 monaco.editor.setTheme(name) 生效，
 * diff 场景用毕须还原内置主题，避免行背景透明的影响外溢。
 */
export const wordDiffTheme = (dark: boolean): string => {
  const name = dark ? 'word-diff-dark' : 'word-diff-light'
  monaco.editor.defineTheme(name, {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors: {
      'diffEditor.insertedLineBackground': '#00000000',
      'diffEditor.removedLineBackground': '#00000000'
    }
  })
  return name
}
