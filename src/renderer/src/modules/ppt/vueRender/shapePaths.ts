/**
 * Shape 预设形状 → SVG path（预览渲染用，viewBox 0 0 100 100，非等比拉伸与 PowerPoint
 * 预设几何行为一致）。预览覆盖常用子集，未收录形状回退 rect（导出侧仍按原名映射
 * PptxGenJS 预设，预览/导出仅在罕见形状上有差异）。
 */

/** shapeType（含常见别名）→ 100×100 坐标系 path 数据；rect/roundRect/ellipse 走 CSS 不在此表 */
export const SHAPE_PATHS: Record<string, string> = {
  triangle: 'M50,0 L100,100 L0,100 Z',
  diamond: 'M50,0 L100,50 L50,100 L0,50 Z',
  star: 'M50,2 L61.3,34.5 L95.7,35.2 L68.3,55.9 L78.2,88.8 L50,69.2 L21.8,88.8 L31.7,55.9 L4.3,35.2 L38.7,34.5 Z',
  star5: 'M50,2 L61.3,34.5 L95.7,35.2 L68.3,55.9 L78.2,88.8 L50,69.2 L21.8,88.8 L31.7,55.9 L4.3,35.2 L38.7,34.5 Z',
  heart:
    'M50,88 C20,64 4,46 4,28 C4,12 16,4 28,4 C38,4 46,10 50,18 C54,10 62,4 72,4 C84,4 96,12 96,28 C96,46 80,64 50,88 Z',
  pentagon: 'M50,2 L98,38 L80,94 L20,94 L2,38 Z',
  hexagon: 'M25,3 L75,3 L98,50 L75,97 L25,97 L2,50 Z',
  chevron: 'M2,2 L55,2 L98,50 L55,98 L2,98 L45,50 Z',
  rightArrow: 'M2,35 H55 V12 L98,50 55,88 V65 H2 Z',
  arrow: 'M2,35 H55 V12 L98,50 55,88 V65 H2 Z',
  parallelogram: 'M22,0 L100,0 L78,100 L0,100 Z',
  trapezoid: 'M22,0 L78,0 L100,100 L0,100 Z',
  cross: 'M36,2 H64 V36 H98 V64 H64 V98 H36 V64 H2 V36 H36 Z',
  plus: 'M36,2 H64 V36 H98 V64 H64 V98 H36 V64 H2 V36 H36 Z'
}

/** 归一化 shapeType → path（含 star5/arrow/plus 等别名；未收录返回 null） */
export const shapePath = (shapeType: string): string | null => SHAPE_PATHS[shapeType] ?? null

/** 圆形/椭圆类形状（CSS border-radius 50% 实现） */
export const isEllipseShape = (shapeType: string): boolean =>
  shapeType === 'ellipse' || shapeType === 'circle' || shapeType === 'oval'
