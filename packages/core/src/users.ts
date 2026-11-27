/**
 * 系统用户管理。
 *
 * 只做初始化需要的最小集：查用户是否存在、创建用户。日常的用户管理
 * （改密码、改组、删用户）等 M4 再说。
 *
 * 全部走标准命令（useradd / id / chpasswd）而不是直接改 /etc/passwd：
 * 那些命令会同时处理 shadow、group、home 目录、SELinux 上下文，手改
 * 文件迟早漏掉其中一项。
 */

import { run } from "./exec.ts";

/** 用户名合法：小写字母开头，之后允许小写字母、数字、连字符、下划线。 */
const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

/** 密码最短长度。不是安全的下限，只是拦住明显的手滑。 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * 保留用户名。
 *
 * 这些名字不能作为初始化时创建的用户，分两类：
 *
 *   root     超级用户，永远存在
 *   daemon / bin / sys / adm / nobody / systemd-* / polkitd / dbus / sshd
 *            发行版自带的系统账号，占了会撞 UID 或让服务起不来
 *   reinas   产品名。镜像里已经不再预置这个账号（os 仓库 D-007 的后续
 *            修订），但留作保留名，避免用户取一个和面板同名的账号
 *            造成混淆（比如 `su reinas` 到底指谁）
 */
const RESERVED = new Set([
  "root",
  "reinas",
  "daemon",
  "bin",
  "sys",
  "adm",
  "nobody",
  "systemd-network",
  "systemd-resolve",
  "polkitd",
  "dbus",
  "sshd",
]);

export interface CreateUserInput {
  username: string;
  password: string;
}

export type CreateUserResult =
  | { ok: true; username: string }
  | {
      ok: false;
      reason: "invalid_name" | "reserved" | "weak_password" | "already_exists" | "failed";
      message: string;
    };

/**
 * 校验用户名。
 *
 * 单独抽出来是为了前端能用同一份规则做即时校验——前后端各写一套正则，
 * 迟早对不上。
 */
export function validateUsername(username: string): { ok: true } | { ok: false; message: string } {
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      message: "用户名需以小写字母开头，只能包含小写字母、数字、连字符和下划线，最长 32 位",
    };
  }
  if (RESERVED.has(username)) {
    return { ok: false, message: `"${username}" 是系统保留名，请换一个` };
  }
  return { ok: true };
}

/** 校验密码。现在只检查长度，复杂度策略等有需求再加。 */
export function validatePassword(password: string): { ok: true } | { ok: false; message: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `密码至少 ${MIN_PASSWORD_LENGTH} 位` };
  }
  return { ok: true };
}

/** 用户是否已存在。用 `id -u` 而不是读 /etc/passwd：NSS 可能挂到别处。 */
export async function userExists(username: string): Promise<boolean> {
  const result = await run(["id", "-u", username], { timeoutMs: 3_000 });
  return result.exitCode === 0;
}

/**
 * 创建系统用户。
 *
 * 建出来的账号：有 home 目录、bash 登录 shell、在 wheel 组（能 sudo）。
 * 这是初始化时那个"主用户"应有的形态。
 *
 * ⚠️ 密码通过 stdin 传给 chpasswd，不放在命令行参数里——`ps` 能看到
 * 命令行，那样等于把密码广播给系统上所有用户。
 */
/**
 * 给已存在的用户设密码。
 *
 * 密码走 stdin（chpasswd 的 "用户名:密码" 行格式），不走命令行参数：
 * `ps` 能看到别的进程的 argv，参数传密码等于广播给系统上所有用户。
 */
async function setPassword(
  username: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  const proc = Bun.spawn(["chpasswd"], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });

  try {
    await proc.stdin.write(`${username}:${password}\n`);
    await proc.stdin.end();
  } catch (err) {
    // 写入失败（管道断了）也要杀掉进程，不然会留一个挂着等输入的 chpasswd
    proc.kill();
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `写入密码失败：${detail}` };
  }

  if ((await proc.exited) !== 0) {
    const stderr = await new Response(proc.stderr).text();
    return { ok: false, message: stderr.trim() || "chpasswd 失败" };
  }
  return { ok: true, message: "" };
}

/**
 * 建用户（不设密码）。单独一层是为了让 createUser 的复杂度可控。
 *
 * 失败时把原始 stderr 包一层可读说明再返回：裸的
 * `Executable not found in $PATH: "useradd"` 对用户没有意义，但
 * 保留下来能让人知道是环境问题（开发机是 macOS）还是操作问题。
 */
async function addUser(username: string): Promise<{ ok: boolean; message: string }> {
  const result = await run(["useradd", "-m", "-G", "wheel", "-s", "/bin/bash", username]);
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || "未知错误";
    return {
      ok: false,
      message: `创建用户失败：这个系统上执行不了 useradd（${detail}）`,
    };
  }
  return { ok: true, message: "" };
}

/**
 * 创建系统用户并设置密码。
 *
 * 建出来的账号：有 home 目录、bash 登录 shell、在 wheel 组（能 sudo）。
 * 这是初始化时那个"主用户"应有的形态。
 *
 * 校验 → 查重 → 建用户 → 设密码，四步。任何一步失败都返回具体原因，
 * 前端据此提示（而不是笼统的"失败了"）。
 */
export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const nameCheck = validateUsername(input.username);
  if (!nameCheck.ok) {
    return {
      ok: false,
      reason: RESERVED.has(input.username) ? "reserved" : "invalid_name",
      message: nameCheck.message,
    };
  }

  const passCheck = validatePassword(input.password);
  if (!passCheck.ok) {
    return { ok: false, reason: "weak_password", message: passCheck.message };
  }

  if (await userExists(input.username)) {
    return {
      ok: false,
      reason: "already_exists",
      message: `用户 "${input.username}" 已存在`,
    };
  }

  const added = await addUser(input.username);
  if (!added.ok) {
    return { ok: false, reason: "failed", message: added.message };
  }

  const pw = await setPassword(input.username, input.password);
  if (!pw.ok) {
    // 用户建出来了但没密码 —— 这个账号登不进去，必须说清楚，
    // 否则用户会以为初始化成功了。
    return {
      ok: false,
      reason: "failed",
      message: `${pw.message}（用户已创建，但密码未设置，该账号目前无法登录）`,
    };
  }

  return { ok: true, username: input.username };
}
