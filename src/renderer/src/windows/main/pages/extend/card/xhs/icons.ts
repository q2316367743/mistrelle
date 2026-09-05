/** 参考站（jinsan.ok.kimi.link）所用 lucide 图标的节点数据，1:1 提取自其构建产物 */

export type IconNode = [tag: string, attrs: Record<string, string>]

const palette: Array<IconNode> = [
  ['circle', { cx: '13.5', cy: '6.5', r: '.5', fill: 'currentColor' }],
  ['circle', { cx: '17.5', cy: '10.5', r: '.5', fill: 'currentColor' }],
  ['circle', { cx: '8.5', cy: '7.5', r: '.5', fill: 'currentColor' }],
  ['circle', { cx: '6.5', cy: '12.5', r: '.5', fill: 'currentColor' }],
  ['path', { d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z' }]
]

export const ICON_NODES: Record<string, Array<IconNode>> = {
  palette,
  bold: [['path', { d: 'M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8' }]],
  calendar: [
    ['path', { d: 'M8 2v4' }],
    ['path', { d: 'M16 2v4' }],
    ['rect', { width: '18', height: '18', x: '3', y: '4', rx: '2' }],
    ['path', { d: 'M3 10h18' }]
  ],
  clipboardPaste: [
    ['path', { d: 'M11 14h10' }],
    ['path', { d: 'M16 4h2a2 2 0 0 1 2 2v1.344' }],
    ['path', { d: 'm17 18 4-4-4-4' }],
    ['path', { d: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113' }],
    ['rect', { x: '8', y: '2', width: '8', height: '4', rx: '1' }]
  ],
  copyright: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M14.83 14.83a4 4 0 1 1 0-5.66' }]
  ],
  download: [
    ['path', { d: 'M12 15V3' }],
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['path', { d: 'm7 10 5 5 5-5' }]
  ],
  fileText: [
    ['path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['path', { d: 'M10 9H8' }],
    ['path', { d: 'M16 13H8' }],
    ['path', { d: 'M16 17H8' }]
  ],
  fileUp: [
    ['path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['path', { d: 'M12 12v6' }],
    ['path', { d: 'm15 15-3-3-3 3' }]
  ],
  highlighter: [
    ['path', { d: 'm9 11-6 6v3h9l3-3' }],
    ['path', { d: 'm22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4' }]
  ],
  imagePlus: [
    ['path', { d: 'M16 5h6' }],
    ['path', { d: 'M19 2v6' }],
    ['path', { d: 'M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5' }],
    ['path', { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' }],
    ['circle', { cx: '9', cy: '9', r: '2' }]
  ],
  imageUp: [
    ['path', { d: 'M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21' }],
    ['path', { d: 'm14 19.5 3-3 3 3' }],
    ['path', { d: 'M17 22v-5.5' }],
    ['circle', { cx: '9', cy: '9', r: '2' }]
  ],
  loaderCircle: [['path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' }]],
  plus: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'M12 5v14' }]
  ],
  type: [
    ['path', { d: 'M12 4v16' }],
    ['path', { d: 'M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2' }],
    ['path', { d: 'M9 20h6' }]
  ],
  user: [
    ['path', { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '12', cy: '7', r: '4' }]
  ],
  x: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }]
  ]
}
