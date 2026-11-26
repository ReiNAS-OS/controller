/**
 * 应用注册表。
 *
 * 每个应用是「一条定义 + 一个渲染函数」。Dock 从这里取图标和名字，
 * 桌面从这里取窗口内容。
 *
 * 现在只有「设置」一个。加应用时在 APPS 里加一项即可，别的地方不用动。
 */

import type { ReactNode } from "react";
import { FilesApp } from "./apps/files-app.tsx";
import { SettingsApp } from "./apps/settings-app.tsx";

export interface AppDefinition {
  /** 唯一标识，窗口的 appId 指向它 */
  id: string;
  /** Dock 和标题栏显示的名字 */
  name: string;
  /** Dock 图标 */
  icon: ReactNode;
  /** 默认窗口尺寸 */
  defaultSize: { width: number; height: number };
  /**
   * 是否单例（只能开一个窗口）。
   *
   * 设置这类应用是单例：重复点 Dock 只是把已有窗口提到前面，不会开第二个。
   * 文件管理不是：用户经常要开两个窗口对比目录，所以每次都开新的，
   * 并级联错开位置。
   */
  singleton: boolean;
  /** 窗口内容 */
  render: () => ReactNode;
}

/** 齿轮图标。线性风格，跟 Win11 的控件图标一套语言。 */
function GearIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
    </svg>
  );
}

/** 文件夹图标。线性风格，跟齿轮一套语言。 */
function FolderIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7.2c0-1 .8-1.8 1.8-1.8h3.9c.5 0 1 .2 1.3.6l1 1.1c.3.4.8.6 1.3.6h6.4c1 0 1.8.8 1.8 1.8v8.7c0 1-.8 1.8-1.8 1.8H4.8c-1 0-1.8-.8-1.8-1.8V7.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M3 10.4h18" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
    </svg>
  );
}

export const APPS: AppDefinition[] = [
  {
    id: "files",
    name: "文件管理",
    icon: <FolderIcon />,
    defaultSize: { width: 880, height: 560 },
    // 开多个对比目录是常见操作，不设单例
    singleton: false,
    render: () => <FilesApp />,
  },
  {
    id: "settings",
    name: "设置",
    icon: <GearIcon />,
    defaultSize: { width: 760, height: 520 },
    // 设置开一个就够了，重复点只是提到前面
    singleton: true,
    render: () => <SettingsApp />,
  },
];

export function findApp(appId: string): AppDefinition | undefined {
  return APPS.find((app) => app.id === appId);
}
