/**
 * 业务错误的统一表示。
 *
 * core 层不 import server，所以这里不涉及任何 HTTP 概念（状态码之类）。
 * 由 server 层负责把这个错误翻译成 HTTP 响应。
 */

import type { ErrorCode } from "@reinas/shared";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly detail?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    if (detail) {
      this.detail = detail;
    }
  }
}
