# 构建与运行期的坑

controller 特有的陷阱。都是从实际失败里踩出来的，不是预防性罗列。

AGENTS.md 里只留一行摘要指向这里。

---

## 1. 产物必须放在包目录内

**现象**：删掉 `public/` 后跑 `bun run build`，turbo 报 cache hit，但目录依然是空的——编出一个没有界面的二进制。

**原因**：turbo 只缓存「包目录下」的 outputs。产物落到仓库根时，缓存命中只重放日志、不恢复文件。

**结论**：前端产物在 `packages/web/dist/`，二进制在 `apps/cli/dist/`。见 `docs/decisions.md` D-003。

---

## 2. `bun build --compile` 嵌入静态资源要用 `compile.assets`

**现象**：二进制跑起来只返回纯文本，静态资源 404。

**原因**：旧的 `files` 参数在新版 bun 里**静默不生效**，不报错。

**结论**：

```ts
compile: {
  outfile: outFile,
  target: "bun-linux-arm64",
  assets: [webDist],   // 不是 files
}
```

---

## 3. bundled 后 `import.meta.dir` 是 `/$bunfs/root`

**原因**：编译成单二进制后，源码不在真实文件系统上。

**结论**：找嵌入资源的路径要同时兼容源码运行和编译形态，见
`packages/server/src/index.ts` 的 `resolvePublicDir`。

---

## 4. 不要依赖 `uname` / `hostname` 这类外部命令

**现象**：最小 Fedora 容器里 `ENOENT`。

**原因**：镜像不一定装了 coreutils。

**结论**：优先读 `/proc`。

| 要什么 | 从哪读 |
|---|---|
| 主机名 | `/proc/sys/kernel/hostname` |
| 内核版本 | `/proc/sys/kernel/osrelease` |
| 内存 | `/proc/meminfo` |
| 负载 | `/proc/loadavg` |
| 启动时间 | `/proc/stat` 的 `btime` |
| 架构 | `process.arch`（不是 uname） |

外部命令只作为 fallback。

---

## 5. 本地 macOS 跑通不代表 Fedora 跑通

**结论**：用 `bun run test:linux` 在 fedora:45 容器里测（5 秒）。只有验证
systemd / SELinux / 首启扩盘才需要完整 QEMU（5-15 分钟）。见 `docs/testing.md`。

---

## 6. 不要安装原版 `typescript`；lint 和类型检查是两个工具

**两个工具，各管一件事：**

| 命令 | 工具 | 管什么 |
|---|---|---|
| `bun run lint` | `oxlint --type-aware` | 代码规则（`no-floating-promises` 等） |
| `bun run typecheck` | `tsrs --noEmit` | 类型错误（`TS2322` 等） |
| `bun run check` | 两个都跑 | 提交/推送前的完整检查 |

**为什么拆开**：`--type-check` 会让 oxlint 顺带报 TypeScript 类型错误，但那
有两个问题——它只检查 oxlint 没忽略的文件（`ignorePatterns` 里的目录会漏），
而且和 `tsrs` 的报错格式不一致，同一个错误在两处显示成两样。拆开之后
`tsrs` 是类型的唯一权威。

⚠️ **`--type-aware` 不能去掉**。它让规则能拿到类型信息；去掉之后
`no-floating-promises`、`await-thenable`、`no-unnecessary-type-assertion`
全部失效，而 `tsrs --noEmit` 补不上这些（它只管类型错误，不管未处理的
Promise）。所以是 `--type-aware` 保留、`--type-check` 去掉。

**不要装原版 `typescript`**：`tsrs` 是 TypeScript 7 的 Rust 移植，两者诊断
有细微差异，混用会看到不同的报错。elysia 把 typescript 声明成 optional
peer，缺了不影响。

---

## 7. systemd 下 `Bun.spawn` 的 stdin 管道会 EPIPE

**现象**：初始化建用户时接口返回

```
写入密码失败：EPIPE: broken pipe, write
（用户已创建，但密码未设置，该账号目前无法登录）
```

同样的代码在交互式 shell 里跑 20 次全成功，只有 systemd 托管的服务里会
稳定失败（3/3 复现）。

**原因**：服务由 systemd 启动时 stdin 是 `/dev/null`、stdout/stderr 是
journal socket。在这种环境里 `Bun.spawn(["chpasswd"], { stdin: "pipe" })`
再 `stdin.write()` 建不出可用的管道，直接 EPIPE。是 Bun 的实现问题，不是
代码逻辑。

**更隐蔽的地方**：`chpasswd` 收到空输入时**返回 0**，密码不会被设置。所以
失败可能表现成"接口返回 ok 但账号仍是锁定状态"——`passwd -S` 显示 `L`，
`/etc/shadow` 里是 `!`。这个 bug 就是这样漏过去的。

**结论**：给命令喂 stdin 一律走 `runShell`（`packages/core/src/exec.ts`），
不要直接 `Bun.spawn` + `stdin.write`：

```ts
// ❌ systemd 下 EPIPE
const p = Bun.spawn(["chpasswd"], { stdin: "pipe" });
await p.stdin.write(`${user}:${pass}\n`);
await p.stdin.end();

// ✅ 让 shell 自己接管道，凭据走 env
await runShell('printf \'%s\\n\' "$REINAS_PW" | chpasswd', {
  env: { REINAS_PW: `${user}:${pass}` },
});
```

凭据用**环境变量**而不是 argv：`/proc/<pid>/cmdline` 全世界可读（`ps` 就能
看到），而 `/proc/<pid>/environ` 只有 root 和属主能读。

**验证方式**：不要只看接口返回，用 `passwd -S <user>` 确认是 `P` 而不是
`L`；更进一步是 `echo '<pass>' | su - <user> -c 'echo OK'` 真的登一次。

---

## 8. `TARGET` 必须出现在 `turbo.json` 的 `build.env`

**现象**：

```bash
TARGET=bun-linux-arm64 bun run build
→ 产出 ELF x86-64（无任何警告）
```

拿这个二进制进 arm64 虚机会报 `no such file or directory`，看起来像二进制损坏，
实际是架构不匹配。

**原因**：turbo 2 默认 `envMode: strict`，会把未在 `env` 里声明的环境变量从任务
环境里过滤掉。

**结论**：`turbo.json` 的 build 任务必须写 `"env": ["TARGET"]`。

---

## 9. 共享文件系统不投递 inotify 事件

**现象**：前端跑在虚机里（源码通过 9p / vboxsf / NFS 挂载），改宿主机的
`.tsx`，dev server 不重新编译，浏览器拿到的仍是旧代码。

**原因**：这些共享文件系统只传元数据，不投递 inotify 事件。9p 上实测
`stat` 能看到新 mtime，但 `inotifywait` 一条事件都收不到。VirtualBox 的
vboxsf 同理，官方 ticket #10660 标记 wontfix。

**结论**：前端跑在宿主机（本地盘），后端跑在虚机。后端只是 API，Vite 把
`/api/*` 反代过去。见 `docs/testing.md` 和 `../os/docs/vm-workflow.md`。
