import { SettingAccount } from '@/entity'
import { getAccountPath } from '@/global/Constant'

// 账户配置文件：~/.mistrelle/account.json（含 skillhub / context7 / zhihu 密钥，整文件 safeStorage 加密）

/**
 * 读取账户配置；文件不存在时返回 null（不预写空文件）。
 * 解密返回 null（OS 加密不可用 / 明文降级文件）时按明文 JSON 兼容解析
 */
export const accountLoad = async (): Promise<SettingAccount | null> => {
  const path = getAccountPath()
  if (!(window.preload.fs.existsSync(path))) return null
  const text = await window.preload.fs.readTextFile(path)
  return JSON.parse((await window.preload.safeStorage.decrypt(text)) ?? text)
}

/**
 * 全量覆写账户配置；safeStorage 不可用（如 Linux 无 keyring）时降级明文写入
 */
export const accountSave = async (account: SettingAccount): Promise<void> => {
  const json = JSON.stringify(account)
  await window.preload.fs.writeTextFile(getAccountPath(), (await window.preload.safeStorage.encrypt(json)) ?? json)
}
