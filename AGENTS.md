# ReiNAS Controller

ReiNAS 的 Web 控制器。跑在 NAS 上，提供桌面式 Web 界面和命令行工具。

**当前状态**：M0 骨架 + 桌面 UI 外壳。见 `STATUS.md`。

**单二进制交付**：`reinas` 是唯一可执行文件，`reinas serve` 启动 HTTP 服务，
前端产物编译时嵌入。**NAS 上不需要 node / bun / 任何 JS 运行时。**

**技术栈**：bun 1.4 / ElysiaJS / React 19 / Vite（dev 和 build 同一份配置）
/ 手写 CSS 不用 UI 库/ turbo 编排 / oxlint + oxfmt + lefthook / 类型检查走 `tsrs`
（TypeScript 7 的 Rust 移植，**不装原版 typescript**）。

## 目录

```
apps/
  cli/      唯一入口。只做参数解析和命令分发，不写业务
packages/
  server/   ElysiaJS 路由与响应包装
  web/      前端。src/desktop/ 是桌面外壳，index.html 指向源码
  core/     业务逻辑，不依赖 HTTP
  shared/   跨边界类型、错误码、常量
scripts/    仓库级工具（文件大小检查等）
docs/       详细文档
```

**依赖方向单向**：`cli → server → core → shared`。`core` 不知道 server 和 cli
存在。cli 额外把 web 声明成 devDependency——不是 import 它，而是让 turbo 知道
「cli 构建需要 web 的产物」。

## 常用命令

```bash
bun install                    # 装依赖
bun run dev                    # Vite 5173 + API 5090，前端 HMR
bun run build                  # turbo 编排全部构建（默认 linux-x64）
bun run build:linux:arm64      # 显式 aarch64
bun run build:linux:x86_64     # 显式 x86-64
bun run lint / lint:fix / fmt  # 检查 / 修复 / 格式化
bun run test:linux             # 在 fedora:45 容器里验证（5 秒）
```

**所有根命令只调 turbo 或工具**，不直接跨包执行子模块的脚本。

## 开发流程

**前端在宿主机（Vite），后端在 Linux 虚机。** 改 `.tsx` 立刻生效。

```bash
cd ../os && ./scripts/vm.sh dev                      # 虚机，转发 5090
REINAS_API_TARGET=http://127.0.0.1:5090 bun run dev  # 宿主，Vite 反代到虚机
```

为什么后端要在虚机：面板的功能全要调 `lsblk` / `btrfs` / `useradd` / `/proc`，
macOS 上这些都不存在。

为什么前端要在宿主机：共享文件系统（9p / vboxsf / NFS）不投递 inotify 事件，
Vite/Bun 的文件监听在挂载目录上不触发。前端回本地盘才正常。

**dev 和 build 必须用同一个打包器**（都是 Vite，同一份 `vite.config.ts`）。
两套打包器会有行为漂移——本地能跑、构建出来白屏。见 `docs/decisions.md` D-002。

## 这个项目特有的坑

八条，完整版（现象 + 原因 + 结论）见 **[docs/pitfalls.md](docs/pitfalls.md)**。

1. 产物必须放在包目录内 —— turbo 只缓存包目录下的 outputs
2. `bun build --compile` 嵌资源用 `compile.assets` —— 旧的 `files` 静默失效
3. bundled 后 `import.meta.dir` 是 `/$bunfs/root` —— 见 `resolvePublicDir`
4. 不要依赖 `uname` / `hostname` —— 最小镜像没有 coreutils，读 `/proc`
5. 本地 macOS 跑通不代表 Fedora 跑通 —— 用 `test:linux` 容器测
6. 不要装原版 `typescript` —— 类型检查走 `tsrs`
7. `TARGET` 必须写进 `turbo.json` 的 `build.env` —— 否则静默产出错误架构
8. 共享文件系统不投递 inotify —— 前端只能跑在本地盘上

## 代码规矩

全部由 lint 强制，违反就提交不了。完整清单见 **[docs/lint-rules.md](docs/lint-rules.md)**。
最常撞上的：`no-explicit-any`、`no-nested-ternary`、`complexity≤10`、
`max-depth≤3`、`max-lines-per-function≤80`、kebab-case 文件名、hook 依赖必须
完整、不许 `../` 跨目录 import。

## API 与客户端

**所有端点带 `/api/v1/` 前缀**（定义在 `packages/shared/src/constants.ts`）。
改接口语义或响应形状才加 `/v2/`，只新增端点或加字段不用——见
**[docs/api.md](docs/api.md)**。

**前端走 Eden，不手写 fetch。** `packages/web/src/api.ts` 导出 `api` 实例，
类型从后端自动推出来。两个硬要求，破坏任何一个类型会静默退化成 `any`：
后端路由必须用方法链（`.get().get()`）；前后端 elysia 版本必须一致。

## 前端界面

桌面外壳在 `packages/web/src/desktop/`，**纯手搓，无 UI 库**（不用 react-rnd /
framer-motion / Tailwind）。拖动缩放走原生 pointer events + `setPointerCapture`，
CSS 手写变量。每个文件头都有详细说明，看目录即可。两条硬约定：

- **层级顺序**定义在 `style.css` 的 `--z-*` 变量（壁纸 0 → 最小化条 5 →
  窗口 100+ → Dock 500 → 顶栏 1000）。TS 侧的 `Z_BASE` 必须与之一致。
- **窗口坐标是像素**，不用 rem，否则拖动位置和样式对不上。

## 查 Elysia 文档

遇到 Elysia 相关问题先查 **https://elysiajs.com/llms.txt** —— 官方给 LLM 用的
文档索引，列出全部页面的 markdown 直链（`.html` 换 `.md`）。

## 提交规则

- 提交被 lefthook 拒了，照报错改，不要 `--no-verify`。
- 文件超 20 KB 会被拦，按功能拆开。确实不该拆的加进 `scripts/check-size.ts`
  的跳过列表。
- 写新函数、新规则前，先搜项目里有没有现成的。
- 改架构前先读 `docs/` 下的决策记录。

## 相关文档

`docs/` 下：`roadmap.md`（M0–M5）、`pitfalls.md`（八个坑）、`testing.md`（开发
流程 + 两层验证）、`api.md`（版本策略与 Eden 硬要求）、`lint-rules.md`（完整
规则）、`decisions.md`（结构决策）。另有 `../os/docs/decisions-panel.md`
（为什么移除 Cockpit、与镜像怎么对接）。
