import { buildProjectDirPath } from '@/modules/project'
import { useSnowflake } from '@/hooks'
import { requestDownload } from '@/plugin/http'
import {
  buildSubscribeBlogger,
  buildSubscribeItem,
  type SubscribeBlogger,
  type SubscribeItem,
  type SubscribeRecognizeSetting
} from '@/entity/project/Subscribe'
import {
  resolveSubscribeBlogger,
  resolveSubscribeBloggerVideos,
  resolveSubscribeResource
} from './strategy'
import { SUBSCRIBE_SYNC_BATCH } from './const'
import { transcribeAudio } from './transcribe'
import { summarizeText } from './summarize'

// --------------------------------- 路径构建 ---------------------------------

// ~/.mistrelle/project/{pid}/subscribe
export const buildProjectSubscribeDir = (projectId: string) =>
  window.preload.path.join(buildProjectDirPath(projectId), 'subscribe')

// ~/.mistrelle/project/{pid}/subscribe/index.json（博主索引）
export const buildProjectSubscribeIndexPath = (projectId: string) =>
  window.preload.path.join(buildProjectSubscribeDir(projectId), 'index.json')

// ~/.mistrelle/project/{pid}/subscribe/{bloggerId}
export const buildSubscribeBloggerDir = (projectId: string, bloggerId: string) =>
  window.preload.path.join(buildProjectSubscribeDir(projectId), bloggerId)

// ~/.mistrelle/project/{pid}/subscribe/{bloggerId}/index.json（视频订阅索引）
export const buildSubscribeVideoIndexPath = (projectId: string, bloggerId: string) =>
  window.preload.path.join(buildSubscribeBloggerDir(projectId, bloggerId), 'index.json')

// ~/.mistrelle/project/{pid}/subscribe/{bloggerId}/{subscribeId}
export const buildSubscribeVideoDir = (projectId: string, bloggerId: string, subscribeId: string) =>
  window.preload.path.join(buildSubscribeBloggerDir(projectId, bloggerId), subscribeId)

// ~/.mistrelle/project/{pid}/subscribe/{bloggerId}/{subscribeId}/{name}
export const buildSubscribeMediaPath = (
  projectId: string,
  bloggerId: string,
  subscribeId: string,
  name: string
) => window.preload.path.join(buildSubscribeVideoDir(projectId, bloggerId, subscribeId), name)

// --------------------------------- 博主 CRUD ---------------------------------

const ensureSubscribeDir = async (projectId: string) => {
  const dir = buildProjectSubscribeDir(projectId)
  if (!window.preload.fs.existsSync(dir)) {
    await window.preload.fs.mkdir(dir, true)
  }
  return dir
}

/**
 * 读取博主索引，自动确保目录与索引文件存在
 */
