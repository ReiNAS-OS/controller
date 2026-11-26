/**
 * API 路由定义。
 *
 * 两条硬约定：
 *
 * 1. **必须用方法链**。Elysia 的类型系统靠链式调用累积类型信息；拆成
 *    多次 `app.get(...)` 调用，`typeof app` 就丢路由类型，前端 Eden 会推断成
 *    any。这直接决定客户端有没有类型提示。
 *
 * 2. **这里的返回值类型就是客户端的类型**。`createApiRoutes` 的返回类型由
 *    TS 自动推断，前端通过 `typeof createApiRoutes` 拿到它。所以不要手写
 *    返回类型标注，也不要写 `: Elysia` 这种基类类型——会擦掉路由信息。
 */

import { Elysia } from "elysia";
import {
  completeSetup,
  createAdminUser,
  getHealth,
  getOverview,
  getSetupStatus,
} from "@reinas/core";
import { API_PREFIX, ErrorCode } from "@reinas/shared";
import { fail, fromError, httpStatusFor, ok } from "./respond.ts";

export function createApiRoutes() {
  return (
    new Elysia({ prefix: API_PREFIX })
      // 健康检查。用它验证服务和前端能通，也用来探活。
      .get("/health", async () => ok(await getHealth()))

      // 初始化状态。前端靠它决定进初始化页还是桌面。
      // 返回可辨识联合 { state: "initialized" | "uninitialized" }。
      .get("/setup/status", async ({ set }) => {
        try {
          return ok(await getSetupStatus());
        } catch (err) {
          const body = fromError(err);
          set.status = httpStatusFor(body.ok ? "INTERNAL" : body.error.code);
          return body;
        }
      })

      // 初始化第一步：创建主用户。
      //
      // 系统出厂只有 root，这一步建出第一个可登录的普通用户。
      // **不写 setup.json** —— 初始化是多步流程，写完第一步就标记完成
      // 会让系统在半配置状态下进桌面。
      .post("/setup/user", async ({ body, set }) => {
        const input = body as { username?: unknown; password?: unknown };
        if (typeof input.username !== "string" || typeof input.password !== "string") {
          set.status = 400;
          return fail("CFG_INVALID", "需要 username 和 password 两个字符串字段");
        }

        try {
          const result = await createAdminUser({
            username: input.username,
            password: input.password,
          });
          if (!result.ok) {
            // 校验类错误是 400，执行失败是 500
            set.status = result.reason === "failed" ? 500 : 400;
            return fail(setupErrorCode(result.reason), result.message);
          }
          return ok({ username: result.username });
        } catch (err) {
          const body2 = fromError(err);
          set.status = httpStatusFor(body2.ok ? "INTERNAL" : body2.error.code);
          return body2;
        }
      })

      // 初始化最后一步：写标记文件，之后前端就能进桌面。
      .post("/setup/complete", async ({ body, set }) => {
        const input = body as { username?: unknown };
        if (typeof input.username !== "string" || input.username === "") {
          set.status = 400;
          return fail("CFG_INVALID", "需要 username 字段");
        }

        try {
          return ok(await completeSetup(input.username));
        } catch (err) {
          const body2 = fromError(err);
          set.status = httpStatusFor(body2.ok ? "INTERNAL" : body2.error.code);
          return body2;
        }
      })

      // 系统概览。只读，不需要特权。
      .get("/system/overview", async ({ set }) => {
        try {
          return ok(await getOverview());
        } catch (err) {
          const body = fromError(err);
          set.status = httpStatusFor(body.ok ? "INTERNAL" : body.error.code);
          return body;
        }
      })
  );
}

/**
 * 给客户端用的类型。
 *
 * 前端 `import type { ApiApp } from "@reinas/server"` 之后：
 *
 *   treaty<ApiApp>(baseUrl)
 *
 * 就得到了完整类型提示。改后端路由，前端立刻能发现不匹配——不需要代码生成，
 * 也不需要手工维护一份类型定义。
 */
/**
 * core 的失败原因 → 前端能用的错误码。
 *
 * core 层不认识 ErrorCode（那是跨边界的约定），所以在这层翻译。
 * 前端按错误码分支处理，不按 message 匹配文字——文案会改，码不会。
 */
function setupErrorCode(reason: string): string {
  switch (reason) {
    case "reserved":
      return ErrorCode.USR_RESERVED_NAME;
    case "already_exists":
      return ErrorCode.USR_ALREADY_EXISTS;
    case "invalid_name":
    case "weak_password":
      return ErrorCode.CFG_INVALID;
    default:
      return ErrorCode.INTERNAL;
  }
}

export type ApiApp = ReturnType<typeof createApiRoutes>;
