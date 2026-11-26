#!/usr/bin/env bun
/**
 * controller 命令行入口。
 *
 * 与服务端共用 core 的业务逻辑，所以 CLI 改的配置和面板看到的是同一份。
 *
 *   reinas serve                启动 HTTP 服务
 *   reinas info                 打印系统信息
 *   reinas --version            版本号
 */

import { getOverview, getVersion } from "@reinas/core";
import { serve } from "@reinas/server";
import { DEFAULT_PORT } from "@reinas/shared";

const USAGE = `ReiNAS Controller ${getVersion()}

用法:
  reinas serve [--port <n>] [--host <addr>] [--dev]
                                                  启动 HTTP 服务
                                                  --dev 用 Bun 的全栈 dev server，
                                                  前端改动走 HMR
  reinas info                                     打印系统信息
  reinas --version                                版本号
  reinas --help                                   这份帮助

端口默认 ${DEFAULT_PORT}。改了端口要同步改防火墙规则。`;

function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      i++;
    } else {
      flags.set(key, "true");
    }
  }
  return flags;
}

async function cmdInfo(): Promise<void> {
  const o = await getOverview();
  const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

  console.log(`主机名    ${o.hostname}`);
  console.log(`内核      ${o.kernel}`);
  console.log(`架构      ${o.arch}`);
  console.log(`运行时间  ${Math.floor(o.uptimeSeconds / 3600)} 小时`);
  console.log(`内存      ${mb(o.memory.usedBytes)} / ${mb(o.memory.totalBytes)}`);
  console.log(
    `负载      ${o.load.one.toFixed(2)} ${o.load.five.toFixed(2)} ${o.load.fifteen.toFixed(2)}`,
  );
}

async function cmdServe(flags: Map<string, string>): Promise<void> {
  const portRaw = flags.get("port");
  const port = portRaw ? Number(portRaw) : DEFAULT_PORT;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`端口无效: ${portRaw}`);
    process.exit(1);
  }

  const dev = flags.has("dev");
  await serve({
    port,
    hostname: flags.get("host") ?? "0.0.0.0",
    dev,
  });

  // 服务靠事件循环活着，这里不 return——return 会让进程退出。
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (command === "--version" || command === "-v") {
    console.log(getVersion());
    return;
  }
  if (command === "--help" || command === "-h" || command === undefined) {
    console.log(USAGE);
    return;
  }

  switch (command) {
    case "serve":
      await cmdServe(parseFlags(argv.slice(1)));
      break;
    case "info":
      await cmdInfo();
      break;
    default:
      console.error(`未知命令: ${command}`);
      console.error(USAGE);
      process.exit(1);
  }
}

await main();