export const subscribeBloggerList = async (projectId: string): Promise<SubscribeBlogger[]> => {
  await ensureSubscribeDir(projectId)
  const indexPath = buildProjectSubscribeIndexPath(projectId)
  if (!window.preload.fs.existsSync(indexPath)) {
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  return JSON.parse(await window.preload.fs.readTextFile(indexPath))
}

export const subscribeBloggerSave = async (projectId: string, list: SubscribeBlogger[]) => {
  await ensureSubscribeDir(projectId)
  await window.preload.fs.writeTextFile(
    buildProjectSubscribeIndexPath(projectId),
    JSON.stringify(list)
  )
}

export const subscribeBloggerGet = async (
  projectId: string,
  bloggerId: string
): Promise<SubscribeBlogger | undefined> => {
  const list = await subscribeBloggerList(projectId)
  return list.find((b) => b.id === bloggerId)
}

/**
 * 添加博主：解析博主信息 → 建目录骨架 → 写索引。
 * 视频列表由 subscribeBloggerSyncVideos 拉取（创建后由页面自动触发）。
 */
export const subscribeBloggerAdd = async (
  projectId: string,
  url: string
): Promise<SubscribeBlogger> => {
  const info = await resolveSubscribeBlogger(url)
  const now = Date.now()
  const blogger = {
    ...buildSubscribeBlogger(),
    id: useSnowflake().nextId(),
    name: info.name,
    avatar: info.avatar,
    url,
    platform: info.platform,
    videoCount: info.videoCount ?? 0,
    createdAt: now,
    updatedAt: now
  }
  await window.preload.fs.mkdir(buildSubscribeBloggerDir(projectId, blogger.id), true)
  await window.preload.fs.writeTextFile(
    buildSubscribeVideoIndexPath(projectId, blogger.id),
    JSON.stringify([])
  )
  const list = await subscribeBloggerList(projectId)
  list.push(blogger)
  await subscribeBloggerSave(projectId, list)
  return blogger
}

export const subscribeBloggerUpdate = async (projectId: string, blogger: SubscribeBlogger) => {
  const list = await subscribeBloggerList(projectId)
  const idx = list.findIndex((b) => b.id === blogger.id)
  if (idx >= 0) {
    list[idx] = { ...blogger, updatedAt: Date.now() }
  } else {
    list.push(blogger)
  }
  await subscribeBloggerSave(projectId, list)
}

export const subscribeBloggerRemove = async (projectId: string, bloggerId: string) => {
  const dir = buildSubscribeBloggerDir(projectId, bloggerId)
  if (window.preload.fs.existsSync(dir)) {
    await window.preload.fs.rm(dir)
  }
  const list = await subscribeBloggerList(projectId)
  await subscribeBloggerSave(
    projectId,
    list.filter((b) => b.id !== bloggerId)
  )
}

// --------------------------------- 视频订阅 CRUD ---------------------------------

export const subscribeVideoList = async (
  projectId: string,
  bloggerId: string
): Promise<SubscribeItem[]> => {
  const indexPath = buildSubscribeVideoIndexPath(projectId, bloggerId)
  if (!window.preload.fs.existsSync(indexPath)) {
    await window.preload.fs.mkdir(buildSubscribeBloggerDir(projectId, bloggerId), true)
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  return JSON.parse(await window.preload.fs.readTextFile(indexPath))
}

export const subscribeVideoSave = async (
  projectId: string,
  bloggerId: string,
  list: SubscribeItem[]
) => {
  await window.preload.fs.mkdir(buildSubscribeBloggerDir(projectId, bloggerId), true)
  await window.preload.fs.writeTextFile(
    buildSubscribeVideoIndexPath(projectId, bloggerId),
    JSON.stringify(list)
  )
}

/**
 * 增量同步博主视频列表：每次最多新增本地没有的 SUBSCRIBE_SYNC_BATCH 条记录，
 * 超出部分留待下次同步继续采集（列表按时间倒序，保证增量向前推进）。
 */
export const subscribeBloggerSyncVideos = async (
  projectId: string,
  bloggerId: string
): Promise<SubscribeItem[]> => {
  const blogger = await subscribeBloggerGet(projectId, bloggerId)
  if (!blogger) throw new Error('博主不存在')

  const remote = await resolveSubscribeBloggerVideos(blogger.url)
  const local = await subscribeVideoList(projectId, bloggerId)
  const localByUrl = new Map(local.map((v) => [v.url, v]))
  const now = Date.now()

  let added = 0
  const merged: SubscribeItem[] = []
  for (const r of remote) {
    const exist = localByUrl.get(r.url)
    if (exist) {
      merged.push(exist)
      continue
    }
    if (added >= SUBSCRIBE_SYNC_BATCH) continue
    merged.push({
      ...buildSubscribeItem(),
      id: useSnowflake().nextId(),
      title: r.title,
      cover: r.cover,
      url: r.url,
      publishDate: r.publishDate,
      createdAt: now,
      updatedAt: now
    })
    added++
  }

  // 保留本地已有但远程未返回的记录，避免误删已下载内容
  const remoteUrls = new Set(remote.map((r) => r.url))
  for (const v of local) {
    if (!remoteUrls.has(v.url)) merged.push(v)
  }

  await subscribeVideoSave(projectId, bloggerId, merged)
  if (blogger.videoCount !== remote.length) {
    await subscribeBloggerUpdate(projectId, { ...blogger, videoCount: remote.length })
  }
  return merged
}

export const subscribeVideoRemove = async (
  projectId: string,
  bloggerId: string,
  subscribeId: string
) => {
  const dir = buildSubscribeVideoDir(projectId, bloggerId, subscribeId)
  if (window.preload.fs.existsSync(dir)) {
    await window.preload.fs.rm(dir)
  }
  const list = await subscribeVideoList(projectId, bloggerId)
  await subscribeVideoSave(
    projectId,
    bloggerId,
    list.filter((v) => v.id !== subscribeId)
  )
}

// --------------------------------- 文件工具 ---------------------------------

export const subscribeMediaExists = (
  projectId: string,
  bloggerId: string,
  subscribeId: string,
  name: string
): boolean =>
  window.preload.fs.existsSync(buildSubscribeMediaPath(projectId, bloggerId, subscribeId, name))

export const subscribeFileHref = (fullPath: string): string =>
  window.preload.net.pathToHref(fullPath)

// --------------------------------- 流水线 ---------------------------------

const toErrorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const updateVideoStatus = async (
  projectId: string,
  bloggerId: string,
  subscribeId: string,
  patch: Partial<SubscribeItem>
) => {
  const list = await subscribeVideoList(projectId, bloggerId)
  const idx = list.findIndex((v) => v.id === subscribeId)
  if (idx < 0) return
  list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() }
  await subscribeVideoSave(projectId, bloggerId, list)
}

/**
 * 下载订阅：解析直链 → 下载 video.mp4（或仅音频源直接 audio.mp3）。
 * 视频源且无音频直链时，下载后直接提取音频。
 */
export const subscribeDownload = async (
  projectId: string,
  bloggerId: string,
  subscribeId: string
) => {
  const list = await subscribeVideoList(projectId, bloggerId)
  const video = list.find((v) => v.id === subscribeId)
  if (!video) throw new Error('订阅不存在')
  const dir = buildSubscribeVideoDir(projectId, bloggerId, subscribeId)
  if (subscribeMediaExists(projectId, bloggerId, subscribeId, 'video.mp4')) return
  if (subscribeMediaExists(projectId, bloggerId, subscribeId, 'audio.mp3')) return

  await updateVideoStatus(projectId, bloggerId, subscribeId, {
    status: 'downloading',
    error: undefined
  })
  try {
    const resource = await resolveSubscribeResource(video.url)
    await window.preload.fs.mkdir(dir, true)
    if (resource.videoUrl) {
      const videoPath = buildSubscribeMediaPath(projectId, bloggerId, subscribeId, 'video.mp4')
      await requestDownload({ url: resource.videoUrl }, videoPath)
      if (!resource.audioUrl) {
        await extractAudioTo(
          videoPath,
          buildSubscribeMediaPath(projectId, bloggerId, subscribeId, 'audio.mp3')
        )
      }
    } else if (resource.audioUrl) {
      await requestDownload(
        { url: resource.audioUrl },
        buildSubscribeMediaPath(projectId, bloggerId, subscribeId, 'audio.mp3')
      )
    } else {
      throw new Error('策略未返回可下载的视频或音频地址')
    }
    await updateVideoStatus(projectId, bloggerId, subscribeId, {
      status: 'ready',
      title: resource.title || video.title,
      description: resource.description,
      videoUrl: resource.videoUrl,
      audioUrl: resource.audioUrl,
      error: undefined
    })
  } catch (e) {
    await updateVideoStatus(projectId, bloggerId, subscribeId, {
      status: 'error',
      error: toErrorMessage(e)
    })
    throw e
  }
}

const extractAudioTo = async (videoPath: string, audioPath: string) => {
  await window.preload.inject.ffmpeg.run([
    '-i',
    videoPath,
    '-vn',
    '-acodec',
    'libmp3lame',
    '-q:a',
    '2',
    audioPath
  ])
}

/**
 * 视频提取音频（ffmpeg），已存在 audio.mp3 时跳过
 */
export const subscribeExtractAudio = async (
  projectId: string,
  bloggerId: string,
  subscribeId: string
) => {
  const videoPath = buildSubscribeMediaPath(projectId, bloggerId, subscribeId, 'video.mp4')
  const audioPath = buildSubscribeMediaPath(projectId, bloggerId, subscribeId, 'audio.mp3')
  if (!window.preload.fs.existsSync(videoPath)) throw new Error('视频文件不存在，请先下载')
  if (window.preload.fs.existsSync(audioPath)) return
  await extractAudioTo(videoPath, audioPath)
}

/**
 * 音频转写（FunASR），识别参数来自博主配置
 */
export const subscribeTranscribe = async (
  projectId: string,
  bloggerId: string,
  subscribeId: string,
  recognize?: SubscribeRecognizeSetting
) => {
  const audioPath = buildSubscribeMediaPath(projectId, bloggerId, subscribeId, 'audio.mp3')
  if (!window.preload.fs.existsSync(audioPath)) throw new Error('音频文件不存在，请先下载/提取')
  const textPath = buildSubscribeMediaPath(projectId, bloggerId, subscribeId, 'text.md')
  await updateVideoStatus(projectId, bloggerId, subscribeId, {
    status: 'transcribing',
    error: undefined
  })
  try {
    await transcribeAudio(audioPath, textPath, recognize)
    await updateVideoStatus(projectId, bloggerId, subscribeId, { status: 'transcribed' })
  } catch (e) {
    await updateVideoStatus(projectId, bloggerId, subscribeId, {
      status: 'error',
      error: toErrorMessage(e)
    })
    throw e
  }
}

/**
 * AI 总结，写入 summary.md
 */
export const subscribeSummarize = async (
  projectId: string,
  bloggerId: string,
  subscribeId: string
) => {
  const textPath = buildSubscribeMediaPath(projectId, bloggerId, subscribeId, 'text.md')
  if (!window.preload.fs.existsSync(textPath)) throw new Error('转写文案不存在，请先转写')
  const summaryPath = buildSubscribeMediaPath(projectId, bloggerId, subscribeId, 'summary.md')
  const text = await window.preload.fs.readTextFile(textPath)
  await updateVideoStatus(projectId, bloggerId, subscribeId, {
    status: 'summarizing',
    error: undefined
  })
  try {
    const summary = await summarizeText(text)
    await window.preload.fs.writeTextFile(summaryPath, summary)
    await updateVideoStatus(projectId, bloggerId, subscribeId, { status: 'summarized' })
  } catch (e) {
    await updateVideoStatus(projectId, bloggerId, subscribeId, {
      status: 'error',
      error: toErrorMessage(e)
    })
    throw e
  }
}

/**
 * 一键处理：下载 → 提取音频 → 转写 → 总结
 */
export const subscribeProcessItem = async (
  projectId: string,
  bloggerId: string,
  subscribeId: string
) => {
  const blogger = await subscribeBloggerGet(projectId, bloggerId)
  if (!blogger) throw new Error('博主不存在')
  await subscribeDownload(projectId, bloggerId, subscribeId)
  await subscribeExtractAudio(projectId, bloggerId, subscribeId)
  await subscribeTranscribe(projectId, bloggerId, subscribeId, blogger.recognize)
  await subscribeSummarize(projectId, bloggerId, subscribeId)
}
