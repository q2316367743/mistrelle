<template>
  <div class="style-card" @click="emit('open')">
    <card-style-face :style="style">
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
            <t-dropdown-item v-if="!isSystem" @click="emit('edit')">
              <template #prefix-icon><EditIcon /></template>
              编辑
            </t-dropdown-item>
            <t-dropdown-item v-if="!isSystem" @click="emit('delete')">
              <template #prefix-icon><DeleteIcon class="color-red" /></template>
              <span class="color-red">删除</span>
            </t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown>
      </template>
    </card-style-face>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { MoreIcon, EditIcon, DeleteIcon, ViewListIcon } from 'tdesign-icons-vue-next'
import { AiCardStyle, AiCardStyleItem } from '@/entity'
import CardStyleFace from './CardStyleFace.vue'

const props = defineProps<{ style: AiCardStyleItem | AiCardStyle }>()
const emit = defineEmits<{ open: []; edit: []; delete: [] }>()

/** 内置预设不可编辑 / 删除 */
const isSystem = computed(() => 'isSystem' in props.style && props.style.isSystem)
</script>

<style scoped lang="less">
.style-card {
  cursor: pointer;

  // 菜单触发器嵌在卡片面标题行内，继承风格文字色保证任意底色可读
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
