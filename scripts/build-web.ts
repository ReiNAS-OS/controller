/**
 * 构建前端产物到仓库根的 public/。
 *
 * 入口是 packages/web/public/index.html——和生产 dev server 用的是同一个文件。
 * Bun 的打包器读 HTML，把里面引用的 .tsx 打成一个 bundle，产出到 outdir。
 *
 * 为什么不保留 Vite：Bun 自带的打包器和 dev server 已经覆盖了需求（HMR、
 * React、CSS），多一个 Vite 就多一套配置要和 dev 行为对齐。少一个依赖少一类
 * "dev 和生产不一致" 的问题。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const entry = join(root, "packages/web/public/index.html");
const outdir = join(root, "public");

if (!existsSync(entry)) {
  console.error(`找不到前端入口: ${entry}`);
  process.exit(1);
}

const result = await Bun.build({
  entrypoints: [entry],
  outdir,
  target: "browser",
  minify: true,
  sourcemap: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

if (!result.success) {
  console.error("前端构建失败：");
  for (const log of result.logs) {
    console.error(" ", log);
  }
  process.exit(1);
}

const sizes = result.outputs.map((o) => {
  const name = o.path.replace(`${outdir}/`, "");
  return `  ${(o.size / 1024).toFixed(1)} KB  ${name}`;
});
console.log(`✅ 前端产物 → ${outdir}`);
console.log(sizes.join("\n"));
