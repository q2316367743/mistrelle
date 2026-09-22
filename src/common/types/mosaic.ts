/**
 * 图片遮盖（马赛克 / 毛玻璃）共享契约：main 的 `sharpMask` 与渲染层（弹窗预览、画布叠加层）
 * 必须用同一套默认值与取值范围，故常量与类型放共享层。
 * 约定：每个 type 下方紧跟同名 Options（Array<CommonSelect<type>>）作名称映射。
 */
import { CommonSelect } from './CommonSelect'

/** 遮盖方式：mosaic 马赛克（像素化方块，块边长可调）/ blur 毛玻璃（高斯模糊，模糊半径可调） */
export type ImageCoverStyle = 'mosaic' | 'blur'

/** 遮盖方式名称映射（弹窗单选 / 属性面板文案共用） */
export const ImageCoverStyleOptions: Array<CommonSelect<ImageCoverStyle>> = [
  { value: 'mosaic', label: '马赛克' },
  { value: 'blur', label: '毛玻璃' }
]

/** 马赛克像素块边长缺省（px）：按此粒度对整图粗化后贴回区域，越小越细腻 */
export const MOSAIC_CELL_PX = 14

/** 马赛克像素块边长可调范围（px，含端点） */
export const MOSAIC_CELL_RANGE: readonly [number, number] = [4, 32]

/** 毛玻璃模糊半径缺省（px，等价 CSS `blur()` 半径 / sharp `blur()` sigma） */
export const MOSAIC_BLUR_PX = 8

/** 毛玻璃模糊半径可调范围（px，含端点） */
export const MOSAIC_BLUR_RANGE: readonly [number, number] = [2, 24]
