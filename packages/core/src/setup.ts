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

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SetupRecord, SetupStatus } from "@reinas/shared";
import { VERSION } from "@reinas/shared";
import { createUser } from "./users.ts";
import type { CreateUserInput, CreateUserResult } from "./users.ts";

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
    if (
      typeof record.completedAt !== "string" ||
      typeof record.version !== "string" ||
      typeof record.username !== "string"
    ) {
      return null;
    }
    return {
      completedAt: record.completedAt,
      version: record.version,
      username: record.username,
    };
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

/**
 * 初始化第一步：创建主用户。
 *
 * 系统出厂时只有 root，没有可登录的普通用户。这一步建出第一个：
 * 有 home、bash、wheel（能 sudo）。
 *
 * **这一步不写 setup.json。** 初始化是多步流程，写完第一步就标记完成会
 * 让系统在半配置状态下进桌面。标记由 completeSetup 在最后一步写。
 *
 * 幂等性：用户已存在时返回错误而不是静默成功——初始化只该发生一次，
 * 静默成功会掩盖"重跑了流程"这个事实。
 */
export async function createAdminUser(input: CreateUserInput): Promise<CreateUserResult> {
  return createUser(input);
}

/**
 * 初始化最后一步：写标记文件。
 *
 * 用临时文件 + rename 保证原子性：直接写 setup.json 时如果进程在写到
 * 一半被杀，会留下一个损坏的文件。而"文件存在"就是初始化完成的判据，
 * 损坏的文件会被当成已初始化——用户进不了桌面也重不了初始化。
 */
export async function completeSetup(username: string): Promise<SetupRecord> {
  const record: SetupRecord = {
    completedAt: new Date().toISOString(),
    version: VERSION,
    username,
  };

  const target = setupFile();
  const tmp = `${target}.tmp`;

  // 目录可能不存在（开发机上第一次跑）
  await mkdir(dirname(target), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(tmp, target);

  return record;
}
