/**
 * 把后端代码和前端产物打成单二进制。
 *
 * 前端产物在 packages/web/dist/，由 @reinas/web 的 build 任务产出。cli 把 web
 * 声明成 devDependency，turbo 据此保证先跑 web 再跑这里。
 *
 * 产物放在 web 包内、不在仓库根，是为了让 turbo 能正确缓存和恢复它——turbo
 * 只认包目录下的 outputs。
 *
 * 输出路径要能对上 os 仓库里 systemd unit 的预期。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

// 脚本在 apps/cli/scripts/，包根是上一级
const pkgRoot = join(import.meta.dir, "..");
const root = join(pkgRoot, "../..");
const webDist = join(root, "packages/web/dist");
const entry = join(pkgRoot, "src/main.ts");

// 二进制也放在包内的 dist/。理由同前端：turbo 只缓存包目录下的 outputs，
// 产物落到仓库根时缓存命中不会恢复文件。
const outFile = join(pkgRoot, "dist/reinas");

const target = process.env["TARGET"] ?? "bun-linux-x64";
const hasFrontend = existsSync(join(webDist, "index.html"));

if (!hasFrontend) {
  console.warn("⚠️  packages/web/dist 缺失，二进制将不含 Web 界面。先跑 bun run build。");
}

console.log(`构建目标 ${target}`);
console.log(`入口     ${entry}`);

const result = await Bun.build({
  entrypoints: [entry],
  compile: {
    outfile: outFile,
    target: target as "bun-linux-x64",
    // 前端产物内联进二进制。assets 的路径决定运行时 import.meta.dir 下的
    // 相对位置，server 那边的 resolvePublicDir 按 "public" 找。
    ...(hasFrontend ? { assets: [webDist] } : {}),
  },
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

if (!result.success) {
  console.error("构建失败：");
  for (const log of result.logs) {
    console.error(" ", log);
  }
  process.exit(1);
}

console.log(`✅ 输出 ${outFile}`);
