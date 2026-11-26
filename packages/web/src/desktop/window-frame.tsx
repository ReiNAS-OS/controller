/**
 * 窗口外壳。Windows 11 风格：右上角三个按钮（最小化 / 最大化 / 关闭），
 * 标题靠左，圆角 + 阴影 + 半透明边框。
 *
 * 和 macOS 的区别是控制按钮在右上、图标是线性字形而不是彩色圆点；
 * 但整页的桌面和 Dock 是 macOS 风格——这个组合是你指定的。
 *
 * 缩放手柄铺在四边四角，用 CSS 定位的细条，看不见但可拖。
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Rect, WindowState } from "./window-types.ts";
import { useWindowDrag, useWindowResize } from "./use-window-gestures.ts";
import type { ResizeEdge } from "./use-window-gestures.ts";

interface WindowFrameProps {
  window: WindowState;
  /** 舞台尺寸，最大化时用 */
  stage: { width: number; height: number };
  active: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (rect: Rect) => void;
  children: ReactNode;
}

/** 四边四角。顺序影响 DOM，不影响表现。 */
const EDGES: ResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

/** 最大化图标：一个空心方块。 */
function MaximizeGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="7"
        height="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/**
 * 还原图标：两个叠起来的方块。
 *
 * Win11 的画法是一个完整的框 + 一个错开的后框。用 path 画后框的
 * 三段折线（省掉被前框挡住的那一截），比两个 rect 叠着更像系统图标。
 */
function RestoreGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      {/* 后框：只画露出来的右上和右下两段 */}
      <path
        d="M3 3V1.5h5.5V7H7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {/* 前框 */}
      <rect
        x="1.5"
        y="3"
        width="5.5"
        height="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/**
 * 三个几何来源里挑当前生效的那个。
 *
 * 写成函数而不是嵌套三元：lint 禁嵌套三元，而且这里本来就该说清楚优先级
 * ——拖动 > 缩放 > 已提交的值。
 */
function pickRect(
  base: Rect,
  drag: { rect: Rect; active: boolean },
  resize: { rect: Rect; active: boolean },
): Rect {
  if (drag.active) {
    return drag.rect;
  }
  if (resize.active) {
    return resize.rect;
  }
  return base;
}

export function WindowFrame(props: WindowFrameProps) {
  const { window, stage, active, onFocus, onClose, onMinimize, onToggleMaximize, onMove } = props;

  // 最大化时忽略拖动和缩放：几何值由舞台决定，拖不动是正确行为
  const base: Rect = window.maximized
    ? { x: 0, y: 0, width: stage.width, height: stage.height }
    : { x: window.x, y: window.y, width: window.width, height: window.height };

  const commitMove = useMemo(() => (rect: Rect) => onMove(rect.x, rect.y), [onMove]);
  const drag = useWindowDrag(base, commitMove, stage);
  const resize = useWindowResize(base, props.onResize);

  // 拖动/缩放中优先用实时几何，否则用 reducer 里的值
  const rect = pickRect(base, drag, resize);

  return (
    <section
      className={`win${active ? " win--active" : ""}${window.maximized ? " win--max" : ""}`}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: window.z,
      }}
      onPointerDown={onFocus}
      aria-label={window.title}
    >
      <header
        className="win__bar"
        // 最大化时标题栏不参与拖动（几何由舞台决定），但双击还原仍然有效
        {...(window.maximized ? {} : drag.handlers)}
        // 双击标题栏切换最大化。系统惯例，和点右上角那个按钮等价。
        onDoubleClick={onToggleMaximize}
      >
        <span className="win__title">{window.title}</span>

        <div className="win__controls" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="win__btn" onClick={onMinimize} aria-label="最小化">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            type="button"
            className="win__btn"
            onClick={onToggleMaximize}
            // 最大化时图标要变：两个叠起来的方块表示"还原"，单个方块表示"最大化"
            aria-label={window.maximized ? "还原" : "最大化"}
          >
            {window.maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
          </button>
          <button
            type="button"
            className="win__btn win__btn--close"
            onClick={onClose}
            aria-label="关闭"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" />
              <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </header>

      <div className="win__body">{props.children}</div>

      {/* 缩放手柄。最大化时全部隐藏。 */}
      {!window.maximized &&
        EDGES.map((edge) => (
          <div
            key={edge}
            className={`win__grip win__grip--${edge}`}
            onPointerDown={resize.begin(edge)}
            {...resize.handlers}
          />
        ))}
    </section>
  );
}
