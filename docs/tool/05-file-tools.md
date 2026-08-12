# 文件系统工具：image_info 与 file_stat

## 背景

`image_info` 原先基于 sharp metadata 返回 `format / width / height / size`，但 sharp metadata 的 `size`
字段并不可靠（可能返回 `undefined`，旧实现会兜底为 `0`，误导 AI）。

因此将两者职责分离：

- `image_info` 只负责**图片内容解析**（格式 / 宽高），不再返回 `size`。
- 文件大小等**文件系统信息**由新增的 `file_stat` 承担，基于 `fs.stat`，结果权威可靠。

## 实现思路

- `readImageInfo`（`src/utils/imageInfo.ts`）收敛为返回 `{ format, width, height }`，`ImageInfo` 接口删除
  `size` 字段。
- `src-utools/src/fs.js` 新增 `stat` 方法（复用 `node:fs/promises` 的 `stat`），手动转换字段返回普通对象，
  字段风格与 `readDir` 的 `FileItem` 一致。
- `file.ts` 中 `image_info` 返回去掉 `size`，并新增 `file_stat` 工具。

## 关键文件

- `src/utils/imageInfo.ts` — 图片解析，去掉 `size`
- `src-utools/src/fs.js` — preload 侧新增 `stat`
- `src/types/fs.d.ts` — 新增 `FileStat` 接口与 `FsApi.stat` 声明
- `src/modules/tool/components/native/file.ts` — `image_info` 调整 + 新增 `file_stat`

## API 契约

### image_info（调整）

输入：`{ path: string }`

输出：`{ path, format, width, height }`

- 去掉 `size` 字段。文件大小请调用 `file_stat`。

### file_stat（新增）

输入：`{ path: string }`

输出：

```json
{
  "path": "/abs/path",
  "isDirectory": false,
  "isFile": true,
  "size": 1024,
  "mtime": 1754553600000,
  "ctime": 1754553600000,
  "atime": 1754553600000,
  "birthtime": 1754553600000
}
```

- `risk: 'safe'`，同样经过沙盒黑名单校验（`checkBlacklist`）。
- 路径不存在 / 无法访问时返回 `{ error }`。
- 时间字段来自 `fs.stat`（Date），传输后为时间戳数值。

## 注意事项

- 调用方注意：`CanvasStore.ts`、`websiteLogo.ts` 仅使用 `format / width / height`，不受本次变更影响。
- 需要文件大小时应优先 `file_stat`（`fs.stat`），不要依赖 sharp metadata。
