/**
 * 应用根组件。
 *
 * 从 M0 的「两块卡片」换成完整桌面：整个页面就是一个操作系统界面。
 * 桌面逻辑全在 desktop/ 下，这里只做挂载，不放业务。
 */

import { Desktop } from "./desktop/desktop.tsx";

export function App() {
  return <Desktop />;
}
