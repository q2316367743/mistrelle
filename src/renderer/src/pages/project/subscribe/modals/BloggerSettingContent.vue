<template>
  <div class="blogger-setting">
    <t-form :data="form" :label-width="110">
      <t-form-item label="识别语言">
        <t-select
          v-model="form.language"
          :options="SUBSCRIBE_LANGUAGE_OPTIONS"
          placeholder="请选择识别语言"
        />
      </t-form-item>
      <t-form-item label="计算设备">
        <t-select
          v-model="form.device"
          :options="SUBSCRIBE_DEVICE_OPTIONS"
          placeholder="请选择计算设备"
        />
      </t-form-item>
      <t-form-item label="逆文本正则化">
        <t-switch v-model="form.itn" />
      </t-form-item>
      <t-form-item label="热词">
        <t-input v-model="form.hotword" placeholder="可选，多个热词以空格分隔" clearable />
      </t-form-item>
    </t-form>
    <div class="blogger-setting__actions">
      <t-button variant="outline" @click="emit('close')">取消</t-button>
      <t-button theme="primary" :loading="loading" @click="handleSubmit">保存</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { SUBSCRIBE_DEVICE_OPTIONS, SUBSCRIBE_LANGUAGE_OPTIONS } from '@/modules/subscribe'
import { subscribeBloggerUpdate } from '@/modules/subscribe'
import {
  buildSubscribeRecognizeSetting,
  type SubscribeBlogger,
  type SubscribeRecognizeSetting
} from '@/entity/project/Subscribe'
import { MessageUtil } from '@/utils/modal'

const props = defineProps<{
  projectId: string
  blogger: SubscribeBlogger
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', blogger: SubscribeBlogger): void
}>()

const form = ref<SubscribeRecognizeSetting>({
  ...buildSubscribeRecognizeSetting(),
  ...props.blogger.recognize
})
const loading = ref(false)

const handleSubmit = async () => {
  loading.value = true
  try {
    const updated: SubscribeBlogger = {
      ...props.blogger,
      recognize: { ...form.value },
      updatedAt: Date.now()
    }
    await subscribeBloggerUpdate(props.projectId, updated)
    MessageUtil.success('已保存')
    emit('success', updated)
  } catch (e) {
    MessageUtil.error('保存失败', e)
  } finally {
    loading.value = false
  }
}
</script>
<style scoped lang="less">
.blogger-setting {
  &__actions {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
