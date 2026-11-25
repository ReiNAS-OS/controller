/**
 * HTTP 服务入口。
 *
 * 静态文件从 public/ 提供——前端构建产物。生产环境这个目录随二进制分发，
 * 开发时由 Vite dev server 处理。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { Elysia } from "elysia";
import { DEFAULT_PORT, VERSION } from "@reinas/shared";
import { createApiRoutes } from "./routes.ts";

export interface ServeOptions {
  port?: number;
  hostname?: string;
  /** 前端产物目录。不存在时只提供 API，不报错。 */
  publicDir?: string;
}

/**
 * 找前端产物目录。
 *
 * 两种运行形态路径不一样：
 *   源码运行     packages/server/src/ → 往上三级是仓库根的 public/
 *   bun compile  import.meta.dir 是 /$bunfs/root，嵌入的资源在它下面的 public/
 *
 * 所以先试编译形态（$bunfs 下直接就是 public），再退回开发形态。
 * 都不能命中就返 null，只提供 API。
 */
function resolvePublicDir(explicit?: string): string | null {
  const candidates = explicit
    ? [explicit]
    : [
        join(import.meta.dir, "public"), // bun compile：/$bunfs/root/public
        join(import.meta.dir, "../../../public"), // 源码运行
      ];

  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) {
      return dir;
    }
  }
  return null;
}

export function createApp(options: ServeOptions = {}) {
  const publicDir = resolvePublicDir(options.publicDir);

  const app = new Elysia().use(createApiRoutes()).get("/", () => `ReiNAS Controller ${VERSION}`);

  // 前端产物存在才挂静态服务。开发阶段前端跑在 Vite 上，这里没文件。
  if (publicDir) {
    app.use(
      new Elysia()
        .get("/", () => Bun.file(join(publicDir, "index.html")))
        .get("/*", ({ params }) => {
          const file = Bun.file(join(publicDir, params["*"] ?? ""));
          // SPA 回退：找不到文件就返回 index.html，让前端路由处理
          return file.size > 0 ? file : Bun.file(join(publicDir, "index.html"));
        }),
    );
  }

  return app;
}

export async function serve(options: ServeOptions = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const app = createApp(options);
  app.listen({ port, hostname: options.hostname ?? "0.0.0.0" });
  console.log(`ReiNAS Controller ${VERSION} listening on http://0.0.0.0:${port}`);
  return app;
}
