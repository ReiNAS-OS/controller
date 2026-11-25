/**
 * API 客户端。
 *
 * 后端永远返回 ApiResponse 的形状，这里做一次拆包，让调用方只用处理
 * 成功值或抛出异常。
 */

import type { ApiResponse, HealthStatus } from "@reinas/shared";
import { API_PREFIX } from "@reinas/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.ok) {
    throw new Error(`${body.error.code}: ${body.error.message}`);
  }
  return body.result;
}

export function fetchHealth(): Promise<HealthStatus> {
  return request<HealthStatus>("/health");
}

export interface SystemOverview {
  hostname: string;
  kernel: string;
  arch: string;
  uptimeSeconds: number;
  bootTime: string | null;
  memory: { totalBytes: number; availableBytes: number; usedBytes: number };
  load: { one: number; five: number; fifteen: number };
}

export function fetchOverview(): Promise<SystemOverview> {
  return request<SystemOverview>("/system/overview");
}
