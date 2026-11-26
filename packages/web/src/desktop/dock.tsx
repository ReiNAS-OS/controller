/**
 * 左侧 Dock。macOS 风格：竖排、毛玻璃背景、图标悬停放大。
 *
 * 现在只放一个「设置」。图标用内联 SVG 而不是图标库——一个图标不值得
 * 引 200 KB 的依赖，而且这里迟早要换成自己的品牌图标。
 *
 * 运行中的窗口会在图标下方点一个小圆点，这是 macOS 的惯例，用来区分
 * 「应用开着」和「没开」。
 */

import type { AppDefinition } from "./apps.ts";

interface DockProps {
  apps: AppDefinition[];
  /** 有打开窗口的 appId 集合，用来画运行指示点 */
  running: Set<string>;
  onLaunch: (appId: string) => void;
}

export function Dock({ apps, running, onLaunch }: DockProps) {
  return (
    <nav className="dock" aria-label="应用">
      {apps.map((app) => (
        <button
          key={app.id}
          type="button"
          className="dock__item"
          onClick={() => onLaunch(app.id)}
          title={app.name}
          aria-label={app.name}
        >
          <span className="dock__icon">{app.icon}</span>
          <span className="dock__label">{app.name}</span>
          {running.has(app.id) && <span className="dock__dot" aria-hidden="true" />}
        </button>
      ))}
    </nav>
  );
}
