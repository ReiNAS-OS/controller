/**
 * 统一的 HTTP 响应包装。
 *
 * core 层抛 AppError，这里翻译成 HTTP。规则只有一条：**前端永远拿到
 * ApiResponse 的形状**，不会有时裸对象、有时错误对象。
 */

import { AppError } from "@reinas/core";
import type { ApiResponse } from "@reinas/shared";
import { ErrorCode } from "@reinas/shared";

export function ok<T>(result: T): ApiResponse<T> {
  return { ok: true, result };
}

export function fail(code: string, message: string): ApiResponse<never> {
  return { ok: false, error: { code, message } };
}

/** 把任意异常转成 ApiResponse。未预期的异常统一成 INTERNAL，不回显堆栈。 */
export function fromError(err: unknown): ApiResponse<never> {
  if (err instanceof AppError) {
    return fail(err.code, err.message);
  }
  if (err instanceof Error) {
    return fail(ErrorCode.INTERNAL, err.message);
  }
  return fail(ErrorCode.INTERNAL, String(err));
}

/**
 * 错误码到 HTTP 状态码的映射。
 *
 * core 不知道 HTTP，所以这个映射必须留在 server 层。没列出的一律 500。
 */
export function httpStatusFor(code: string): number {
  switch (code) {
    case ErrorCode.PRM_DENIED:
    case ErrorCode.PRM_SUDO_REQUIRED:
      return 403;
    case ErrorCode.STO_SUBVOLUME_NOT_FOUND:
    case ErrorCode.USR_NOT_FOUND:
    case ErrorCode.DIS_NOT_FOUND:
      return 404;
    case ErrorCode.STO_SUBVOLUME_EXISTS:
    case ErrorCode.SHR_NAME_CONFLICT:
    case ErrorCode.USR_ALREADY_EXISTS:
      return 409;
    case ErrorCode.CFG_INVALID:
    case ErrorCode.CFG_MISSING:
    case ErrorCode.SHR_CONFIG_INVALID:
    case ErrorCode.USR_RESERVED_NAME:
      return 400;
    case ErrorCode.DIS_SMART_UNAVAILABLE:
    case ErrorCode.SYS_NOT_SUPPORTED:
      return 501;
    default:
      return 500;
  }
}
