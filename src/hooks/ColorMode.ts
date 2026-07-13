import {KeyValueUtil} from "@/utils/utools/KeyValueUtil";
import {isDarkColors} from "@/utils/utools/NativeUtil";

type ColorModeType = 'auto' | 'light' | 'dark';

interface ColorModeResult {
  colorMode: Ref<ColorModeType>;
  isDark: ComputedRef<boolean>;
}

export const useUtoolsColorMode = (): ColorModeResult => {
  const colorMode = ref<ColorModeType>(KeyValueUtil.getItem('/key/color-mode') || 'auto');
  const isDark = computed(() => {
    if (colorMode.value === 'dark') {
      return true;
    } else if (colorMode.value === 'light') {
      return false;
    }
    return isDarkColors();
  });

  function onAutoColor() {
    if (colorMode.value != 'auto') {
      return;
    }
    document.body.setAttribute('arco-theme', isDarkColors() ? 'dark' : 'light');

  }

  window.matchMedia("(prefers-color-scheme:dark)").addEventListener("change", onAutoColor);

  function renderColorMode() {
    if (colorMode.value === 'light') {
      document.body.setAttribute('arco-theme', 'light');
    } else if (colorMode.value === 'dark') {
      document.body.setAttribute('arco-theme', 'dark');
    } else {
      document.body.setAttribute('arco-theme', isDarkColors() ? 'dark' : 'light');
    }
  }

  renderColorMode();

  watch(colorMode, val => {
    KeyValueUtil.setItem('/key/color-mode', val);
    renderColorMode();
  });

  return {colorMode, isDark}

}