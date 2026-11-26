/**
 * 初始化状态判定。
 *
 * 判据是本机上有没有 `/etc/reinas/setup.json`：
 *
 *   文件不存在  → 未初始化，前端强制进初始化页
 *   文件存在    → 已初始化，进桌面
 *
 * 为什么用「文件存在」而不是读某个字段：初始化一旦完成就不可回退，文件
 * 存在本身就是最终事实。读内容只用来拿完成时间和版本，读坏了也不该
 * 把系统判回未初始化——那样会引导用户重复初始化，比读出脏数据危险得多。
 *
 * 目录 `/etc/reinas/` 在镜像构建时已经由 config.sh 创建（root.conf 用完
 * 就删），所以这里不需要负责建目录。
 */

import { readFile } from "node:fs/promises";
import type { SetupRecord, SetupStatus } from "@reinas/shared";
import { VERSION } from "@reinas/shared";

/**
 * 初始化标记文件。
 *
 * 默认 `/etc/reinas/setup.json`。环境变量 `REINAS_SETUP_FILE` 可以覆盖，
 * 用于两种场景：
 *
 *   - 开发机是 macOS，没有 /etc/reinas，也不该往那里写
 *   - 容器/QEMU 测试时把它指到临时目录，不动生产路径
 *
 * 生产环境不要设这个变量。
 */
function setupFile(): string {
  return process.env["REINAS_SETUP_FILE"] ?? "/etc/reinas/setup.json";
}

/**
 * 读初始化的持久化记录。
 *
 * 文件存在但内容读不出来（截断、JSON 损坏、权限不足）时返回 null，
 * 由调用方决定怎么处理——调用方会把它当成「已初始化但元数据缺失」，
 * **不会**当成未初始化。
 */
async function readRecord(): Promise<SetupRecord | null> {
  try {
    const raw = await readFile(setupFile(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as Partial<SetupRecord>;
    if (typeof record.completedAt !== "string" || typeof record.version !== "string") {
      return null;
    }
    return { completedAt: record.completedAt, version: record.version };
  } catch {
    return null;
  }
}

/** 标记文件是否存在。这是「是否初始化过」的唯一判据。 */
async function setupFileExists(): Promise<boolean> {
  try {
    await readFile(setupFile(), "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * 查初始化状态。
 *
 * 返回可辨识联合，前端用 ts-pattern 穷尽匹配：
 *
 *   match(status).with({ state: "initialized" }, ...).with({ state: "uninitialized" }, ...)
 *
 * 元数据读不出来时用占位值填，仍然报 initialized —— 文件在就是初始化过，
 * 不能因为解析失败让用户重来一遍。
 */
export async function getSetupStatus(): Promise<SetupStatus> {
  const exists = await setupFileExists();
  if (!exists) {
    return { state: "uninitialized" };
  }

  const record = await readRecord();
  return {
    state: "initialized",
    completedAt: record?.completedAt ?? "",
    version: record?.version ?? VERSION,
  };
}
