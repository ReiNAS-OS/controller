# ReiNAS Controller

ReiNAS 的 Web 控制器。跑在 NAS 上，提供桌面式 Web 界面和命令行工具。

**当前状态**：M0 骨架阶段，功能尚未实现。

## 是什么

一个单二进制程序，同时提供：

- **HTTP 服务**：浏览器打开 `https://<nas-ip>:5090` 得到桌面式界面
- **CLI**：命令行管理，与服务端共用同一套业务逻辑

打包方式是 `bun build --compile`，产出独立可执行文件。**NAS 上不需要安装
node / bun / 任何 JS 运行时**。

## 技术栈

```
运行时      bun
服务端      ElysiaJS
类型检查    tsrs（TypeScript 7 的 Rust 移植）
Lint        oxlint
Format      oxfmt
Git hooks   lefthook
前端        Vite 8 + React 19
```

## 目录

```
packages/
  core/     业务逻辑，不依赖 HTTP。CLI 和 server 都调它
  server/   ElysiaJS 路由层
  cli/      命令行入口
  shared/   类型、常量、错误码
apps/
  web/      前端（Vite + React）
public/     前端构建产物，随二进制分发
```

## 状态文档

- `STATUS.md` — 当前做到哪一步、下一步做什么
- `docs/roadmap.md` — 分阶段目标（只写目标，不写实现细节）
