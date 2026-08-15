<template>
  <div class="font-pick-chat-tool">
    <!-- 交互态：选字面板 -->
    <div v-if="isInteractive" class="font-pick">
      <div v-if="purpose" class="font-pick__purpose">{{ purpose }}</div>

      <div v-if="recommendList.length" class="font-pick__section">
        <div class="font-pick__section-title">推荐</div>
        <div class="font-pick__recommend-list">
          <div
            v-for="rec in recommendList"
            :key="rec.name"
            class="font-pick__option"
            :class="{
              'font-pick__option--selected': selected === rec.name,
              'font-pick__option--disabled': !rec.font
            }"
            @click="rec.font && (selected = rec.font.name)"
          >
            <CheckCircleIcon v-if="selected === rec.name" class="font-pick__check" />
            <template v-if="rec.font">
              <font-preview-text :font="rec.font" class="font-pick__preview" />
              <span class="font-pick__name">{{ rec.font.name }}</span>
              <t-tag
                v-if="rec.font.source === 'library'"
                size="small"
                variant="light"
                theme="primary"
              >
                资源库
              </t-tag>
            </template>
            <template v-else>
              <span class="font-pick__preview font-pick__preview--muted">{{ rec.name }}</span>
              <span class="font-pick__name font-pick__name--muted">未安装</span>
            </template>
          </div>
        </div>
      </div>

      <div class="font-pick__section">
        <div class="font-pick__more-bar">
          <span class="font-pick__section-title">全部字体（{{ filteredFonts.length }}）</span>
          <t-button size="small" variant="text" theme="primary" @click="showMore = !showMore">
            {{ showMore ? '收起' : '选择更多' }}
          </t-button>
        </div>
        <template v-if="showMore">
          <t-input
            v-model="keyword"
            size="small"
            placeholder="搜索字体名称"
            clearable
            class="font-pick__search"
          />
          <div v-if="loadingFonts" class="font-pick__loading">
            <t-loading size="small" />
            <span>加载字体…</span>
          </div>
          <div v-else class="font-pick__list">
            <div
              v-for="f in filteredFonts"
              :key="f.name"
              class="font-pick__option"
              :class="{ 'font-pick__option--selected': selected === f.name }"
              @click="selected = f.name"
            >
              <CheckCircleIcon v-if="selected === f.name" class="font-pick__check" />
              <font-preview-text :font="f" class="font-pick__preview" />
              <span class="font-pick__name">{{ f.name }}</span>
              <t-tag v-if="f.source === 'library'" size="small" variant="light" theme="primary">
                资源库
              </t-tag>
            </div>
            <div v-if="!filteredFonts.length" class="font-pick__empty">没有匹配的字体</div>
          </div>
        </template>
      </div>

      <div class="font-pick__actions">
        <t-button theme="primary" size="small" :disabled="!selected" @click="confirm">
          确定
        </t-button>
        <t-button theme="default" variant="outline" size="small" @click="cancel">不用了</t-button>
      </div>
    </div>

    <!-- 等待态 -->
    <div v-else-if="isWaiting" class="font-pick-waiting">
      <t-loading size="small" />
      <span>等待用户选择字体…</span>
    </div>

    <!-- 结果态 -->
    <div v-else-if="isDone" class="font-pick-result">
      <CheckCircleIcon class="font-pick-result__icon" />
      <span>{{ pickedFont ? `已选择字体：${pickedFont}` : resultText }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, onMounted, ref, watchEffect } from 'vue'
import type { PropType } from 'vue'
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import { CheckCircleIcon } from 'tdesign-icons-vue-next'
import { INTERACTIVE_KEY } from '@/modules/chat/agent/interactive'
import { normalizeFontPickArgs } from '@/modules/tool/components/design/fontTools'
import FontPreviewText from '@/components/FontPreviewText.vue'
import { FontItem } from '@/domain/FontItem'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

const bridge = inject(INTERACTIVE_KEY)

const toolCallId = computed(() => props.content.data.toolCallId)

