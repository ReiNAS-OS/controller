/**
 * 窗口状态管理。
 *
 * 用 useReducer + 纯 reducer，不用 useState 堆一堆 setter：
 * 窗口操作是有序事件（打开、置顶、移动、缩放、最小化、关闭），reducer 能
 * 保证每次转换都基于前一个状态，不会出现「拖动时另一个窗口被点开」这类
 * 竞态导致的错乱。
 *
 * 所有操作返回新数组/新对象，不原地改——React 靠引用变了才知道要重渲染。
 */

import type { Rect, WindowState } from "./window-types.ts";

/**
 * 窗口层级的起点。
 *
 * 必须和 style.css 的 `--z-window-base` 一致。窗口之间靠这个基准往上叠加，
 * 只需要相对顺序正确；但和 Dock / 顶栏的相对关系是硬要求，所以那边也定义
 * 了同一组变量。改层级时两处一起改。
 *
 * 完整顺序见 style.css `:root` 的 `--z-*` 注释。
 */
const Z_BASE = 100;

/** 每开一个新窗口，位置往右下错开这么多，避免完全重叠。 */
const CASCADE_OFFSET = 28;

export type WindowAction =
  | {
      type: "open";
      id: string;
      appId: string;
      title: string;
      /** 初始尺寸，由应用定义提供。传进来而不是在这里写死，
         否则所有应用的窗口一样大，AppDefinition.defaultSize 就成了摆设。 */
      size: { width: number; height: number };
    }
  | { type: "close"; id: string }
  | { type: "focus"; id: string }
  | { type: "minimize"; id: string }
  | { type: "restore"; id: string }
  | { type: "toggleMaximize"; id: string }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "resize"; id: string; rect: Rect };

/**
 * 计算下一个层叠值。
 *
 * 用「当前最大值 + 1」而不是「窗口数量」：关掉中间某个窗口后数量会减少，
 * 用数量会撞号，导致新窗口跑到旧窗口下面。
 */
function nextZ(windows: WindowState[]): number {
  return windows.reduce((max, win) => Math.max(max, win.z), Z_BASE) + 1;
}

/**
 * 新窗口的初始位置：按已开窗口数级联，尺寸由应用决定。
 *
 * 这里不做边界夹取——初始位置固定在左上角附近，一定可见。窗口一旦被拖动
 * 才会经过 clampToStage（见 use-window-gestures.ts）。
 */
function initialRect(index: number, size: { width: number; height: number }): Rect {
  const offset = (index % 6) * CASCADE_OFFSET;
  return {
    width: size.width,
    height: size.height,
    x: 64 + offset,
    y: 56 + offset,
  };
}

/** 把某个窗口提到最前，其余不动。 */
function raise(windows: WindowState[], id: string): WindowState[] {
  const target = windows.find((win) => win.id === id);
  if (!target || target.z === nextZ(windows) - 1) {
    // 已经在最前，不用重排
    return windows;
  }
  const z = nextZ(windows);
  return windows.map((win) => (win.id === id ? { ...win, z } : win));
}

export function windowReducer(windows: WindowState[], action: WindowAction): WindowState[] {
  switch (action.type) {
    case "open": {
      const rect = initialRect(windows.length, action.size);
      const created: WindowState = {
        ...rect,
        id: action.id,
        appId: action.appId,
        title: action.title,
        z: nextZ(windows),
        minimized: false,
        maximized: false,
      };
      return [...windows, created];
    }

    case "close":
      return windows.filter((win) => win.id !== action.id);

    case "focus": {
      const raised = raise(windows, action.id);
      // 点窗口同时取消最小化：从任务栏点回来时应该能看见
      return raised.map((win) => (win.id === action.id ? { ...win, minimized: false } : win));
    }

    case "minimize":
      return windows.map((win) => (win.id === action.id ? { ...win, minimized: true } : win));

    case "restore":
      return raise(
        windows.map((win) => (win.id === action.id ? { ...win, minimized: false } : win)),
        action.id,
      );

    case "toggleMaximize":
      return windows.map((win) =>
        win.id === action.id ? { ...win, maximized: !win.maximized } : win,
      );

    case "move":
      return windows.map((win) =>
        win.id === action.id ? { ...win, x: action.x, y: action.y } : win,
      );

    case "resize":
      return windows.map((win) => (win.id === action.id ? { ...win, ...action.rect } : win));

    default:
      return windows;
  }
}
