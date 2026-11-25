/**
 * 构建脚本：把后端 + 前端产物打成单二进制。
 *
 * 为什么用脚本而不是 package.json 里一行命令：
 *   - public/ 要先存在（前端构建产物），否则二进制里没有界面。
 *     turbo 的缓存命中时只重放日志、不恢复仓库根的产物文件（public/ 不在
 *     任何 workspace 包目录下），所以这里必须自己兜底构建一次前端。
 *   - 要检查目标平台，macOS 上编的 x86_64 二进制在 Fedora 上跑不了
 *   - 输出路径要能对上 os 仓库里 systemd unit 的预期
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const publicDir = join(root, "public");
const entry = join(root, "apps/cli/src/main.ts");
const outFile = join(root, "dist/controller");

/** 前端产物不存在就直接构建一次，不依赖 turbo 缓存是否恢复了文件。 */
async function ensureFrontend(): Promise<boolean> {
  if (existsSync(join(publicDir, "index.html"))) {
    return true;
  }

  console.log("public/ 缺失，构建前端…");
  const proc = Bun.spawn(["bun", "run", "--cwd", "packages/web", "build"], {
    stdout: "inherit",
    stderr: "inherit",
    cwd: root,
  });

  if ((await proc.exited) !== 0) {
    return false;
  }
  return existsSync(join(publicDir, "index.html"));
}

const target = process.env["TARGET"] ?? "bun-linux-x64";
const hasFrontend = await ensureFrontend();

if (!hasFrontend) {
  console.warn("⚠️  前端构建失败，二进制将不含 Web 界面");
}

console.log(`构建目标 ${target}`);
console.log(`入口     ${entry}`);

const result = await Bun.build({
  entrypoints: [entry],
  compile: {
    outfile: outFile,
    target: target as "bun-linux-x64",
    // 前端产物内联进二进制，运行时不需要外部目录。
    //
    // 用 assets 而不是旧的 files 参数：files 在新版 bun 里不生效，
    // 表现是二进制跑起来只返回纯文本、静态资源 404。
    ...(hasFrontend ? { assets: [publicDir] } : {}),
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
