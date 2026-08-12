# 应用图标生成机制

## 实现思路

应用图标**不需要手动预生成** `.ico` / `.icns`。electron-builder（v26+）内置图标转换工具集（`icon-tool.js` + `resvg.wasm`，首次使用时自动下载缓存），打包时自动把 `build/icon.png` 转换为各平台所需格式。

## 关键文件与契约

| 文件 | 角色 |
|------|------|
| `resources/icon.png` | 设计稿源图（项目资源，256×256） |
| `build/icon.png` | 打包图标源，与 `resources/icon.png` 保持同一文件 |
| `build/icon.ico` / `build/icon.icns` | **已删除**，不再手动维护 |

`electron-builder.yml` 中 `buildResources: build`，electron-builder 按优先级查找图标：显式 `mac.icon`/`win.icon` → `icon.<format>` → `icon.png` → `icon.svg`。

## 注意事项

- **不要**在 `build/` 下放置预生成的 `icon.ico` / `icon.icns`：若存在，builder 会原样使用而跳过转换，导致源图更新不生效。
- 更新图标流程：替换 `resources/icon.png` → 同步覆盖 `build/icon.png` → 重新打包即自动生成全尺寸图标。
- 当前源图为 256×256，Windows 达标、macOS Retina 下略糊；如需最佳效果升级为 1024×1024。
