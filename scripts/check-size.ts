#!/usr/bin/env bun
/**
 * 检查提交的文件是否超过大小上限。
 *
 * 为什么要有这个：agent 每次要读的上下文有限，一个大文件会挤掉其他信息。
 * 超过 20 KB（约 5000 token）的文件应当按功能拆开。
 *
 * 跳过 agent 不会去读的东西：lockfile、构建产物、缓存、二进制。
 *
 * 用法：bun run scripts/check-size.ts <文件...>
 *       不带参数则检查 git 暂存区里的文件。
 */

import { statSync } from "node:fs";
import { basename, extname } from "node:path";

const LIMIT_BYTES = 20_000;

/** 这些文件 agent 不会读，不检查。 */
const SKIP_EXTENSIONS = new Set([
  ".lock",
  ".zst",
  ".tar",
  ".gz",
  ".xz",
  ".zip",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".map",
]);

/** 路径里含这些段的跳过。 */
const SKIP_PATH_SEGMENTS = [
  "node_modules/",
  "dist/",
  "public/",
  ".turbo/",
  ".git/",
  ".lefthook/",
  "coverage/",
];

const SKIP_BASENAMES = new Set([
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

function shouldSkip(path: string): boolean {
  if (SKIP_BASENAMES.has(basename(path))) {
    return true;
  }
  if (SKIP_EXTENSIONS.has(extname(path))) {
    return true;
  }
  return SKIP_PATH_SEGMENTS.some((seg) => path.includes(seg));
}

/** 暂存区的文件列表。只在没传参数时用。 */
async function stagedFiles(): Promise<string[]> {
  const proc = Bun.spawn(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

const args = process.argv.slice(2);
const files = args.length > 0 ? args : await stagedFiles();

interface TooBig {
  path: string;
  bytes: number;
}

const tooBig: TooBig[] = [];

for (const file of files) {
  if (shouldSkip(file)) {
    continue;
  }
  try {
    const { size } = statSync(file);
    if (size > LIMIT_BYTES) {
      tooBig.push({ path: file, bytes: size });
    }
  } catch {
    // 文件可能在暂存区但工作区已删，跳过
  }
}

if (tooBig.length === 0) {
  process.exit(0);
}

console.error(`\n以下文件超过 ${LIMIT_BYTES} 字节（约 5000 token）：\n`);
for (const { path, bytes } of tooBig) {
  const kb = (bytes / 1024).toFixed(1);
  console.error(`  ${path}  ${bytes} 字节（${kb} KB）`);
}
console.error(`\n请按功能拆成几个文件再提交。大文件会挤掉 agent 的上下文。`);
console.error(
  `如果确实不该拆（自动生成的代码等），把路径加进 scripts/check-size.ts 的跳过列表。\n`,
);
process.exit(1);
