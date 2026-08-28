<template>
  <article class="sp" :class="`sp--${variant}`" :style="cssVars">
    <div class="sp__cover">
      <span class="sp__cover-circle" />
      <span class="sp__cover-shape" />
      <span v-if="variant === 'compact'" class="sp__cover-btn">按钮</span>
    </div>
    <div class="sp__body">
      <div class="sp__head">
        <span class="sp__title" :title="style.name">{{ style.name }}</span>
        <span v-if="isSystem" class="sp__badge">内置</span>
        <slot name="actions" />
      </div>
      <p class="sp__desc">{{ style.description }}</p>
      <template v-if="variant === 'full'">
        <div class="sp__actions">
          <span class="sp__btn sp__btn--primary">开始使用</span>
          <span class="sp__btn sp__btn--ghost">了解更多</span>
        </div>
        <p v-if="signature" class="sp__sign" :title="signature">{{ signature }}</p>
      </template>
      <div v-else class="sp__meta">
        <span class="sp__cat">{{ categoryLabel }}</span>
        <span v-for="t in style.tags.slice(0, 3)" :key="t" class="sp__tag">#{{ t }}</span>
      </div>
    </div>
  </article>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import {
  AiDesignStyle,
  AiDesignStyleItem,
  buildAiDesignStyleTypography,
  buildAiDesignStyleTokens,
  getDesignStyleCategoryLabel,
  normalizeDesignStyleCategory
} from '@/entity'

/**
 * 按风格规范渲染的「风格卡片面」：配色 / 字体 / 圆角 / 边框 / 阴影 / 留白全部来自风格数据。
 * 属风格规范的数据渲染（同画布样张性质），不使用 tdesign 组件；交互控件由外层壳承载。
 */
const props = withDefaults(
  defineProps<{
    style: AiDesignStyleItem | AiDesignStyle
    /** compact：列表卡片（封面内嵌装饰按钮）；full：详情大样张（正文按钮组 + 签名落款） */
    variant?: 'compact' | 'full'
    /** 规范尺寸缩放系数，缺省按 variant 取值 */
    scale?: number
  }>(),
  { variant: 'compact', scale: undefined }
)

const isSystem = computed(() => 'isSystem' in props.style && props.style.isSystem)

const signature = computed(() => ('signature' in props.style && props.style.signature) || '')

const categoryLabel = computed(() =>
  getDesignStyleCategoryLabel(normalizeDesignStyleCategory(props.style.category))
)

const effScale = computed(() => props.scale ?? (props.variant === 'compact' ? 0.6 : 1))

/** 按 W3C 相对亮度选主色上的可读文字色（黑 / 白），兜底返回白 */
const contrastOn = (color: string): string => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return '#ffffff'
  const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum >= 0.5 ? '#1f2329' : '#ffffff'
}

/** 留白档位 → 内边距密度系数（35 紧凑 / 55 均衡 / 70 疏朗） */
const whitespaceCoef = computed(() => {
  const v = props.style.whitespaceRatio
  return v === 35 ? 0.85 : v === 70 ? 1.2 : 1
})

/** 规范数据 → --sp-* CSS 变量（尺寸 = 规范值 × scale，留白档位影响间距密度） */
const cssVars = computed<Record<string, string>>(() => {
  const s = effScale.value
  const p = props.style.colorPalette
  const t = buildAiDesignStyleTokens(props.style.tokens)
  const typo = buildAiDesignStyleTypography(props.style.typography)
  const ws = whitespaceCoef.value
  const b = t.border
  const shadow = (blurCoef: number, lift: number) =>
    t.shadow.enabled
      ? `${t.shadow.offsetX * s}px ${(t.shadow.offsetY + lift) * s}px ${t.shadow.blur * blurCoef * s}px ${t.shadow.color}`
      : 'none'
  return {
    '--sp-bg': p.background,
    '--sp-surface': p.surface,
    '--sp-primary': p.primary,
    '--sp-secondary': p.secondary,
    '--sp-text': p.text_primary,
    '--sp-text-2': p.text_secondary,
    '--sp-on-primary': contrastOn(p.primary),
    '--sp-border': b.style === 'none' ? 'none' : `${b.width * s}px ${b.style} ${b.color}`,
    '--sp-radius': `${t.radius.medium * s}px`,
    '--sp-btn-radius': t.radius.pill ? '999px' : `${t.radius.small * s}px`,
    '--sp-shadow': shadow(1, 0),
    '--sp-shadow-hover': shadow(1.6, 4),
    '--sp-motion': `${t.motion.duration}ms ${t.motion.easing}`,
    '--sp-pad': `${t.spacing.cardPadding * s * ws}px`,
    '--sp-gap': `${t.spacing.sectionGap * s * ws}px`,
    '--sp-title-font': typo.heading.font || 'inherit',
    '--sp-title-size': `${typo.heading.size * s}px`,
    '--sp-title-weight': String(typo.heading.weight),
    '--sp-title-lh': String(typo.heading.lineHeight),
    '--sp-body-font': typo.body.font || 'inherit',
    '--sp-body-size': `${typo.body.size * s}px`,
    '--sp-body-weight': String(typo.body.weight),
    '--sp-body-lh': String(typo.body.lineHeight),
    '--sp-cap-font': typo.caption.font || 'inherit',
    '--sp-cap-size': `${typo.caption.size * s}px`,
    '--sp-cap-weight': String(typo.caption.weight),
    '--sp-cap-lh': String(typo.caption.lineHeight)
  }
})
</script>

