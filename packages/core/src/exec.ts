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
  /**
   * 替换子进程的环境变量（不是合并）。
   *
   * 传了就完全覆盖，父进程的环境一个都不继承。敏感数据（密码）走这里，
   * 不要拼进 argv——argv 全世界可读，environ 只有 root 和属主能读。
   */
  env?: Record<string, string>;
}

/**
 * 跑一个命令，返回 stdout/stderr/退出码。不抛异常——由调用方判断 exitCode。
 *
 * 这样设计是因为很多命令「非零退出但输出有意义」，比如 smartctl 用位掩码
 * 表示状态，退出码 4 也可能是正常的。
 */
export async function run(cmd: string[], options: RunOptions = {}): Promise<RunResult> {
  const { timeoutMs = 10_000, sudo = false, cwd, env } = options;
  const argv = sudo ? ["sudo", "-n", ...cmd] : cmd;

  const proc = Bun.spawn(argv, {
    stdout: "pipe",
    stderr: "pipe",
    ...(cwd ? { cwd } : {}),
    ...(env ? { env } : {}),
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
 * 跑一段 shell 脚本。
 *
 * 和 `run` 的区别：`run` 是 argv 直接调用，这里是 `bash -c`，能用管道、
 * 重定向、命令组合。什么时候需要它：
 *
 *   - 要把数据喂给命令的 stdin（`printf ... | chpasswd`）
 *   - 一条 shell 里能做但拆成多进程反而更绕的事
 *
 * ⚠️ **不要用 Bun 的 stdin 管道给命令喂数据。** 服务由 systemd 托管时
 * （stdin=/dev/null、stdout/stderr=journal socket），
 * `Bun.spawn(["cmd"], { stdin: "pipe" })` 再 `stdin.write()` 会稳定抛
 * `EPIPE: broken pipe`。同样的代码在交互式 shell 里完全正常，所以测试时
 * 很难发现。用这个函数，让 shell 自己接管道。
 *
 * ⚠️ **敏感数据走 `env`，不要拼进脚本字符串。** 脚本是 bash 的 argv，
 * `/proc/<pid>/cmdline` 全世界可读（`ps aux` 就能看到）；而 `env` 只在
 * `/proc/<pid>/environ` 里，那个文件只有 root 和进程属主能读。
 *
 * 非零退出不抛异常，由调用方判断——和 `run` 保持一致。
 */
export async function runShell(script: string, options: RunShellOptions = {}): Promise<RunResult> {
  return run(["bash", "-c", script], {
    timeoutMs: options.timeoutMs,
    cwd: options.cwd,
    // 传了 env 就用它替换整个环境。不合并父进程的：父进程可能带着
    // 一堆无关变量（甚至别处的凭据），子进程不需要也不该看到。
    ...(options.env ? { env: { ...BASE_ENV, ...options.env } } : {}),
  });
}

/**
 * 子进程的最小环境。
 *
 * 不继承父进程的：systemd 会塞一堆 `JOURNAL_STREAM` / `INVOCATION_ID` 之类
 * 的东西，对子进程没用；更重要的是避免无意间把父进程的凭据传下去。
 */
const BASE_ENV: Record<string, string> = {
  PATH: "/usr/local/bin:/usr/bin:/bin",
  LANG: "C.UTF-8",
};

export interface RunShellOptions {
  /** 超时毫秒数，默认 10 秒 */
  timeoutMs?: number;
  /** 工作目录 */
  cwd?: string;
  /**
   * 额外环境变量。用于传敏感数据（密码）。
   *
   * 会覆盖 `BASE_ENV` 里的同名项，但不继承父进程环境——传什么子进程就
   * 只看到什么。
   */
  env?: Record<string, string>;
}
