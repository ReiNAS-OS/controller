/**
 * 路由定义。M0 只有健康检查，M1 会加系统概览、磁盘、存储。
 *
 * 约定：路由函数只做两件事——调 core、包装响应。业务判断全在 core 里，
 * 这样 CLI 才能复用同一套逻辑。
 */

import { Elysia } from "elysia";
import { getHealth, getOverview } from "@reinas/core";
import { API_PREFIX } from "@reinas/shared";
import { fromError, httpStatusFor, ok } from "./respond.ts";

export function createApiRoutes() {
  return (
    new Elysia({ prefix: API_PREFIX })
      // 健康检查。M0 阶段用它验证服务和前端能通。
      .get("/health", async () => ok(await getHealth()))

      // 系统概览。M1 的第一块，只读，不需要特权。
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