<style scoped lang="less">
.sp {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--sp-text);
  background: var(--sp-bg);
  border: var(--sp-border);
  border-radius: var(--sp-radius);
  box-shadow: var(--sp-shadow);
  transition:
    box-shadow var(--sp-motion),
    transform var(--sp-motion);

  &--compact:hover {
    transform: translateY(-2px);
    box-shadow: var(--sp-shadow-hover);
  }
}

.sp__cover {
  position: relative;
  aspect-ratio: 21 / 8;
  background: var(--sp-surface);
  border-bottom: var(--sp-border);
  overflow: hidden;

  .sp--full & {
    aspect-ratio: 21 / 7;
  }
}

.sp__cover-circle {
  position: absolute;
  top: -45%;
  right: -6%;
  width: 68%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--sp-primary);
  opacity: 0.9;
}

.sp__cover-shape {
  position: absolute;
  bottom: -32%;
  left: 20%;
  width: 32%;
  aspect-ratio: 1;
  border-radius: 24%;
  background: var(--sp-secondary);
  opacity: 0.55;
}

.sp__cover-btn {
  position: absolute;
  left: var(--sp-pad);
  bottom: var(--sp-pad);
  padding: calc(var(--sp-pad) * 0.3) calc(var(--sp-pad) * 0.75);
  font-family: var(--sp-body-font);
  font-size: var(--sp-body-size);
  font-weight: var(--sp-body-weight);
  line-height: var(--sp-body-lh);
  color: var(--sp-on-primary);
  background: var(--sp-primary);
  border-radius: var(--sp-btn-radius);
}

.sp__body {
  display: flex;
  flex-direction: column;
  gap: calc(var(--sp-gap) * 0.5);
  padding: var(--sp-pad);
}

.sp__head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.sp__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-family: var(--sp-title-font);
  font-size: var(--sp-title-size);
  font-weight: var(--sp-title-weight);
  line-height: var(--sp-title-lh);
  color: var(--sp-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp__badge {
  flex-shrink: 0;
  padding: 0 8px;
  font-family: var(--sp-cap-font);
  font-size: var(--sp-cap-size);
  font-weight: var(--sp-cap-weight);
  line-height: var(--sp-cap-lh);
  color: var(--sp-text-2);
  border: 1px solid currentColor;
  border-radius: var(--sp-btn-radius);
}

.sp__desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  font-family: var(--sp-body-font);
  font-size: var(--sp-body-size);
  font-weight: var(--sp-body-weight);
  line-height: var(--sp-body-lh);
  color: var(--sp-text-2);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.sp__actions {
  display: flex;
  gap: calc(var(--sp-pad) * 0.5);
}

.sp__btn {
  padding: calc(var(--sp-pad) * 0.35) calc(var(--sp-pad) * 0.8);
  font-family: var(--sp-body-font);
  font-size: var(--sp-body-size);
  font-weight: var(--sp-body-weight);
  line-height: var(--sp-body-lh);
  border-radius: var(--sp-btn-radius);

  &--primary {
    color: var(--sp-on-primary);
    background: var(--sp-primary);
  }

  &--ghost {
    color: var(--sp-text);
    border: var(--sp-border);
  }
}

.sp__sign {
  margin: 0;
  overflow: hidden;
  font-family: var(--sp-cap-font);
  font-size: var(--sp-cap-size);
  font-weight: var(--sp-cap-weight);
  line-height: var(--sp-cap-lh);
  color: var(--sp-text-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp__meta {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--sp-pad) * 0.5);
  align-items: center;
  min-width: 0;
  font-family: var(--sp-cap-font);
  font-size: var(--sp-cap-size);
  font-weight: var(--sp-cap-weight);
  line-height: var(--sp-cap-lh);
  color: var(--sp-text-2);
}

.sp__cat {
  padding: 0 8px;
  border: 1px solid currentColor;
  border-radius: var(--sp-btn-radius);
}
</style>
