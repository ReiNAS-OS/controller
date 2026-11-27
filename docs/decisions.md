# 架构决策

记下做过的结构性选择，避免以后重复讨论。按时间倒序，最新的在上面。

---

## D-003：产物放在包目录内，不放仓库根

**背景**：前端产物原本输出到仓库根的 `public/`，二进制到根 `dist/`。

**问题**：turbo 只缓存「包目录下」的 outputs。产物在仓库根时，缓存命中只
重放日志、不恢复文件。实测删掉 `public/` 后跑 `bun run build`，turbo 报
cache hit，但目录依然是空的——编出一个没有界面的二进制。

**决策**：产物跟着包走。

```
packages/web/dist/     前端产物
apps/cli/dist/reinas   二进制
```

**代价**：cli 构建时要跨包读 `packages/web/dist/`。但这是读产物不是调脚本，
不违反「根命令不跨包执行子模块」的规矩。

---

## D-002：前端 dev 和 build 都用 Vite

**状态**：2026-11-27 修订。原决策是「用 Bun 自带的全栈 dev server，不用 Vite」，
现已废弃。

### 原决策为什么被推翻

Bun 的方案是 `Bun.serve` 的 `routes` + HTML import：

```ts
Bun.serve({
  development: true,
  routes: { "/api/*": (req) => app.handle(req), "/*": index },
})
```

在本机磁盘上它工作正常。但面板的大量功能要调 Linux 命令（`lsblk`、`btrfs`、
`useradd`、`/proc`），macOS 上这些根本不存在，所以**开发必须在 Linux 虚机里**。

而它依赖 inotify 事件感知文件变化，跨机器/共享文件系统上完全不工作：

| 方案 | inotify |
|---|---|
| QEMU 9p | ❌ mtime 能传播，但事件一条都不来 |
| VirtualBox vboxsf | ❌ 官方 ticket #10660 标记 wontfix |
| NFS / SMB | ❌ 协议层不传 |

试过 rsync 同步到虚机本地盘 + `bun --watch`，仍然失败：源文件、mtime、
进程都确认更新了，bundle hash 也变了，但产物内容始终是旧的（编译缓存
查不到失效条件）。这条路反复试了一小时以上，不可靠。

### 现在的方案

**dev 和 build 共用一份 `packages/web/vite.config.ts`。**

这是这次决策的核心：不是为了用 Vite 而用 Vite，而是**必须只有一个打包器**。
两套打包器（dev 用 A、build 用 B）会有行为漂移——JSX 语法、CSS 处理、别名
解析、tree-shake 结果都可能不一致，表现是「本地好好的，构建出来白屏」。

```
dev    bun run dev
         ├─ Vite dev server  5173  ← 浏览器访问这里，HMR
         │    └─ /api/* 反代 → REINAS_API_TARGET
         └─ 后端（可选）     5090  ← REINAS_API_TARGET 未设时本机起

build  bun run build:linux:arm64
         └─ vite build → packages/web/dist/
              └─ 内联进 apps/cli/dist/reinas（单二进制）
```

**跨机器开发**（前端 macOS、后端 Linux 虚机）：

```bash
REINAS_API_TARGET=http://127.0.0.1:5090 bun run dev
```

这时本机不起后端，Vite 把 `/api/*` 转给虚机。HMR 在宿主机本地盘上，
所以是正常的——这也是问题被解决的真正原因：**前端回到本地盘，后端留在
真 Linux 上**，两边各得其所。

### 原决策里「不用 Vite」的理由为什么不成立了

原文说「生产编译会把 vite 整条依赖图拉进来（`Could not resolve: "esbuild"`）」。
那是把 Vite 当 **middleware 塞进 Elysia 运行时**造成的。现在 Vite 是纯
devDependency：`bun build --compile` 只读 `packages/web/dist/` 的产物，
完全不知道 Vite 存在。二进制里搜不到任何 Vite 痕迹，只有打包后的
`assets/index-*.js|css`。

### 代价

- 多两个 devDependency：`vite`、`@vitejs/plugin-react`
- dev 多一个端口（5173 + 5090），但生产仍是单端口
- `server` 包不再有 `dev.ts`，`reinas serve --dev` 标志移除

---

## D-001：apps 只有 cli，server 是独立包

**背景**：一度把 server 塞进 `apps/cli/src/server/`，也试过让 web 待在 `apps/`。

**决策**：

```
apps/cli        唯一入口，最终交付物
packages/server HTTP 服务
packages/web    前端
packages/core   业务逻辑
packages/shared 类型、常量、错误码
```

**理由**：`apps/` 放可执行交付物，`packages/` 放被 import 的库。server 独立
成包之后能单独测试、单独被别的入口调用，`reinas serve` 只是调它的 `serve()`。

**依赖方向单向**：`cli → server → core → shared`。cli 额外把 web 声明成
devDependency——不 import 它，只是让 turbo 知道构建顺序。
