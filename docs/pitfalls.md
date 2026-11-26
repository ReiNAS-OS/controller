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

## 6. 不要安装原版 `typescript`

**原因**：类型检查走 `tsrs`（TypeScript 7 的 Rust 移植），两者诊断有细微差异，
混用会看到不同的报错。

**结论**：elysia 把 typescript 声明成 optional peer，缺了不影响。

---

## 7. `TARGET` 必须出现在 `turbo.json` 的 `build.env`

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

## 8. dev server 不监听文件系统

**现象**：在虚机里跑 `bun run dev`（源码通过 9p 挂载），改宿主机的 `.tsx`，
日志出现 `Reloaded in 0ms`，但浏览器拿到的仍是旧代码。

**原因**：Bun 的 dev server 在客户端首次请求模块时编译并缓存。它能感知文件变化，
但客户端模块不会重新编译。

**结论**：虚机里改前端要重启 dev server。更好的做法是**前端在宿主机跑**，
虚机只用于验证后端命令输出。见 `docs/testing.md`。
