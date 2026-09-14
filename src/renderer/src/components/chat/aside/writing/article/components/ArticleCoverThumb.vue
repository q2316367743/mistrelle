<template>
  <t-popup trigger="click" placement="bottom-left" :disabled="locked" destroy-on-close>
    <div class="cover-thumb" title="设置封面">
      <img v-if="cover" :src="assetHref(cover)" alt="封面" />
      <image-icon v-else class="cover-thumb__empty" />
    </div>
    <template #content>
      <div class="cover-pop">
        <div v-if="cover" class="cover-pop__preview">
          <img :src="assetHref(cover)" alt="封面预览" />
        </div>
        <div class="cover-pop__actions">
          <t-tooltip content="登录后可使用生图" :disabled="canGenerate">
            <t-button size="small" variant="text" theme="primary" :disabled="!canGenerate" @click="genCover">
              <template #icon><ai-icon /></template>
              AI 生成
            </t-button>
          </t-tooltip>
          <t-button size="small" variant="text" theme="primary" @click="uploadCover">
            <template #icon><upload-icon /></template>
            上传
          </t-button>
          <t-button v-if="cover" size="small" variant="text" theme="danger" @click="emit('cover', undefined)">
            <template #icon><delete-icon /></template>
            移除
          </t-button>
        </div>
        <div class="cover-pop__tip">封面建议比例 16:9（如 1536×864）</div>
      </div>
    </template>
  </t-popup>
</template>
<script lang="ts" setup>
import { AiIcon, DeleteIcon, ImageIcon, UploadIcon } from 'tdesign-icons-vue-next'
import type { ArticleItem } from '@/windows/main/modules/tool/components/article/articleTypes'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import { copyImageToAssets } from '@/windows/main/modules/tool/components/article/imageRef'
import { openArticleImageGen } from './ArticleImageGenDialog'
import { MessageUtil } from '@/utils/modal'

const props = defineProps<{
  /** 当前类型封面（相对 articles/ 的路径） */
  cover?: string
  /** 配图目录（assets/ 绝对路径，上传与 AI 生成产物落盘于此） */
  assetsDir: string
  /** 所属文章（AI 生成封面时提供标题 / 摘要 / 提纲作为起草语境） */
  article?: Pick<ArticleItem, 'title' | 'summary' | 'outline'>
  /** 流式改写进行中锁定 */
  locked?: boolean
}>()

const emit = defineEmits<{
  /** 设置 / 清除封面（rel 为相对 articles/ 的路径，undefined = 清除） */
  (e: 'cover', rel: string | undefined): void
}>()

/** 生图门控：登录即可用（直出接口，积分由服务端扣减） */
const canGenerate = computed(() => useAuthStore().status === 'signed-in')

/** 登记路径（相对 articles/）→ 展示 URL */
const assetHref = (rel: string): string =>
  window.preload.net.pathToHref(window.preload.path.join(window.preload.path.dirname(props.assetsDir), rel))

/** 系统选图 → 拷入 assets → 上抛设置封面 */
const uploadCover = async (): Promise<void> => {
  const selected = await window.preload.inject.dialog.open({
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  })
  const src = selected?.[0]
  if (!src) return
  try {
    const absPath = await copyImageToAssets(props.assetsDir, src, 'cover')
    emit('cover', `assets/${window.preload.path.basename(absPath)}`)
  } catch {
    MessageUtil.error('图片复制失败')
  }
}

const genCover = (): void =>
  openArticleImageGen({
    kind: 'cover',
    assetsDir: props.assetsDir,
    // 封面起草语境：标题 / 摘要 / 提纲（封面无选中片段概念，不给正文节选）
    context: {
      title: props.article?.title,
      summary: props.article?.summary,
      outline: props.article?.outline
    },
    onSuccess: (absPath) => emit('cover', `assets/${window.preload.path.basename(absPath)}`)
  })
</script>
<style scoped lang="less">
.cover-thumb {
  width: 56px;
  aspect-ratio: 16 / 9;
  border-radius: var(--td-radius-medium);
  border: 1px dashed var(--td-border-level-2-color);
  background: var(--td-bg-color-secondarycontainer);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--td-brand-color);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__empty {
    font-size: 20px;
    color: var(--td-text-color-placeholder);
  }
}

.cover-pop {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 240px;

  &__preview {
    aspect-ratio: 16 / 9;
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

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__tip {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
