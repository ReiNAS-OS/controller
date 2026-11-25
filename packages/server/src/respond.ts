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
 * 错误码到 HTTP 状态码。
 *
 * 用查表而不是 switch：switch 会让复杂度随错误码数量线性增长，
 * 一旦超过 lint 的 complexity 上限就得拆函数，反而更难读。
 */
const STATUS_MAP: Readonly<Record<string, number>> = {
  [ErrorCode.PRM_DENIED]: 403,
  [ErrorCode.PRM_SUDO_REQUIRED]: 403,

  [ErrorCode.STO_SUBVOLUME_NOT_FOUND]: 404,
  [ErrorCode.USR_NOT_FOUND]: 404,
  [ErrorCode.DIS_NOT_FOUND]: 404,

  [ErrorCode.STO_SUBVOLUME_EXISTS]: 409,
  [ErrorCode.SHR_NAME_CONFLICT]: 409,
  [ErrorCode.USR_ALREADY_EXISTS]: 409,

  [ErrorCode.CFG_INVALID]: 400,
  [ErrorCode.CFG_MISSING]: 400,
  [ErrorCode.SHR_CONFIG_INVALID]: 400,
  [ErrorCode.USR_RESERVED_NAME]: 400,

  [ErrorCode.DIS_SMART_UNAVAILABLE]: 501,
  [ErrorCode.SYS_NOT_SUPPORTED]: 501,
};

/** 没列出的错误码一律 500。 */
export function httpStatusFor(code: string): number {
  return STATUS_MAP[code] ?? 500;
}
