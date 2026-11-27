/**
 * HTTP 服务入口。
 *
 * 只有一种运行形态：Elysia listen，自己服务静态文件。
 *
 *   dev    前端由 Vite dev server 提供（另起一个端口），/api 反代到这里；
 *          这里只管 API，publicDir 通常找不到也就不服务静态文件
 *   生产   前端产物内联在二进制里，这里用 Elysia 静态服务
 *
 * **为什么 dev 不再用 Bun 的 HTML import**：那套机制（Bun.serve 的 routes
 * + `development: true`）依赖 inotify 事件感知文件变化，在跨机器和共享
 * 文件系统上完全不工作（9p / vboxsf / NFS 都不投递事件，实测过），而且
 * 它用的打包器和生产不是同一个，行为会漂移。现在 dev 和 build 共用一份
 * vite.config.ts，看到的就是部署后的样子。见 docs/decisions.md D-002。
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
 * 三种运行形态路径不一样：
 *   源码运行      packages/server/src/ → 往上两级到仓库根，再到 packages/web/dist
 *   bun compile   import.meta.dir 是 /$bunfs/root，assets 嵌在它下面的 dist/
 *   显式指定      由环境变量 PUBLIC_DIR 覆盖
 *
 * bun compile 的目录名取决于构建时 assets 指向的目录名（这里是 web/dist →
 * 嵌入后叫 dist）。
 */
export function resolvePublicDir(explicit?: string): string | null {
  const fromEnv = process.env["PUBLIC_DIR"];
  const candidates = explicit
    ? [explicit]
    : [
        ...(fromEnv ? [fromEnv] : []),
        join(import.meta.dir, "dist"), // bun compile：/$bunfs/root/dist
        join(import.meta.dir, "../../web/dist"), // 源码运行
      ];

  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) {
      return dir;
    }
  }
  return null;
}

/** API 路由。dev 和生产的 Elysia 实例都从这里挂。 */
export function createApp() {
  return new Elysia().use(createApiRoutes());
}

/**
 * 生产形态：Elysia 自己处理静态文件。
 *
 * 返回类型不标注：Elysia 的链式调用每加一条路由都会改变泛型参数，
 * 写死基类反而对不上。让 TS 推断。
 */
function withStaticFiles(app: ReturnType<typeof createApp>, publicDir: string | null) {
  if (!publicDir) {
    return app.get("/", () => `ReiNAS Controller ${VERSION}`);
  }

  return app
    .get("/", () => Bun.file(join(publicDir, "index.html")))
    .get("/*", ({ params }) => {
      const file = Bun.file(join(publicDir, params["*"] ?? ""));
      // SPA 回退：找不到文件就返回 index.html，让前端路由处理
      return file.size > 0 ? file : Bun.file(join(publicDir, "index.html"));
    });
}

export async function serve(options: ServeOptions = {}): Promise<void> {
  const port = options.port ?? DEFAULT_PORT;
  const hostname = options.hostname ?? "0.0.0.0";

  // dev 和生产的差别只剩「前端产物从哪来」，前端本体由 Vite 负责：
  //   dev    Vite dev server（5173）跑在前端包目录，/api 反代到这里
  //   生产   产物内联在二进制里，这里用 Elysia 静态服务
  //
  // 以前 dev 走 Bun 的 HTML import（Bun.serve 的 routes + development:true），
  // 那套机制依赖 inotify 事件，在跨机器/共享文件系统上完全不工作，而且
  // 和生产用的打包器不是同一个，行为会对不上。见 docs/decisions.md D-002。
  const app = withStaticFiles(createApp(), resolvePublicDir(options.publicDir));
  app.listen({ port, hostname });
  console.log(`ReiNAS Controller ${VERSION} listening on http://${hostname}:${port}`);
}
