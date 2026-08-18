# PPT 工作流（PPT 专家端到端）

1. **ppt_create (name, theme, slideCount)**：创建 PPT 文件——文件名即标识，theme 定义全局色板（后续所有颜色用
   `$token` 引用），slideCount 指定初始页数（slide 数组放对应数量的空页）。建议先规划整份结构（封面 / 目录 / 内容页 / 结尾）。
2. **ppt_info (pptId)**：文档级信息（页数 / theme / 渲染错误）；**ppt_get_nodes (pptId, slideId, ids?)**：拿指定页
   完整元素树（含每个节点顶层 `id`）。编辑前先看元素树，拿到要操作的节点 id。
3. **ppt_batch_edit (pptId, slideId, operations)**：对指定页做**元素级批量操作**（insert / copy / update / move /
   delete，≤15 个/批，单操作容错）。语法速查读 `ppt_guidelines("operations")`。
4. **ppt_inspect (pptId, slideId, ids?)**：返回节点渲染后的**画布绝对包围盒**（与预览 / 导出视觉一致）。flex 布局后
   子节点的真实位置 / 尺寸由渲染决定（attr 只是输入）——编辑后核对元素位置、间距、对齐，或排查元素错位 / 溢出时用它；
   一次查 2~5 个关心节点直接相减即可算间距。
5. **ppt_add_slide (pptId)**：末尾加空白页；**ppt_delete_slide (pptId, slideId)**：删页（不可恢复）。
6. **ppt_set_theme (pptId, theme)**：整体换肤（更新 theme 令牌，$token 全篇联动）。
7. **ppt_select (page)**：定位侧边栏预览视角，与用户浏览同步。
8. 需要时 **ppt_export_pptx / ppt_export_png** 导出给用户确认；用户要求新版本时再 **ppt_create** 新文件。
9. 语法 / 布局 / 样式不确定时先读指南：operations（批量操作）/ layout（布局模式）/ nodes（节点属性）/
   styling（配色字体样式）/ json（存储结构速查）。
