const isAppleDevice = typeof navigator !== 'undefined' && (() => {
  const platform = navigator.platform ?? '';
  const userAgent = navigator.userAgent ?? '';
  if (/windows|linux|android|cros/i.test(userAgent)) return false;
  return /mac|iphone|ipad|ipod/i.test(platform) || /macintosh|mac os x|iphone|ipad|ipod/i.test(userAgent);
})();

export const isApple = isAppleDevice;

export const MOD = isApple ? '⌘' : 'Ctrl';
export const SHIFT = isApple ? '⇧' : 'Shift';
export const ALT = isApple ? '⌥' : 'Alt';

export const SHORTCUTS = {
  palette: `${MOD} K`,
  save: `${MOD} S`,
  slash: '/',
  openLink: `${MOD} + 点击`,
  close: 'Esc',
  cheatsheet: '?',
} as const;

export interface ShortcutGroup {
  title: string;
  items: { label: string; keys: string }[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: '全局',
    items: [
      { label: '打开命令面板 / 搜索', keys: SHORTCUTS.palette },
      { label: '保存当前文档', keys: SHORTCUTS.save },
      { label: '关闭面板或菜单', keys: SHORTCUTS.close },
      { label: '打开这张速查表', keys: SHORTCUTS.cheatsheet },
    ],
  },
  {
    title: '编辑器内',
    items: [
      { label: '插入块 / 命令菜单', keys: SHORTCUTS.slash },
      { label: '在新标签页打开链接', keys: SHORTCUTS.openLink },
    ],
  },
];
