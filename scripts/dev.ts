/**
 * 开发环境的启动器：同时起 Vite（前端）和后端（API）。
 *
 * 为什么需要这个脚本而不是 `turbo run dev`：
 * 两者是不同的东西，不是同一个任务的两个实例——前端跑在 Vite，后端跑在
 * Bun。turbo 的 dev 任务模型是「每个包各跑一个 watch」，套不上这个组合。
 *
 * 端口分工：
 *   5173  Vite dev server —— 浏览器访问这个，HMR 走它
 *   5090  后端 API       —— Vite 把 /api/* 反代过去
 *
 * 需要后端跑在别的机器上时（典型场景：前端在 macOS、后端在 Linux 虚机），
 * 让 Vite 指向远端，本脚本就不起本地后端：
 *
 *   REINAS_API_TARGET=http://127.0.0.1:5090 bun run dev
 *
 * 两个进程一起活着，任一退出就全部收掉——否则会留下孤儿进程占着端口，
 * 下次启动报 EADDRINUSE，而那个错误信息完全指不到真正的原因。
 */

import { spawn } from "node:child_process";

/** 有远端后端时不起本地后端。 */
const apiTarget = process.env["REINAS_API_TARGET"];
const withApi = !apiTarget;

const children: ReturnType<typeof spawn>[] = [];

function run(name: string, cmd: string[], color: string) {
  const [head, ...rest] = cmd;
  if (!head) {
    return;
  }
  const child = spawn(head, rest, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  children.push(child);

  const tag = `\x1b[${color}m[${name}]\x1b[0m`;
  const pipe = (stream: NodeJS.ReadableStream | null) => {
    stream?.on("data", (buf: Buffer) => {
      for (const line of buf.toString().split("\n")) {
        if (line.trim()) {
          console.log(`${tag} ${line}`);
        }
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on("exit", (code) => {
    console.log(`${tag} 退出（code ${code}），收掉其余进程`);
    shutdown();
  });

  return child;
}

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
  }
  // 给子进程一点时间体面退出，之后强杀
  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }
    process.exit(0);
  }, 2000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("启动开发环境");
console.log(`  前端  http://127.0.0.1:5173  （Vite，HMR）`);
if (withApi) {
  console.log(`  后端  http://127.0.0.1:5090  （API，Vite 的 /api 反代到这里）`);
} else {
  console.log(`  后端  ${apiTarget}  （远端，本机不起）`);
}
console.log("");

run("web", ["bunx", "vite", "--config", "packages/web/vite.config.ts"], "36");

if (withApi) {
  run("api", ["bun", "--watch", "apps/cli/src/main.ts", "serve"], "35");
}
