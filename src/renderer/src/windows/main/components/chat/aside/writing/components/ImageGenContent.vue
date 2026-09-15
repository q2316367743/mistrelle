<template>
  <div class="article-image-gen">
    <div class="article-image-gen__prompt">
      <t-textarea
        v-model="prompt"
        :placeholder="placeholder"
        :autosize="{ minRows: 3, maxRows: 6 }"
      />
      <div class="article-image-gen__prompt-foot">
        <span class="article-image-gen__draft-tip">{{ draftTip }}</span>
        <t-button
          v-if="hasContext"
          variant="text"
          size="small"
          theme="primary"
          :disabled="generating"
          :loading="drafting"
          @click="handleDraft"
        >
          {{ drafting ? '起草中…' : '换一版' }}
        </t-button>
      </div>
    </div>
    <div class="article-image-gen__row">
      <t-select v-model="modelKey" class="model-select" :loading="imageModelStore.loading" placeholder="生图模型">
        <t-option v-for="item in imageModelStore.items" :key="item.value" :value="item.value" :label="item.label">
          <div class="article-image-gen__option">
            <span class="option-name">{{ item.label }}</span>
            <span v-if="item.pointsPerImage != null" class="option-points">{{ item.pointsPerImage }} 积分/张</span>
          </div>
        </t-option>
      </t-select>
      <t-select v-model="size" class="size-select" :options="sizeOptions" filterable creatable />
    </div>
    <div v-if="modelTip" class="article-image-gen__tip">
      <span>{{ modelTip }}</span>
      <t-button v-if="imageModelStore.needLogin" variant="text" size="small" theme="primary" @click="openLogin()">
        登录
      </t-button>
    </div>
    <div v-if="error" class="article-image-gen__error">{{ error }}</div>
    <div class="article-image-gen__actions">
      <t-button variant="outline" :disabled="generating" @click="emit('close')">取消</t-button>
      <t-button theme="primary" :loading="generating" :disabled="!canSubmit" @click="handleGenerate">
        {{ generating ? '生成中…' : '生成' }}
      </t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { openLogin } from '@/components/modals/LoginDialog'
import { useImageModelStore, useSettingDefaultStore } from '@/windows/main/store'
import {
  draftImagePrompt,
  type ImagePromptContext,
  type ImagePromptKind
} from '@/windows/main/modules/tool/components/writing/imagePrompt'

const props = defineProps<{
  kind: ImagePromptKind
  /** 作品 assets/ 目录绝对路径（产物落盘于此） */
  assetsDir: string
  /** 作品语境：打开弹窗即据此让 AI 代写生图描述（缺省则留空由用户手写） */
  context?: ImagePromptContext
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', absPath: string): void
}>()

/** 常用尺寸（与生图页同源的安全值；封面/插图按取向选默认，支持自定义） */
const SIZE_OPTIONS = [
  { label: '方形 1024×1024', value: '1024x1024' },
  { label: '竖版 1024×1536', value: '1024x1536' },
  { label: '横版 1536×1024', value: '1536x1024' }
]

const imageModelStore = useImageModelStore()
const settingDefaultStore = useSettingDefaultStore()

const prompt = ref('')
const modelKey = ref('')
const generating = ref(false)
const error = ref('')
/** 起草状态：true = 正在让 AI 按作品语境写描述 */
const drafting = ref(false)
/** 起草结果标记：undefined 未起草 / 'ok' 已起草 / 'fail' 起草失败（无模型或调用异常） */
const draftState = ref<'ok' | 'fail' | undefined>(undefined)

/** 默认尺寸：封面横版、插图方形（支持自定义） */
const size = ref(props.kind === 'cover' ? '1536x1024' : '1024x1024')
const sizeOptions = SIZE_OPTIONS

const placeholder = computed(() =>
  props.kind === 'image'
    ? '描述选中文字对应的画面，建议详细英文（主体 / 风格 / 配色 / 构图）…'
    : '描述封面画面，建议详细英文（主体 / 风格 / 配色 / 构图）…'
)

