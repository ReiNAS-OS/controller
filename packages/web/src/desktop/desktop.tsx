/**
 * 桌面：壁纸 + 左侧 Dock + 窗口层。
 *
 * 整个页面就是一个「操作系统桌面」，不是网页里嵌后台。这是产品的核心
 * 形态——浏览器打开看到的应该像一台机器。
 *
 * 窗口的定位基准是舞台（stage），也就是顶栏以下的整个视口。舞台铺满宽度
 * （left: 0），窗口才能滑到 Dock 底下；尺寸用 ResizeObserver 跟着视口变，
 * 最大化窗口才能正确铺满。
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { APPS, findApp } from "./apps.tsx";
import { Dock } from "./dock.tsx";
import { WindowFrame } from "./window-frame.tsx";
import { windowReducer } from "./window-reducer.ts";
import type { WindowAction } from "./window-reducer.ts";
import type { WindowState } from "./window-types.ts";

/** 顶栏时间，每秒刷新。 */
function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

/** 舞台尺寸跟着视口走。窗口最大化要铺满这块区域。 */
function useStageSize() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 1280, height: 800 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setStage({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { stage, stageRef };
}

/** 最小化的窗口条。免得最小化之后找不回来。 */
function MinimizedBar(props: { windows: WindowState[]; onRestore: (id: string) => void }) {
  const minimized = props.windows.filter((win) => win.minimized);
  if (minimized.length === 0) {
    return null;
  }
  return (
    <div className="desktop__minimized">
      {minimized.map((win) => (
        <button
          key={win.id}
          type="button"
          className="desktop__minimized-item"
          onClick={() => props.onRestore(win.id)}
        >
          {win.title}
        </button>
      ))}
    </div>
  );
}

/** 窗口层。每个窗口包一层 WindowFrame。 */
function WindowLayer(props: {
  windows: WindowState[];
  stage: { width: number; height: number };
  activeId: string | null;
  dispatch: React.Dispatch<WindowAction>;
}) {
  const { windows, stage, activeId, dispatch } = props;
  return (
    <>
      {windows.map((win) => {
        const app = findApp(win.appId);
        if (!app || win.minimized) {
          return null;
        }
        return (
          <WindowFrame
            key={win.id}
            window={win}
            stage={stage}
            active={win.id === activeId}
            onFocus={() => dispatch({ type: "focus", id: win.id })}
            onClose={() => dispatch({ type: "close", id: win.id })}
            onMinimize={() => dispatch({ type: "minimize", id: win.id })}
            onToggleMaximize={() => dispatch({ type: "toggleMaximize", id: win.id })}
            onMove={(x, y) => dispatch({ type: "move", id: win.id, x, y })}
            onResize={(rect) => dispatch({ type: "resize", id: win.id, rect })}
          >
            {app.render()}
          </WindowFrame>
        );
      })}
    </>
  );
}

export function Desktop() {
  const [windows, dispatch] = useReducer(windowReducer, []);
  const { stage, stageRef } = useStageSize();
  const clock = useClock();

  /** 最上层的非最小化窗口，用来算哪个窗口是「活动」的。 */
  const activeId = useMemo(() => {
    const visible = windows.filter((win) => !win.minimized);
    if (visible.length === 0) {
      return null;
    }
    return visible.reduce((top, win) => (win.z > top.z ? win : top)).id;
  }, [windows]);

  /** 有窗口的应用 id 集合，Dock 据此画运行指示点。 */
  const running = useMemo(() => new Set(windows.map((win) => win.appId)), [windows]);

  const launch = useCallback(
    (appId: string) => {
      const app = findApp(appId);
      if (!app) {
        return;
      }
      // 已经开着就把它提到前面，不重复开窗口
      const existing = windows.find((win) => win.appId === appId);
      if (existing) {
        dispatch({ type: "restore", id: existing.id });
        return;
      }
      dispatch({ type: "open", id: `${appId}-${Date.now()}`, appId, title: app.name });
    },
    [windows],
  );

  return (
    <div className="desktop">
      {/* 壁纸层。纯 CSS 渐变，不加载图片——镜像体积有限，且渐变缩放不糊。 */}
      <div className="desktop__wallpaper" aria-hidden="true" />

      <div className="desktop__topbar">
        <span className="desktop__brand">ReiNAS</span>
        <span className="desktop__clock">{clock}</span>
      </div>

      <Dock apps={APPS} running={running} onLaunch={launch} />

      <div className="desktop__stage" ref={stageRef}>
        <WindowLayer windows={windows} stage={stage} activeId={activeId} dispatch={dispatch} />
        <MinimizedBar windows={windows} onRestore={(id) => dispatch({ type: "restore", id })} />
      </div>
    </div>
  );
}
