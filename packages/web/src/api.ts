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
    throw new Error(errorMessage(error.value));
  }
  if (data === null) {
    throw new Error("响应为空");
  }
  if (!data.ok) {
    throw new Error(`${data.error.code}: ${data.error.message}`);
  }
  return data.result;
}

/** 从错误响应里挖出可读的消息。后端统一返回 ApiResponse 的形状。 */
function errorMessage(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "请求失败";
  }
  if ("error" in value) {
    const inner = (value as { error?: { message?: string } }).error;
    if (inner?.message) {
      return inner.message;
    }
  }
  return "请求失败";
}
