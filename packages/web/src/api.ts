/**
 * API 客户端，用 Eden Treaty。
 *
 * 不用手写 fetch 包装：类型直接从后端 `ApiApp` 推出来。改了后端路由，这里
 * 立刻能看到不匹配，不需要维护第二份类型定义。
 *
 * 文档：https://elysiajs.com/eden/overview
 *
 * ⚠️ 两个 Eden 的硬要求，破坏任何一个都会让类型退化成 any：
 *
 *   1. 后端必须用方法链定义路由（见 packages/server/src/routes.ts）
 *   2. 前后端的 elysia 版本必须一致
 */

import { treaty } from "@elysia/eden";
import type { ApiApp } from "@reinas/server/routes";

/**
 * 客户端实例。
 *
 * baseUrl 取当前页面的 origin。dev 时前端和 API 同一个端口（5090），生产也是，
 * 所以不需要配置。以后若前后端分离部署，改这里。
 */
export const api = treaty<ApiApp>(globalThis.location?.origin ?? "http://127.0.0.1:5090");

/** Eden 返回的形状。成功时 error 为 null，失败时 data 为 null。 */
interface TreatyResult<T> {
  data: T | null;
  error: { status: unknown; value: unknown } | null;
}

/**
 * 拆包，两层一起拆：
 *
 *   1. Eden 的 `{ data, error }` —— 它故意不抛异常，让调用方显式处理。
 *   2. 后端统一的 `ApiResponse<T>` —— `{ ok: true, result } | { ok: false, error }`。
 *
 * 组件里到处写 `if (error)` 和 `if (!body.ok)` 太啰嗦，这里收敛成一次，
 * React 侧统一用 try/catch 或错误边界。
 */
export async function unwrap<T>(
  pending: Promise<
    TreatyResult<{ ok: true; result: T } | { ok: false; error: { code: string; message: string } }>
  >,
): Promise<T> {
  const { data, error } = await pending;

  if (error) {
    // HTTP 非 2xx 走这条。**必须带上错误码**，否则调用方没法按码分支
    // （比如靠 CFG_ALREADY_INITIALIZED 判断初始化已完成）。格式和下面的
    // `!data.ok` 分支保持一致：`CODE: message`。
    const body = errorBody(error.value);
    throw new Error(body.code ? `${body.code}: ${body.message}` : body.message);
  }
  if (data === null) {
    throw new Error("响应为空");
  }
  if (!data.ok) {
    throw new Error(`${data.error.code}: ${data.error.message}`);
  }
  return data.result;
}

/**
 * 从错误响应里挖出 code 和 message。
 *
 * 后端统一返回 ApiResponse 的形状，但 Eden 把它塞在 `error.value` 里。
 * 两条错误路径（HTTP 非 2xx / HTTP 2xx 但 ok:false）都走这里，保证格式
 * 一致——`errorCodeOf` 依赖这个一致性。
 */
function errorBody(value: unknown): { code: string; message: string } {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return { code: "", message: "请求失败" };
  }
  const inner = (value as { error?: { code?: string; message?: string } }).error;
  return {
    code: inner?.code ?? "",
    message: inner?.message ?? "请求失败",
  };
}

/**
 * 从异常里取后端错误码。
 *
 * unwrap 抛出的消息格式是 `CODE: message`，但那只是给人看的——按字符串
 * 匹配前缀太脆（文案改了就可能漏判）。这里单独导出，让调用方按码分支。
 *
 * 取不到时返回 null，调用方应当把 null 当成"未知错误"处理。
 */
export function errorCodeOf(err: unknown): string | null {
  if (!(err instanceof Error)) {
    return null;
  }
  const match = /^([A-Z][A-Z0-9_]*): /.exec(err.message);
  return match?.[1] ?? null;
}

/**
 * 从异常里取人话消息（去掉 `CODE: ` 前缀）。
 *
 * 错误码是给代码分支用的，不该出现在界面上。UI 显示用这个，
 * 判断用 errorCodeOf。
 */
export function errorMessageOf(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/^[A-Z][A-Z0-9_]*: /, "");
}
