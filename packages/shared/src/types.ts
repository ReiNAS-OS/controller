/**
 * 服务端与前端共用的类型。
 *
 * 这些是「穿过 HTTP 边界」的形状。业务内部的类型放各 package 自己那边，
 * 只有需要序列化给前端看的才放这里。
 */

/** 统一响应包装。前端拿到 result 或 error 二选一。 */
export type ApiResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: { code: string; message: string } };

/** 健康检查。M0 阶段只有一个端点。 */
export interface HealthStatus {
  /** 服务是否正常 */
  status: "ok";
  /** 控制器版本 */
  version: string;
  /** 进程已运行秒数 */
  uptime: number;
  /** 系统启动时间（ISO 8601），读不到时为 null */
  bootTime: string | null;
}
