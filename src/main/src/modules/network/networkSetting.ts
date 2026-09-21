/**
 * 网络设置（main 进程）：~/.mistrelle/setting/network.json 的读写。
 * main 是该设置的数据家：通用 axios 客户端（appAxios）每次请求经 loadNetworkSetting 取值。
 * 内存缓存 + 写时刷新：saveNetworkSetting 是唯一写入口，落盘后同步更新缓存，
 * 读操作零磁盘 IO；应用外手改文件不感知（契约内不支持）。
 * 归一化契约在 @common/types/networkSetting（main 与渲染层共用）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import {
  normalizeNetworkSetting,
  type SettingNetwork
} from '@common/types/networkSetting'

/** 内存缓存：null = 尚未读盘（首次 load 惰性读一次） */
let cache: SettingNetwork | null = null

function settingFilePath(): string {
  return join(app.getPath('home'), '.mistrelle', 'setting', 'network.json')
}

function readFromDisk(): SettingNetwork {
  const file = settingFilePath()
  if (!existsSync(file)) return normalizeNetworkSetting(null)
  try {
    return normalizeNetworkSetting(JSON.parse(readFileSync(file, 'utf-8')))
  } catch (error) {
    console.error('[network] 网络设置读取失败，使用默认配置', error)
    return normalizeNetworkSetting(null)
  }
}

/** 读取网络设置：命中缓存直接返回（缺失 / 损坏 / 缺字段一律归一化回退默认，不回写） */
export function loadNetworkSetting(): SettingNetwork {
  if (!cache) cache = readFromDisk()
  return cache
}

/** 全量覆写落盘（渲染层设置页保存经 IPC 调用）：唯一写入口，落盘后同步刷新缓存 */
export function saveNetworkSetting(setting: SettingNetwork): SettingNetwork {
  const normalized = normalizeNetworkSetting(setting)
  const file = settingFilePath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(normalized, null, 2), 'utf-8')
  cache = normalized
  return normalized
}
