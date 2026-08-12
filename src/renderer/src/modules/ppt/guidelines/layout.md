# POM 布局系统经验（来自官方 layout-system 文档转写）

## 1. 布局模型：Flexbox

- 底层由 yoga-layout 驱动， **Flexbox 风格布局**；只有两种布局容器：
  - `VStack`：子元素 **从上到下**（主轴 = 垂直，交叉轴 = 水平）
  - `HStack`：子元素 **从左到右**（主轴 = 水平，交叉轴 = 垂直）
- 铁律： **页面根元素必须是 VStack / HStack**；复杂页面 = 垂直分组用 VStack、水平分组用 HStack， **层层嵌套**。
- HStack 子元素默认可收缩（同 CSS flexShrink=1），百分比宽度 + gap 会自动收缩适配父容器。

## 2. 尺寸规则

| 写法                  | 行为                                                    |
|-----------------------|---------------------------------------------------------|
| `w="400"`             | 固定像素宽                                              |
| `w="max"`             | 沿父级主轴撑满剩余空间（同 flexGrow=1）                 |
| `w="50%"`             | 父容器百分比                                            |
| `grow="2"`            | 兄弟间按比例分配主轴剩余空间（与 max 同用时 grow 优先） |
| `minW/maxW/minH/maxH` | 尺寸上下限约束                                          |

- `w="max" h="max"` 让容器铺满整张幻灯片（页面根容器标配）。
- 比例分栏：`<HStack w="max" h="max" gap="16">` 内放 `grow="2"` 与 `grow="1"` 两个 VStack = 2:1 两栏。

## 3. 间距规则

- `gap`： **子元素之间**间距（VStack/HStack 专属；不含首尾外侧）
- `padding`：容器内部边缘与内容间距（所有节点；支持 `padding="24"` 或单侧 `padding.top`）
- `margin`：元素外部间距（推开相邻元素；支持单侧 `margin.top`）
- 经验： **优先用 gap 控制间距**，不要用 margin 反复微调；页面四周 padding ≥ 40。

## 4. 对齐规则

- `alignItems`： **交叉轴**对齐（默认 `stretch` 拉伸填满）：start / center / end / stretch
  - VStack 中控制子元素水平位置；HStack 中控制垂直位置
- `justifyContent`： **主轴**对齐（默认 start）：start / center / end / spaceBetween / spaceAround / spaceEvenly
- `alignSelf`：子元素单独覆盖父级 alignItems
- 页面级居中：`<VStack w="max" h="max" justifyContent="center" alignItems="center">`

## 5. 换行与绝对定位

- `flexWrap`：nowrap（默认）/ wrap / wrapReverse（HStack 换新行、VStack 换新列）
- `position="absolute"` + `top/right/bottom/left`：脱离文档流，不影响兄弟布局
  - 典型：页码角标 `bottom="16" right="16"`；`<Layer>` 容器内做绝对定位叠放

## 6. 五种可直接套用的布局模式

1. **Header + Content（页头 + 内容）**：外层 VStack（`w="max" h="max"` + padding + gap），先标题组（标题 + 副标题），再内容区。
2. **Two-Column（两栏）**：HStack 内放两个 VStack 卡片（卡片加 `backgroundColor` + `borderRadius`）；HStack 子元素无显式宽度时
   **均分可用空间**。
3. **Three-Column Cards（三卡片）**：HStack + 三个 VStack 卡片，卡片用 `border.color` / `border.width` 描边，内部放指标名 +
   数值。
4. **Centered（居中页）**：`justifyContent="center" alignItems="center"` + `w="max" h="max"`（封面 / 章节页）。
5. **Sidebar（侧栏布局）**：HStack 内左侧 VStack 设 `w="25%" h="max"` 做深色导航栏（`backgroundColor` 深色 + 浅色文字），右侧
   VStack 做主要内容区。

## 7. 布局最佳实践

- 嵌套原则： **垂直分组用 VStack，水平分组用 HStack，按需层层嵌套**——先规划页面分区，再填内容。
- 间距用 `gap` 而非反复 margin；比例分配用 `grow` / 百分比而非硬编码像素。
- 卡片化：信息块放进带 `backgroundColor="FFFFFF" borderRadius="8" padding="24"` 的卡片容器，视觉更专业。
- 对齐优先于微调：同组元素靠容器对齐，不靠手调坐标。
- ⚠️ **布局边界（已自动规避）**：胶囊标签 / 徽章 / 图标+文字组合避免「HStack 直接嵌套无宽度的 HStack 再放文本」——POM 对嵌套 HStack 链中无显式宽度的文本测量会产生 NaN 宽度导致构建失败；系统已自动为受影响文本补 `w="max"`，若仍遇到 `addTextBox: width must be a finite positive EMU value` 错误，请给文本或容器显式宽度（如 `w="max"`）。
