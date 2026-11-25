/**
 * dev 形态：Bun 的全栈 dev server，带 HMR。
 *
 * 官方文档：https://elysiajs.com/patterns/fullstack-dev-server.md
 *
 * 机制是 `Bun.serve` 的 `routes` 加 HTML import。Bun 读 index.html，把里面
 * 的 `<script type="module" src="../src/main.tsx">` 当模块入口转译，并往页面
 * 注入 HMR 客户端（`data-bun-dev-server-script`）。改前端源码，浏览器自动更新。
 *
 * 和生产的差别只有「谁来提供前端」：
 *   生产  public/ 里的构建产物，由 Elysia 静态服务
 *   dev   packages/web/public/index.html，由 Bun 的 HTML import 处理
 *
 * 端口相同、URL 相同，dev 看到的路径就是部署后的路径。
 */

import { join } from "node:path";
import { VERSION } from "@reinas/shared";
import type { AppHandle } from "./index.ts";

export interface DevServeOptions {
  port: number;
  hostname: string;
  /** 前端 public 目录（含 index.html）。默认找 packages/web/public。 */
  webRoot?: string;
}

export async function serveDev(options: DevServeOptions): Promise<void> {
  const webPublic = options.webRoot ?? join(import.meta.dir, "../../web/public");

  // HTML import：Bun 在这里做模块转译和 HMR 注入。
  // 动态 import 让路径可配置，同时不干扰生产编译。
  //
  // 类型用 Bun 的 HTMLBundle：导入 .html 得到的是它，可以直接放进 routes。
  const mod = (await import(join(webPublic, "index.html"))) as { default: Bun.HTMLBundle };
  const index = mod.default;

  const { createApp } = await import("./index.ts");
  const app: AppHandle = createApp();

  Bun.serve({
    port: options.port,
    hostname: options.hostname,
    development: true,
    routes: {
      // /api/* 全部交给 Elysia。它拿 Web 标准 Request，直接 handle。
      "/api/*": (req: Request) => app.handle(req),
      // 其余交给 Bun 的 HTML 入口：转译源码、注入 HMR、处理 /src/* 模块请求。
      "/*": index,
    },
  });

  console.log(`ReiNAS Controller ${VERSION} (dev) on http://${options.hostname}:${options.port}`);
  console.log("前端改动走 HMR，后端改动自动重启。");
}
