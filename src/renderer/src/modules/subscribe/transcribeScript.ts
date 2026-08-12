import { dataFolder } from '@/global/Constant'

export const TRANSCRIBE_SCRIPT_NAME = 'transcribe.py'

// ~/.mistrelle/runtime/transcribe.py
export const buildTranscribeScriptPath = (): string =>
  window.preload.path.join(dataFolder, 'runtime', TRANSCRIBE_SCRIPT_NAME)

const TRANSCRIBE_SCRIPT_TEMPLATE = `# -*- coding: utf-8 -*-
import argparse


def main():
    parser = argparse.ArgumentParser(description="FunASR 音频转文字")
    parser.add_argument("audio", help="输入音频路径")
    parser.add_argument("output", help="输出文本路径")
    parser.add_argument("--language", default="zh", help="识别语言：auto/zh/en/ja/ko/yue")
    parser.add_argument("--device", default="cpu", help="计算设备：cpu/cuda")
    parser.add_argument("--itn", action="store_true", help="启用逆文本正则化")
    parser.add_argument("--hotword", default=None, help="热词（可选）")
    args = parser.parse_args()

    from funasr import AutoModel

    model_name = "paraformer-zh"
    if args.language not in ("zh", "auto"):
        model_name = "paraformer"

    model = AutoModel(
        model=model_name,
        vad_model="fsmn-vad",
        punc_model="ct-punc",
        device=args.device,
    )

    generate_kwargs = {}
    if args.language:
        generate_kwargs["language"] = args.language
    if args.itn:
        generate_kwargs["itn"] = True
    if args.hotword:
        generate_kwargs["hotword"] = args.hotword

    result = model.generate(input=args.audio, **generate_kwargs)
    text = result[0].get("text", "") if result else ""

    with open(args.output, "w", encoding="utf-8") as f:
        f.write(text)


if __name__ == "__main__":
    main()
`

/**
 * 确保 FunASR 脚本已落盘，返回脚本路径。
 * 脚本以模板形式内嵌，首次使用写入 ~/.mistrelle/runtime/。
 */
export const ensureTranscribeScript = async (): Promise<string> => {
  const path = buildTranscribeScriptPath()
  if (window.preload.fs.existsSync(path)) return path
  await window.preload.fs.mkdir(window.preload.path.join(dataFolder, 'runtime'), true)
  await window.preload.fs.writeTextFile(path, TRANSCRIBE_SCRIPT_TEMPLATE)
  return path
}
