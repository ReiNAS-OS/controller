/**
 * 窗口拖动与缩放的手势逻辑。
 *
 * 为什么用 pointer events 而不是 react-rnd：窗口系统还要加吸附、分屏、
 * 动画，依赖库的外层 API 会把这些卡住。原生 pointer 事件几百行就够，且
 * 能直接拿到 setPointerCapture —— 指针拖到窗口外面也不丢事件，这是拖动
 * 手感的关键（用 mousemove 监听 window 时，快速拖出窗口会断）。
 *
 * 拖动过程中**不写进 reducer**，只在 pointerup 时提交一次，中间用局部
 * state 直接改 transform。原因：50+ 次/秒的 reducer dispatch 会让整棵树
 * 重渲染，开三个窗口就明显掉帧。
 */

import { useCallback, useRef, useState } from "react";
import type { Rect } from "./window-types.ts";

/** 缩放方向。一条边或一个角。 */
export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** 窗口的最小尺寸，防止拖成一条线。 */
const MIN_WIDTH = 320;
const MIN_HEIGHT = 200;

/** 标题栏至少要留在舞台内的宽度，太窄就抓不住。 */
const MIN_TITLE_VISIBLE = 120;

/** 舞台尺寸。拖动要按它夹边界，否则标题栏会移出可视区。 */
export interface StageBounds {
  width: number;
  height: number;
}

/**
 * 把窗口位置夹在舞台内，保证标题栏始终可抓。
 *
 * 两条约束，缺一条都会变成「窗口再也拖不回来」：
 *
 *   1. **顶部不能出去**：标题栏移出上边界就够不着，窗口等于锁死。
 *   2. **左右至少留一截**：完全移出左侧/右侧同理。留 MIN_TITLE_VISIBLE
 *      而不是 0，是因为只露 1px 也拖不回来。
 *
 * 底部不夹：窗口可以比舞台高（比如最大化前被拖到很下面），下面的内容
 * 看不见但标题栏还在，能拖回来。
 */
function clampToStage(rect: Rect, stage: StageBounds): Rect {
  const maxX = stage.width - MIN_TITLE_VISIBLE;
  const maxY = stage.height - 40; // 40 = 标题栏高度，留一整条

  return {
    ...rect,
    x: Math.min(Math.max(rect.x, MIN_TITLE_VISIBLE - rect.width), maxX),
    y: Math.min(Math.max(rect.y, 0), Math.max(0, maxY)),
  };
}

/** 拖动过程中的临时几何，只在本地 state 里存在。 */
export interface LiveGeometry {
  rect: Rect;
  /** 正在拖动/缩放（用来加过渡动画或改光标） */
  active: boolean;
}

interface DragOrigin {
  pointerX: number;
  pointerY: number;
  rect: Rect;
}

/**
 * 拖动标题栏移动窗口。
 *
 * `onCommit` 在松手时调用一次，把最终位置交给 reducer。
 */
export function useWindowDrag(startRect: Rect, onCommit: (rect: Rect) => void, stage: StageBounds) {
  const originRef = useRef<DragOrigin | null>(null);
  const [live, setLive] = useState<LiveGeometry>({ rect: startRect, active: false });

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // 只响应主键，右键和触控板的双指点击不触发拖动
      if (event.button !== 0) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      originRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        rect: startRect,
      };
      setLive({ rect: startRect, active: true });
    },
    [startRect],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const origin = originRef.current;
      if (!origin) {
        return;
      }
      const dx = event.clientX - origin.pointerX;
      const dy = event.clientY - origin.pointerY;

      // 夹在舞台内：标题栏不能被拖出可视区，否则窗口再也抓不回来
      setLive({
        rect: clampToStage({ ...origin.rect, x: origin.rect.x + dx, y: origin.rect.y + dy }, stage),
        active: true,
      });
    },
    [stage],
  );

  const finish = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!originRef.current) {
        return;
      }
      originRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setLive((prev) => ({ rect: prev.rect, active: false }));
      onCommit(live.rect);
    },
    [live.rect, onCommit],
  );

  return {
    /** 应用到窗口上的实时矩形 */
    rect: live.rect,
    active: live.active,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  };
}

/**
 * 从某个边/角缩放窗口。
 *
 * 缩放逻辑和拖动共用一套 pointer 捕获，区别在于要按方向调整 x/y 和宽高：
 * 拖左边要把 x 往左移同时加宽，拖右边只加宽、x 不变。写成表驱动比八个
 * if 分支清楚。
 */
export function useWindowResize(startRect: Rect, onCommit: (rect: Rect) => void) {
  const originRef = useRef<{ pointerX: number; pointerY: number; rect: Rect } | null>(null);
  const edgeRef = useRef<ResizeEdge>("se");
  const [live, setLive] = useState<LiveGeometry>({ rect: startRect, active: false });

  const begin = useCallback(
    (edge: ResizeEdge) => (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      originRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        rect: startRect,
      };
      edgeRef.current = edge;
      setLive({ rect: startRect, active: true });
    },
    [startRect],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const origin = originRef.current;
    if (!origin) {
      return;
    }
    const dx = event.clientX - origin.pointerX;
    const dy = event.clientY - origin.pointerY;
    setLive({ rect: applyResize(origin.rect, edgeRef.current, dx, dy), active: true });
  }, []);

  const finish = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!originRef.current) {
        return;
      }
      originRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setLive((prev) => ({ rect: prev.rect, active: false }));
      onCommit(live.rect);
    },
    [live.rect, onCommit],
  );

  return {
    rect: live.rect,
    active: live.active,
    begin,
    handlers: {
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  };
}

/**
 * 按方向算缩放后的矩形。
 *
 * 拖左边时宽度增加、x 减少，所以 left 方向要同时改两个值。左/上方向还要
 * 夹住最小尺寸——否则继续往右拖会让宽度变负，窗口翻面。
 */
function applyResize(start: Rect, edge: ResizeEdge, dx: number, dy: number): Rect {
  const west = edge.includes("w");
  const east = edge.includes("e");
  const north = edge.includes("n");
  const south = edge.includes("s");

  let { x, y, width, height } = start;

  if (east) {
    width = Math.max(MIN_WIDTH, start.width + dx);
  }
  if (south) {
    height = Math.max(MIN_HEIGHT, start.height + dy);
  }
  if (west) {
    // 宽度先按最小值夹住，再用「右边界不动」反推 x
    width = Math.max(MIN_WIDTH, start.width - dx);
    x = start.x + (start.width - width);
  }
  if (north) {
    height = Math.max(MIN_HEIGHT, start.height - dy);
    y = start.y + (start.height - height);
  }

  return { x, y, width, height };
}

export { MIN_WIDTH, MIN_HEIGHT };
