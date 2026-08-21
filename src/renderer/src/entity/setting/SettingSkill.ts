export interface SettingSkill {
  /** key = `agentKey/dirName`，存在于 disabled 即禁用，缺省视为启用（默认全部启用） */
  disabled: Record<string, true>
}

export function buildSettingSkill(): SettingSkill {
  return { disabled: {} }
}
