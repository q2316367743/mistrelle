import { cliRun } from '@/plugin/shell'
import { useSettingSecureStore } from '@/store'
import type { SubscribeRecognizeSetting } from '@/entity/project/Subscribe'
import { ensureTranscribeScript } from './transcribeScript'

/**
 * 调用 FunASR（Python）将音频转写为文字，写入 outputPath 并返回文本。
 * 每次调用都执行一次 python 脚本；识别参数通过 CLI 透传。
 */
export const transcribeAudio = async (
  audioPath: string,
  outputPath: string,
  setting?: SubscribeRecognizeSetting
): Promise<string> => {
  const { pythonPath } = useSettingSecureStore()
  const scriptPath = await ensureTranscribeScript()

  const args = [scriptPath, audioPath, outputPath]
  if (setting?.language) args.push('--language', setting.language)
  if (setting?.device) args.push('--device', setting.device)
  if (setting?.itn) args.push('--itn')
  if (setting?.hotword) args.push('--hotword', setting.hotword)

  const result = await cliRun(pythonPath, args)
  if (result.exitCode !== 0) {
    throw new Error(result.stderr?.trim() || result.error || '音频转写失败')
  }
  if (!window.preload.fs.existsSync(outputPath)) {
    throw new Error('转写未产出文本文件')
  }
  return window.preload.fs.readTextFile(outputPath)
}
