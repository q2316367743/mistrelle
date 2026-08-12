import { ref } from 'vue'
import { DialogPlugin, Input } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'

const INVALID_CHARS = /[\\/:*?"<>|]/

export interface AssetMkdirDialogParams {
  /** 新建文件夹的目标目录（绝对路径） */
  targetDir: string
}

export const openAssetMkdirDialog = (params: AssetMkdirDialogParams) => {
  const name = ref('')

  const validate = (): string | null => {
    const n = name.value.trim()
    if (!n) return '名称不能为空'
    if (INVALID_CHARS.test(n)) return '名称不能包含以下字符：\\ / : * ? " < > |'
    const dest = window.preload.path.join(params.targetDir, n)
    if (window.preload.fs.existsSync(dest)) {
      return '同级已存在同名文件或文件夹'
    }
    return null
  }

  const dp = DialogPlugin({
    header: '新建文件夹',
    placement: 'center',
    width: '420px',
    onConfirm: () => {
      const err = validate()
      if (err) {
        MessageUtil.error(err)
        return
      }
      const dest = window.preload.path.join(params.targetDir, name.value.trim())
      window.preload.fs
        .mkdir(dest)
        .then(() => {
          MessageUtil.success('已创建')
          dp.destroy()
        })
        .catch((e) => {
          MessageUtil.error('创建失败', e)
        })
    },
    default: () => (
      <div class={'mt-8px'}>
        <Input
          v-model={name.value}
          placeholder="请输入文件夹名称"
          clearable
          autofocus
        />
      </div>
    )
  })
}
