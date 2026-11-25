/**
 * 构建脚本：把后端 + 前端产物打成单二进制。
 *
 * 为什么用脚本而不是 package.json 里一行命令：
 *   - public/ 要先存在（前端构建产物），否则二进制里没有界面
 *   - 要检查目标平台，macOS 上编的 x86_64 二进制在 Fedora 上跑不了
 *   - 输出路径和文件名要能对上 os 仓库里 systemd unit 的预期
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const publicDir = join(root, "public");
const entry = join(root, "apps/cli/src/main.ts");
const outFile = join(root, "dist/controller");

// 前端产物不存在时警告但不阻断：纯 API 部署（比如只给 CLI 用）是合法场景。
if (!existsSync(publicDir)) {
  console.warn("⚠️  public/ 不存在，二进制将不含 Web 界面。先跑 bun run build:web。");
}

const target = process.env["TARGET"] ?? "bun-linux-x64";

console.log(`构建目标 ${target}`);
console.log(`入口     ${entry}`);

const result = await Bun.build({
  entrypoints: [entry],
  compile: {
    outfile: outFile,
    target: target as "bun-linux-x64",
    // 前端产物内联进二进制，运行时不需要外部目录。
    // 这是「单文件分发」的关键：NAS 上只放一个可执行文件。
    //
    // 用 assets 而不是旧的 files 参数：files 在新版 bun 里不生效，
    // 表现是二进制跑起来只返回纯文本、静态资源 404。
    ...(existsSync(publicDir) ? { assets: [publicDir] } : {}),
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
