/**
 * 构建前端产物到本包的 dist/。
 *
 * 入口是包内的 index.html——和生产 dev server 用的是同一个文件。Bun 的打包器
 * 读 HTML，把里面引用的 .tsx 打成一个 bundle，产出到 dist/。
 *
 * **产物放在包内而不是仓库根**：turbo 只能缓存和恢复「包目录下」的 outputs。
 * 产物落在仓库根时，turbo 缓存命中只重放日志、不恢复文件，删掉产物再构建会
 * 得到空目录。放在这里 turbo 会正确缓存和恢复。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

// 脚本在 packages/web/scripts/，包根是上一级
const pkgRoot = join(import.meta.dir, "..");
const entry = join(pkgRoot, "index.html");
const outdir = join(pkgRoot, "dist");

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
