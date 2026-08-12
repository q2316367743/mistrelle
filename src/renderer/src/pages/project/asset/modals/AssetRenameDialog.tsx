import { ref } from 'vue'
import { DialogPlugin, Form, FormItem, Input } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'

const INVALID_CHARS = /[\\/:*?"<>|]/

export interface AssetRenameDialogParams {
  current: FileItem
}

export const openAssetRenameDialog = (params: AssetRenameDialogParams) => {
  const { current } = params
  const isDir = current.isDirectory
  const initialName = current.name
  const initialParent = window.preload.path.dirname(current.path)

  const name = ref(initialName)

  const validate = (): string | null => {
    const n = name.value.trim()
    if (!n) return '名称不能为空'
    if (INVALID_CHARS.test(n)) return '名称不能包含以下字符：\\ / : * ? " < > |'
    if (n === initialName) return '未做任何修改'
    const samePath = window.preload.path.join(initialParent, n)
    if (window.preload.fs.existsSync(samePath)) {
      return '同级已存在同名文件或文件夹'
    }
    return null
  }

  const dp = DialogPlugin({
    header: isDir ? '重命名文件夹' : '重命名文件',
    placement: 'center',
    width: '420px',
    onConfirm: () => {
      const err = validate()
      if (err) {
        MessageUtil.error(err)
        return
      }
      const dest = window.preload.path.join(initialParent, name.value.trim())
      window.preload.fs
        .rename(current.path, dest)
        .then(() => {
          MessageUtil.success('已保存')
          dp.destroy()
        })
        .catch((e) => {
          MessageUtil.error('重命名失败', e)
        })
    },
    default: () => (
      <Form class={'mt-8px'}>
        <FormItem label="名称" name="name">
          <Input
            v-model={name.value}
            placeholder="请输入新名称"
            clearable
            autofocus
          />
        </FormItem>
      </Form>
    )
  })
}
