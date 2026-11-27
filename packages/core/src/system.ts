/**
 * 系统信息采集。M1 阶段的只读部分。
 *
 * 全部走 /proc 和标准命令，不需要特权。这样 M0/M1 阶段可以用 reinas 用户
 * 完整跑通，不用先解决提权问题。
 */

import { readFile } from "node:fs/promises";
import type { HealthStatus } from "@reinas/shared";
import { VERSION } from "@reinas/shared";
import { run } from "./exec.ts";

/** 进程启动时刻，用于算 uptime。模块加载时固定一次。 */
const startedAt = Date.now();

export function getVersion(): string {
  return VERSION;
}

export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - startedAt) / 1000);
}

/**
 * 读系统启动时间。
 *
 * /proc/stat 里的 btime 是秒级 epoch。容器里可能没有，读不到就返回 null
 * 而不是抛异常——健康检查不该因为一个可选字段失败。
 */
export async function getBootTime(): Promise<string | null> {
  try {
    const stat = await readFile("/proc/stat", "utf8");
    const match = /^btime\s+(\d+)$/m.exec(stat);
    if (!match?.[1]) {
      return null;
    }
    return new Date(Number(match[1]) * 1000).toISOString();
  } catch {
    return null;
  }
}

/** 健康检查。M0 阶段唯一的端点，用来证明服务活着。 */
export async function getHealth(): Promise<HealthStatus> {
  return {
    status: "ok",
    version: getVersion(),
    uptime: getUptimeSeconds(),
    bootTime: await getBootTime(),
  };
}

export interface MemoryInfo {
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
}

/** 内存使用。读 /proc/meminfo，单位是 kB。 */
export async function getMemory(): Promise<MemoryInfo> {
  // 同上：非 Linux 上返回全 0，让调用方看到「未知」而不是异常。
  const meminfo = await readFile("/proc/meminfo", "utf8").catch(() => "");
  const get = (key: string): number => {
    const m = new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(meminfo);
    return m?.[1] ? Number(m[1]) * 1024 : 0;
  };
  const totalBytes = get("MemTotal");
  const availableBytes = get("MemAvailable");
  return {
    totalBytes,
    availableBytes,
    usedBytes: totalBytes - availableBytes,
  };
}

/**
 * 架构名。
 *
 * 统一用 **uname 的写法**（`aarch64` / `x86_64`），不用 Node 那套
 * （`arm64` / `x64`）。理由：这个值会出现在 API 响应里，和 `kernel` 字段
 * 并排显示（`7.3.4-300.fc45.aarch64`）。两套命名混在一起会自相矛盾——
 * 之前就出现过 `arch: "arm64"` 配 `kernel: "...aarch64"` 的情况。
 *
 * `process.arch` 一定有值（Bun 和 Node 都保证），所以不需要跑 `uname -m`。
 * 那张映射表只处理已知差异，遇到没列出的值原样返回。
 */
export async function getArch(): Promise<string> {
  return NODE_ARCH_TO_UNAME[process.arch] ?? process.arch;
}

/** Node/Bun 的 `process.arch` → uname 的写法。只列有差异的。 */
const NODE_ARCH_TO_UNAME: Record<string, string> = {
  arm64: "aarch64",
  x64: "x86_64",
  ia32: "i686",
};

export interface LoadAverage {
  one: number;
  five: number;
  fifteen: number;
}

/** 负载均值。读 /proc/loadavg 的前三个数。 */
export async function getLoadAverage(): Promise<LoadAverage> {
  const raw = await readFile("/proc/loadavg", "utf8").catch(() => "0 0 0");
  const parts = raw.trim().split(/\s+/);
  return {
    one: Number(parts[0] ?? 0),
    five: Number(parts[1] ?? 0),
    fifteen: Number(parts[2] ?? 0),
  };
}

/**
 * 主机名。
 *
 * 优先读 /proc/sys/kernel/hostname（内核接口，任何 Linux 都有），读不到才
 * 退回 hostname 命令。最小容器镜像里没有 `hostname` 包，直接依赖命令会在
 * fedora:45 这类镜像上报 ENOENT。
 */
export async function getHostname(): Promise<string> {
  const fromProc = await readFile("/proc/sys/kernel/hostname", "utf8").catch(() => "");
  if (fromProc.trim()) {
    return fromProc.trim();
  }
  const out = await run(["hostname"]).catch(() => null);
  return out?.stdout.trim() ?? "unknown";
}

export interface SystemOverview {
  hostname: string;
  kernel: string;
  arch: string;
  uptimeSeconds: number;
  bootTime: string | null;
  memory: MemoryInfo;
  load: LoadAverage;
}

/** 系统概览。M1 阶段首页要显示的东西。 */
export async function getOverview(): Promise<SystemOverview> {
  // /proc 只在 Linux 上有。macOS 开发时读不到，退化成 0 而不是崩掉整个命令。
  // 全部读 /proc，不依赖 uname 命令。最小容器镜像里可能没装 coreutils。
  const [kernel, arch, uptimeRaw] = await Promise.all([
    readFile("/proc/sys/kernel/osrelease", "utf8").catch(() => ""),
    getArch(),
    readFile("/proc/uptime", "utf8").catch(() => ""),
  ]);

  return {
    hostname: await getHostname(),
    kernel: kernel.trim() || "unknown",
    arch,
    uptimeSeconds: Math.floor(Number(uptimeRaw.split(/\s+/)[0] ?? 0)),
    bootTime: await getBootTime(),
    memory: await getMemory(),
    load: await getLoadAverage(),
  };
}