/** 是否有作品语境可供代写（无语境则不展示「换一版」，退回纯手写） */
const hasContext = computed(() => {
  const ctx = props.context
  if (!ctx) return false
  return Boolean(ctx.title || ctx.summary || ctx.outline || ctx.selection)
})

const draftTip = computed(() => {
  if (drafting.value) {
    return props.kind === 'image' ? '正在按选中文字起草描述…' : '正在按作品主题起草描述…'
  }
  if (draftState.value === 'fail') return 'AI 起草不可用（未配置快速模型），请手动描述画面'
  if (draftState.value === 'ok') {
    return props.kind === 'image'
      ? 'AI 已按选中文字起草，可直接修改或换一版'
      : 'AI 已按作品主题起草，可直接修改或换一版'
  }
  return ''
})

// 默认选中：优先「默认生图模型」，否则列表首项；用户改选后不覆盖
watch(
  () => [imageModelStore.items, settingDefaultStore.state.defaultImageModel] as const,
  () => {
    if (modelKey.value) return
    const items = imageModelStore.items
    if (!items.length) return
    const preferred = settingDefaultStore.state.defaultImageModel
    modelKey.value = items.some((option) => option.value === preferred) ? preferred : (items[0]?.value ?? '')
  },
  { immediate: true, deep: true }
)

const canSubmit = computed(
  () => prompt.value.trim().length > 0 && !!modelKey.value && !imageModelStore.needLogin
)

const modelTip = computed(() => {
  if (imageModelStore.needLogin) return '登录后可使用生图'
  if (!imageModelStore.items.length) {
    return imageModelStore.loading ? '正在获取生图模型…' : '暂无可用生图模型'
  }
  if (!modelKey.value) return '请选择生图模型'
  return ''
})

/**
 * 起草 / 换一版：按作品语境让 AI 生成一段英文画描述回填。
 * 已有描述时作为「换一版」使用（直接覆盖，不做追加），避免多版描述堆叠难以取舍。
 */
const handleDraft = async (): Promise<void> => {
  if (!hasContext.value || drafting.value) return
  drafting.value = true
  try {
    const draft = await draftImagePrompt(props.kind, props.context ?? {})
    if (draft) {
      prompt.value = draft
      draftState.value = 'ok'
    } else {
      draftState.value = 'fail'
    }
  } finally {
    drafting.value = false
  }
}

// 打开即起草：让用户看到的第一版就是贴合文章的可用描述，而不是空文本框
onMounted(() => {
  void handleDraft()
})

/** 直出生图：不建页面记录，产物落盘 assets/ 后返回终态（进度由按钮 loading 呈现） */
const handleGenerate = async () => {
  if (!canSubmit.value || generating.value) return
  generating.value = true
  error.value = ''
  try {
    const prefix = props.kind === 'cover' ? 'cover' : 'image'
    const target = window.preload.path.join(props.assetsDir, `${prefix}-${Date.now()}.png`)
    const res = await window.preload.image.generate({
      prompt: prompt.value.trim(),
      model: modelKey.value,
      size: size.value?.trim() || undefined,
      record: false,
      path: target
    })
    if (res.phase !== 'finished') {
      error.value = '生图服务返回异常，请重试'
      return
    }
    if ('error' in res.result) {
      error.value = res.result.error
      return
    }
    emit('success', res.result.path)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    generating.value = false
  }
}
</script>
<style scoped lang="less">
.article-image-gen {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__prompt {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__prompt-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 24px;
  }

  &__draft-tip {
    min-width: 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .model-select {
    flex: 1;
    min-width: 0;
  }

  .size-select {
    width: 160px;
    flex-shrink: 0;
  }

  &__option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
  }

  .option-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .option-points {
    flex-shrink: 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__tip {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__error {
    padding: 8px 12px;
    border-radius: var(--td-radius-medium);
    background: var(--td-error-color-1);
    color: var(--td-error-color);
    font-size: var(--td-font-size-body-small);
    word-break: break-word;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
