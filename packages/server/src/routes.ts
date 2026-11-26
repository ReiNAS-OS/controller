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
import { getHealth, getOverview, getSetupStatus } from "@reinas/core";
import { API_PREFIX } from "@reinas/shared";
import { fromError, httpStatusFor, ok } from "./respond.ts";

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
export type ApiApp = ReturnType<typeof createApiRoutes>;
