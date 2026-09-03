/**
 * 串口连接状态（模块级单例）：主进程端口本就是单例存活，
 * 渲染层镜像一份状态，路由切换（本页面无 keep-alive）后回到页面仍能看到当前连接。
 */
import { MessageUtil } from '@/utils/modal'

const ports = ref<SerialPortItem[]>([])
const selectedPath = ref('')
const connectedPath = ref('')
const connecting = ref(false)
const listing = ref(false)
/** 硬件调试模式：开启后页面显示手动测试面板 */
const debugMode = ref(false)

let initialized = false

/** 拉取串口设备列表（保持当前选择） */
async function refreshPorts(): Promise<void> {
  listing.value = true
  try {
    ports.value = await window.preload.serial.list()
  } catch (e) {
    MessageUtil.error('获取串口列表失败：' + (e as Error).message)
  } finally {
    listing.value = false
  }
}

/** 连接指定串口（9600，与 Arduino 端一致）；成功不弹提示（状态标签已表达） */
async function connect(path: string): Promise<void> {
  connecting.value = true
  try {
    await window.preload.serial.open(path)
    connectedPath.value = path
  } catch (e) {
    connectedPath.value = ''
    MessageUtil.error('串口连接失败：' + (e as Error).message)
  } finally {
    connecting.value = false
  }
}

/** 断开当前连接 */
async function disconnect(): Promise<void> {
  try {
    await window.preload.serial.close()
  } finally {
    connectedPath.value = ''
  }
}

/** 下拉选择变化：选中即尝试连接；清空选择则断开（t-select 清空时值为空） */
function handleSelect(value: unknown): void {
  const path = typeof value === 'string' ? value : ''
  if (path === connectedPath.value) return
  if (!path) {
    void disconnect()
    return
  }
  void connect(path)
}

/** 写入一条指令（自动补换行，Arduino 端按 \n 分帧） */
async function sendCommand(code: string): Promise<void> {
  try {
    await window.preload.serial.write(code + '\n')
  } catch (e) {
    MessageUtil.error('指令发送失败：' + (e as Error).message)
  }
}

export function useSerialLink() {
  if (!initialized) {
    initialized = true
    // 初始化时同步主进程已有连接（如切页前残留）并订阅断开推送
    void window.preload.serial.getState().then((state) => {
      if (state.isOpen && state.path) {
        connectedPath.value = state.path
        selectedPath.value = state.path
      }
    })
    window.preload.serial.onClosed(() => {
      connectedPath.value = ''
      MessageUtil.warning('串口连接已断开')
    })
    void refreshPorts()
  }
  return {
    ports,
    selectedPath,
    connectedPath,
    connecting,
    listing,
    debugMode,
    refreshPorts,
    handleSelect,
    disconnect,
    sendCommand
  }
}
