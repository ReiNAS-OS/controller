/**
 * 执行外部命令。
 *
 * 为什么统一封装：controller 要做的事大部分是调系统命令（lsblk、btrfs、
 * smartctl）。散在各处会重复处理三件事：超时、退出码、stderr。
 *
 * 用 Bun.spawn 而不是 node:child_process：这是 bun 项目，没必要绕。
 */

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunOptions {
  /** 超时毫秒数，默认 10 秒。系统命令卡住时要能自己结束。 */
  timeoutMs?: number;
  /** 以 root 运行（加 sudo）。仅用于确实需要特权的命令。 */
  sudo?: boolean;
  /** 工作目录 */
  cwd?: string;
}

/**
 * 跑一个命令，返回 stdout/stderr/退出码。不抛异常——由调用方判断 exitCode。
 *
 * 这样设计是因为很多命令「非零退出但输出有意义」，比如 smartctl 用位掩码
 * 表示状态，退出码 4 也可能是正常的。
 */
export async function run(cmd: string[], options: RunOptions = {}): Promise<RunResult> {
  const { timeoutMs = 10_000, sudo = false, cwd } = options;
  const argv = sudo ? ["sudo", "-n", ...cmd] : cmd;

  const proc = Bun.spawn(argv, {
    stdout: "pipe",
    stderr: "pipe",
    ...(cwd ? { cwd } : {}),
  });

  const timer = setTimeout(() => {
    proc.kill();
  }, timeoutMs);

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { stdout, stderr, exitCode };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 跑命令，非零退出就抛异常。适合「失败就是失败」的场景。
 */
export async function runOrThrow(cmd: string[], options: RunOptions = {}): Promise<string> {
  const { stdout, stderr, exitCode } = await run(cmd, options);
  if (exitCode !== 0) {
    throw new Error(
      `${cmd.join(" ")} 失败（退出码 ${exitCode}）：${stderr.trim() || stdout.trim()}`,
    );
  }
  return stdout;
}
