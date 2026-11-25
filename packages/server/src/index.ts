/**
 * HTTP 服务入口。
 *
 * 两种运行形态共用同一套路由定义：
 *
 *   生产  Elysia 直接 listen，静态文件从嵌入的 dist/ 读
 *   dev   Bun.serve 的 routes 分发：/api/* 交给 Elysia，其余交给 Bun 的
 *         HTML 入口（自带 HMR）
 *
 * 为什么 dev 不用 Elysia 的 listen：Bun 的全栈 dev server 是 `Bun.serve`
 * 的 `routes` + HTML import 特性，HMR 客户端由 Bun 注入。Elysia 的 listen
 * 走的是自己的路径，不触发那套机制，页面能打开但不会热更新。
 *
 * 为什么生产不用 Bun.serve routes：routes 是 dev 期特性，生产要的是把
 * public/ 打进二进制。用 Elysia 的静态文件处理更直接。
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
  /** dev 模式：用 Bun 的 HTML 入口，带 HMR。 */
  dev?: boolean;
  /** dev 模式下前端 public 目录（含 index.html）。 */
  webRoot?: string;
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

/** Elysia 的 handle 签名。dev 分支转发请求时用它，避免依赖具体泛型。 */
export interface AppHandle {
  handle: (request: Request) => Promise<Response>;
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

  if (options.dev) {
    // 动态 import：dev 分支依赖 HTML import（Bun 的打包器特性），
    // 静态引入会让生产编译也去解析它。
    const { serveDev } = await import("./dev.ts");
    await serveDev({ port, hostname, ...(options.webRoot ? { webRoot: options.webRoot } : {}) });
    return;
  }

  const app = withStaticFiles(createApp(), resolvePublicDir(options.publicDir));
  app.listen({ port, hostname });
  console.log(`ReiNAS Controller ${VERSION} listening on http://${hostname}:${port}`);
}
