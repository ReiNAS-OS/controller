/**
 * 生产构建：用 Vite 打包前端产物到本包 dist/。
 *
 * **和 dev 用同一个打包器**（都读 vite.config.ts）。这是刻意的：
 * 两套打包器（比如 dev 用 Vite、构建用 Bun 打包）会有行为漂移，dev 能跑
 * 的写法构建出来可能白屏。同一个 config、同一个插件链，才能保证"本地
 * 看到的就是部署后的样子"。
 *
 * 产物位置：packages/web/dist/，由 apps/cli 的构建脚本内联进二进制。
 * 必须在包目录内——turbo 只缓存包目录下的 outputs（见 D-003）。
 */

import { build } from "vite";

const started = Date.now();

try {
  await build({
    // 让 Vite 用本包的 vite.config.ts。不传 inline config，避免两处
    // 配置漂移——配置文件是唯一真相。
    configFile: new URL("../vite.config.ts", import.meta.url).pathname,
    mode: "production",
    logLevel: "info",
  });
} catch (err) {
  console.error("前端构建失败：");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log(`✅ 前端产物 → ${new URL("../dist", import.meta.url).pathname}（${elapsed}s）`);
