# ReiNAS Controller

ReiNAS 的 Web 控制器。跑在 NAS 上，提供桌面式 Web 界面和命令行工具。

**当前状态**：M0 骨架已跑通，M1 未开始。详见 `STATUS.md`。

## 是什么

一个单二进制程序：

- **CLI**：唯一入口。`reinas serve` 启动 HTTP 服务，`reinas info` 查看系统
- **HTTP 服务**：作为 CLI 的子命令模块，浏览器打开 `https://<nas-ip>:5090`
- **前端资源**：编译时嵌入二进制，运行时不需要外部目录

打包方式 `bun build --compile`。**NAS 上不需要安装 node / bun / 任何运行时。**

## 技术栈

```
运行时      bun 1.4
服务端      ElysiaJS
类型检查    tsrs      TypeScript 7 的 Rust 移植（未安装原版 typescript）
Lint        oxlint    type-aware + type-check
Format      oxfmt
Git hooks   lefthook
编排        turbo
前端        React 19 + Vite（dev 和 build 同一份配置）
```

## 目录

```
apps/
  cli/      唯一入口（apps 下只有这一个），产物在 cli/dist/reinas
packages/
  server/   HTTP 服务（ElysiaJS）
  web/      前端（React 19 + Vite），产物在 web/dist/
  core/     业务逻辑，不依赖 HTTP
  shared/   跨边界类型、错误码、常量
scripts/    编译与验证脚本
```

两个 `dist/` 都在包目录内。前端产物由 cli 构建时内联进二进制，NAS 上不需要
外部目录。原因见 `docs/decisions.md` D-003。

依赖方向单向：`cli → server → core → shared`。

## 构建

```bash
bun install
bun run dev                  # Vite 5173 + API 5090
bun run build                # 默认交叉编译 linux-x64
bun run build:linux:arm64    # 交叉编译 linux-aarch64（给 ARM VM / ARM NAS）
bun run build:linux:x86_64   # 显式 linux-x64
```

产物在 `apps/cli/dist/reinas`。

**前端由 Vite 打包**（`packages/web/vite.config.ts`，dev 和 build 共用一份），
产物落到 `packages/web/dist/`，再由 cli 构建时内联进二进制。同一个打包器保证
"本地看到的就是部署后的样子"——两套打包器会有行为漂移。见 `docs/decisions.md`
D-002。

开发时前端跑在宿主机、后端可以跑在 Linux 虚机（面板功能要调 `lsblk` / `btrfs`
/ `useradd`，macOS 上都没有）：

```bash
REINAS_API_TARGET=http://127.0.0.1:5090 bun run dev
```

**架构必须通过 `TARGET` 指定**，它在 `turbo.json` 的 `build.env` 里声明过——
turbo 默认 `strict` 模式会把未声明的环境变量从任务里过滤掉，漏了这行
`TARGET=bun-linux-arm64 bun run build` 会静默产出 x64 二进制。

## 文档

- `STATUS.md` — 进度、下一步、待定事项
- `docs/roadmap.md` — M0–M5 分阶段目标
- `AGENTS.md` — 代码规矩与 lint 规则清单
