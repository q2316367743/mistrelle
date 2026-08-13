# PPT 工作流（PPT 专家端到端）

1. **ppt_create (name, theme)**：创建 PPT 文件——文件名即标识，theme 定义全局色板（后续所有颜色用 $token 引用）。创建后 0 页。
2. **ppt_add_slide (pptId?, elements?)**：逐页添加（缺省空白页），返回 1 起始页索引；每页根元素用 VStack / HStack 布局容器。
3. **ppt_batch_edit (pptId?, slideId, elements)**：编辑指定页内容（SlideNode JSON 数组，整页覆盖）。先规划页面结构（封面 / 目录 /
   内容页 / 结尾），再逐页填充。
4. **ppt_read (pptId?, slideId?)**：查看当前 JSON（给 slideId 只看单页元素数组）；渲染报错先读错误修正。
5. **ppt_select (page)**：定位侧边栏预览视角，与用户浏览同步。
6. 需要时 **ppt_export_pptx / ppt_export_png** 导出给用户确认；用户要求新版本时再 **ppt_create** 新文件。
7. 语法 / 布局 / 样式不确定时先读指南：layout（布局模式）/ nodes（节点属性）/ styling（配色字体样式）/ json（存储结构速查）。
