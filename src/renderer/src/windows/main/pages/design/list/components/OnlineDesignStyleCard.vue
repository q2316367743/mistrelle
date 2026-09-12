<template>
  <div class="style-card" @click="emit('open')">
    <style-card-face :style="style" variant="compact">
      <template #actions>
        <t-dropdown :popup-props="{ trigger: 'click' }" @click.stop>
          <span class="style-card__menu" title="更多操作" @click.stop>
            <MoreIcon />
          </span>
          <t-dropdown-menu>
            <t-dropdown-item @click="emit('open')">
              <template #prefix-icon><ViewListIcon /></template>
              查看
            </t-dropdown-item>
            <t-dropdown-item :disabled="downloaded" @click="emit('download')">
              <template #prefix-icon><DownloadIcon /></template>
              {{ downloaded ? '已下载' : downloadLocked ? '下载 · 会员' : '下载' }}
            </t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown>
      </template>
    </style-card-face>
  </div>
</template>

<script lang="ts" setup>
import { MoreIcon, ViewListIcon, DownloadIcon } from 'tdesign-icons-vue-next'
import { AiDesignStyleItem } from '@/entity'
import { useAuthStore } from '@/windows/main/store'
import { computed } from 'vue'
import StyleCardFace from '@/components/design/StyleCardFace.vue'

defineProps<{ style: AiDesignStyleItem; downloaded?: boolean }>()
const emit = defineEmits<{ open: []; download: [] }>()

/** 下载在线风格为会员权益，非会员在菜单项上显式标注 */
const downloadLocked = computed(() => !useAuthStore().features.extendedDesignStyles)
</script>

<style scoped lang="less">
.style-card {
  cursor: pointer;

  &__menu {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    color: inherit;
    cursor: pointer;
    border-radius: var(--td-radius-default);

    &:hover {
      opacity: 0.7;
    }
  }
}
</style>
