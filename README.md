# ReiNAS Controller

ReiNAS 的 Web 控制器。跑在 NAS 上，提供桌面式 Web 界面和命令行工具。

**当前状态**：M0 骨架已跑通，M1 未开始。详见 `STATUS.md`。

## 是什么

一个单二进制程序：

- **CLI**：唯一入口。`controller serve` 启动 HTTP 服务，`controller info` 查看系统
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
前端        Vite 8 + React 19 + React Compiler
```

## 目录

```
apps/
  cli/      唯一入口，内含 server 模块
  web/      前端
packages/
  core/     业务逻辑，不依赖 HTTP
  shared/   跨边界类型、错误码、常量
public/     前端构建产物，编译时嵌入二进制
dist/       bun compile 输出
scripts/    编译脚本
```

## 构建

```bash
bun install
bun run build                            # 默认交叉编译 linux-x64
TARGET=bun-darwin-arm64 bun run build    # 本机调试用
```

产物在 `dist/controller`。

## 文档

- `STATUS.md` — 进度、下一步、待定事项
- `docs/roadmap.md` — M0–M5 分阶段目标
- `AGENTS.md` — 代码规矩与 lint 规则清单
