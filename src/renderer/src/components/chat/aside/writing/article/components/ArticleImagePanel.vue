<template>
  <div class="article-image-panel">
    <section class="panel-section">
      <div class="section-head">
        <span class="section-title">封面</span>
        <div class="section-actions">
          <t-tooltip :content="canGenerate ? 'AI 生成封面' : '登录后可使用生图'">
            <t-button
              size="small"
              variant="text"
              theme="primary"
              :disabled="!canGenerate"
              @click="genCover"
            >
              <template #icon><ai-icon /></template>
              生成
            </t-button>
          </t-tooltip>
          <t-button size="small" variant="text" theme="primary" @click="uploadCover">
            <template #icon><upload-icon /></template>
            上传
          </t-button>
          <t-button v-if="article.cover" size="small" variant="text" theme="danger" @click="emit('cover', undefined)">
            <template #icon><delete-icon /></template>
            移除
          </t-button>
        </div>
      </div>
      <div class="cover-box" :style="{ aspectRatio: coverRatio }">
        <img v-if="article.cover" :src="assetHref(article.cover)" alt="封面" />
        <span v-else class="cover-empty">暂无封面</span>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-head">
        <span class="section-title">插图<span class="section-count">{{ images.length }}</span></span>
        <div class="section-actions">
          <t-tooltip :content="canGenerate ? 'AI 生成插图' : '登录后可使用生图'">
            <t-button
              size="small"
              variant="text"
              theme="primary"
              :disabled="!canGenerate"
              @click="genImage"
            >
              <template #icon><ai-icon /></template>
              生成
            </t-button>
          </t-tooltip>
          <t-button size="small" variant="text" theme="primary" @click="uploadImage">
            <template #icon><upload-icon /></template>
            上传
          </t-button>
        </div>
      </div>
      <div v-if="images.length" class="gallery">
        <div v-for="img in images" :key="img" class="gallery-cell">
          <img :src="assetHref(img)" alt="插图" />
          <div class="cell-mask">
            <t-button size="small" variant="text" theme="primary" @click="emit('insert', img)">插入</t-button>
            <t-button size="small" variant="text" theme="primary" @click="emit('cover', img)">封面</t-button>
            <t-button size="small" variant="text" theme="danger" @click="emit('remove-image', img)">移除</t-button>
          </div>
        </div>
      </div>
      <div v-else class="gallery-empty">暂无插图，可生成 / 上传 / 在正文粘贴图片（自动登记）</div>
    </section>
  </div>
</template>
<script lang="ts" setup>
import { AiIcon, DeleteIcon, UploadIcon } from 'tdesign-icons-vue-next'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import type { ArticleItem, ArticlePlatform } from '@/windows/main/modules/tool/components/article/articleTypes'
import { copyImageToAssets } from '@/windows/main/modules/tool/components/article/imageRef'
import { openArticleImageGen } from './ArticleImageGenDialog'
import { MessageUtil } from '@/utils/modal'

const props = defineProps<{
  article: ArticleItem
  /** 项目根（articles/ 目录），封面 / 插图登记路径与展示 URL 的基准 */
  root: string
  /** 配图目录（assets/ 绝对路径，上传与 AI 生成产物落盘于此） */
  assetsDir: string
}>()

const emit = defineEmits<{
  /** 设置 / 清除封面（rel 为相对 articles/ 的路径，undefined = 清除） */
  (e: 'cover', rel: string | undefined): void
  /** 新增登记插图（相对 articles/ 的路径列表） */
  (e: 'add-images', rels: string[]): void
  (e: 'remove-image', rel: string): void
  /** 把插图插入正文光标处 */
  (e: 'insert', rel: string): void
}>()

const images = computed(() => props.article.images ?? [])
/** 生图门控：登录即可用（直出接口，积分由服务端扣减） */
const canGenerate = computed(() => useAuthStore().status === 'signed-in')

/** 封面展示比例随平台：公众号 900×383、小红书 3:4、知乎与其他 16:9 */
const coverRatio = computed(() => {
  const platform: ArticlePlatform = props.article.platform
  if (platform === '公众号') return '900 / 383'
  if (platform === '小红书') return '3 / 4'
  return '16 / 9'
})

/** 登记路径（相对 articles/）→ 展示 URL */
const assetHref = (rel: string): string => window.preload.net.pathToHref(window.preload.path.join(props.root, rel))

/** 系统 选图 → 拷入 assets → 上抛登记 / 设为封面 */
const pickLocalImage = async (prefix: string, apply: (rel: string) => void) => {
  const selected = await window.preload.inject.dialog.open({
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  })
  const src = selected?.[0]
  if (!src) return
  try {
    const absPath = await copyImageToAssets(props.assetsDir, src, prefix)
    apply(`assets/${window.preload.path.basename(absPath)}`)
  } catch {
    MessageUtil.error('图片复制失败')
  }
}

const genCover = () =>
  openArticleImageGen({
    kind: 'cover',
    platform: props.article.platform,
    assetsDir: props.assetsDir,
    onSuccess: (absPath) => emit('cover', `assets/${window.preload.path.basename(absPath)}`)
  })

const genImage = () =>
  openArticleImageGen({
    kind: 'image',
    platform: props.article.platform,
    assetsDir: props.assetsDir,
    onSuccess: (absPath) => emit('add-images', [`assets/${window.preload.path.basename(absPath)}`])
  })

const uploadCover = () => pickLocalImage('cover', (rel) => emit('cover', rel))
const uploadImage = () => pickLocalImage('image', (rel) => emit('add-images', [rel]))
</script>
<style scoped lang="less">
.article-image-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: var(--td-font-size-body-medium);
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.section-count {
  margin-left: 4px;
  font-weight: 400;
  color: var(--td-text-color-placeholder);
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cover-box {
  width: 100%;
  border-radius: var(--td-radius-medium);
  border: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-secondarycontainer);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.cover-empty {
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-placeholder);
}

.gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.gallery-cell {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: var(--td-radius-medium);
  border: 1px solid var(--td-border-level-1-color);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.cell-mask {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px 0;
  background: var(--td-bg-color-container);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.gallery-cell:hover .cell-mask {
  opacity: 1;
}

.gallery-empty {
  padding: 16px 0;
  text-align: center;
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-placeholder);
}
</style>
