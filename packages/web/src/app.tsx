/**
 * 应用启动分流。
 *
 * 三件事必须在渲染桌面之前确定：后端连不连得上、初始化过没有、状态是否
 * 还在加载。任何一个没定就渲染桌面，会出现「先闪一下桌面再跳初始化页」
 * 这种明显不对的表现。
 *
 * 用 ts-pattern 做穷尽匹配而不是 if 链：启动状态是会增加的东西（以后可能
 * 加「初始化失败」「需要迁移」「配置损坏」），match().exhaustive() 让漏掉
 * 一种状态变成编译错误，而不是运行时白屏。
 */

import { useEffect, useState } from "react";
import { match } from "ts-pattern";
import type { SetupStatus } from "@reinas/shared";
import { api, unwrap } from "./api.ts";
import { Desktop } from "./desktop/desktop.tsx";
import { BootScreen } from "./screens/boot-screen.tsx";
import { ErrorScreen } from "./screens/error-screen.tsx";
import { SetupPage } from "./screens/setup-page.tsx";

/**
 * 启动状态。
 *
 * `loading` 和 `error` 是**前端**的状态（还没拿到后端答复 / 拿不到），
 * `setup` 和 `ready` 是**后端**的状态（已拿到 SetupStatus 并翻译过来）。
 * 这两类刻意放在一个联合里，因为界面上它们是互斥的四个分支。
 */
type AppState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "setup" }
  | { kind: "ready" };

/** 把后端的状态翻译成界面状态。 */
function toAppState(status: SetupStatus): AppState {
  return match(status)
    .with({ state: "uninitialized" }, () => ({ kind: "setup" }) as const)
    .with({ state: "initialized" }, () => ({ kind: "ready" }) as const)
    .exhaustive();
}

export function App() {
  const [state, setState] = useState<AppState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    unwrap(api.api.v1.setup.status.get())
      .then((status) => {
        if (!cancelled) {
          setState(toAppState(status));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // 连不上后端时**不能**当成未初始化 —— 那会引导用户在一台
          // 已经配好的机器上重走一遍初始化。
          setState({ kind: "error", message: describeError(err) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setState({ kind: "loading" });
    unwrap(api.api.v1.setup.status.get())
      .then((status) => setState(toAppState(status)))
      .catch((err: unknown) => setState({ kind: "error", message: describeError(err) }));
  };

  return match(state)
    .with({ kind: "loading" }, () => <BootScreen />)
    .with({ kind: "error" }, ({ message }) => <ErrorScreen message={message} onRetry={retry} />)
    .with({ kind: "setup" }, () => <SetupPage />)
    .with({ kind: "ready" }, () => <Desktop />)
    .exhaustive();
}

/** 从任意异常里挖出可读信息。 */
function describeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