const args = computed(() => {
  const raw = props.content.data.args
  if (!raw) return { purpose: '', recommends: [] }
  try {
    return normalizeFontPickArgs(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return { purpose: '', recommends: [] }
  }
})
const purpose = computed(() => args.value.purpose ?? '')

const fonts = ref<FontItem[]>([])
const loadingFonts = ref(true)
onMounted(async () => {
  try {
    fonts.value = await window.preload.font.listFonts()
  } finally {
    loadingFonts.value = false
  }
})

/** 推荐字体：按名字命中本机字体（未命中标记为未安装） */
const recommendList = computed(() => {
  const lower = new Map(fonts.value.map((f) => [f.name.toLowerCase(), f]))
  return (args.value.recommends ?? []).map((name) => ({
    name,
    font: lower.get(name.toLowerCase())
  }))
})

const showMore = ref(false)
const keyword = ref('')
const filteredFonts = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return fonts.value
  return fonts.value.filter((f) => f.name.toLowerCase().includes(kw))
})

const selected = ref('')
/** 打开面板默认选中第一个已安装的推荐字体，用户可自由改选 */
watchEffect(() => {
  if (selected.value) return
  const first = recommendList.value.find((rec) => !!rec.font)
  if (first?.font) selected.value = first.font.name
})

const matched = computed(() => bridge?.pending.value?.toolCallId === toolCallId.value)
const isInteractive = computed(
  () =>
    (props.content.status === 'pending' || props.content.status === 'streaming') &&
    !!bridge &&
    matched.value
)
const isWaiting = computed(
  () =>
    (props.content.status === 'pending' || props.content.status === 'streaming') && !matched.value
)
const isDone = computed(
  () => props.content.status === 'complete' || props.content.status === 'error'
)
const pickedFont = computed(() =>
  typeof props.content.ext?.pickedFont === 'string' ? props.content.ext.pickedFont : ''
)
const resultText = computed(() => props.content.data.result ?? '')

const confirm = () => {
  if (!selected.value) return
  bridge?.resolve(toolCallId.value, selected.value)
}

const cancel = () => {
  bridge?.resolve(toolCallId.value, null)
}
</script>

<style scoped lang="less">
.font-pick-chat-tool {
  margin: var(--td-comp-margin-xs) 0;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-s);

  .font-pick {
    display: flex;
    flex-direction: column;
    gap: var(--td-comp-margin-m);

    &__purpose {
      padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
      border-radius: var(--td-radius-small);
      background: var(--td-bg-color-secondarycontainer);
      color: var(--td-text-color-primary);
      font: var(--td-font-body-medium);
      white-space: pre-wrap;
      word-break: break-word;
    }

    &__section {
      display: flex;
      flex-direction: column;
      gap: var(--td-comp-margin-s);
    }

    &__section-title {
      font: var(--td-font-body-small);
      color: var(--td-text-color-secondary);
    }

    &__more-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    &__recommend-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--td-comp-margin-s);
    }

    &__search {
      width: 100%;
    }

    &__list {
      display: flex;
      flex-direction: column;
      gap: var(--td-comp-margin-xs);
      max-height: 260px;
      overflow-y: auto;
    }

    &__option {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--td-comp-margin-s);
      padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
      border-radius: var(--td-radius-small);
      border: 1px solid var(--td-component-border);
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        background-color 0.2s ease;

      &--selected {
        border-color: var(--td-brand-color);
        background: var(--td-brand-color-light);
      }

      &--disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
    }

    &__check {
      flex: none;
      color: var(--td-brand-color);
      font-size: var(--td-font-size-body-large);
    }

    &__preview {
      flex: 1;
      min-width: 0;
      font-size: 15px;

      &--muted {
        color: var(--td-text-color-placeholder);
      }
    }

    &__name {
      flex: none;
      font: var(--td-font-body-small);
      color: var(--td-text-color-secondary);
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &--muted {
        color: var(--td-text-color-placeholder);
      }
    }

    &__loading,
    &__empty {
      display: flex;
      align-items: center;
      gap: var(--td-comp-margin-s);
      padding: var(--td-comp-paddingTB-m) 0;
      color: var(--td-text-color-placeholder);
      font: var(--td-font-body-small);
    }

    &__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--td-comp-margin-s);
    }
  }

  .font-pick-waiting {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-s);
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }

  .font-pick-result {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-s);
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
    white-space: pre-wrap;
    word-break: break-word;

    &__icon {
      flex-shrink: 0;
      color: var(--td-brand-color);
      font-size: var(--td-font-size-body-large);
    }
  }
}
</style>
