import { ToolFunction } from '@/domain'

export const injectFfmpegTools: ToolFunction[] = [
  {
    name: 'ffmpeg_run',
    label: '运行 FFmpeg',
    description: '执行 FFmpeg 命令，支持音视频格式转换、剪辑、拼接等操作',
    parameters: {
      type: 'object',
      properties: {
        args: {
          type: 'string',
          description: 'FFmpeg 命令行参数数组，例如 ["-i", "input.mp4", "-vf", "scale=640:360", "output.mp4"]',
        },
      },
      required: ['args'],
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const { args } = params[0] as { args: string[] }
      await window.preload.inject.ffmpeg.run(args)
      return { success: true, args }
    },
  },
]
