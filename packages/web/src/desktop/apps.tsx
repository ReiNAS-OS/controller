/**
 * 应用注册表。
 *
 * 每个应用是「一条定义 + 一个渲染函数」。Dock 从这里取图标和名字，
 * 桌面从这里取窗口内容。
 *
 * 现在只有「设置」一个。加应用时在 APPS 里加一项即可，别的地方不用动。
 */

import type { ReactNode } from "react";
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

export const APPS: AppDefinition[] = [
  {
    id: "settings",
    name: "设置",
    icon: <GearIcon />,
    defaultSize: { width: 760, height: 520 },
    render: () => <SettingsApp />,
  },
];

export function findApp(appId: string): AppDefinition | undefined {
  return APPS.find((app) => app.id === appId);
}
