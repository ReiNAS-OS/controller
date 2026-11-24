# ReiNAS Controller

ReiNAS NAS 的 Web 控制器。桌面式 Web 界面 + CLI，单二进制分发。

## 技术栈

```
运行时      bun
服务端      ElysiaJS
类型检查    tsrs      —— TypeScript 7 的 Rust 移植，替代 tsc
Lint        oxlint    —— Rust，type-aware 由 tsrs 支撑
Format      oxfmt
Git hooks   lefthook
前端        Vite 8 + React 19
```

## 目录

```
packages/core     业务逻辑（不依赖 HTTP，CLI 与 server 共用）
packages/server   ElysiaJS 路由
packages/cli      命令行入口
packages/shared   类型、常量、错误码
apps/web          前端
public/           前端产物，随二进制分发
```

## 常用命令

```bash
bun install                # 装依赖
bun run dev                # 开发模式（前后端）
bun run build              # 构建二进制 + 前端
bun run compile            # 只编译二进制
bun run check              # tsrs 类型检查
bun run lint               # oxlint
bun run fmt                # oxfmt
```

## 规矩

- **`core` 不许 import server 或 cli 的东西。** 它是共享业务层，反向依赖会
  让 CLI 和 HTTP 无法独立测试。
- **类型检查用 `tsrs`，不用 `tsc`。** 两者诊断有细微差异，混用会看到不同的报错。
- **改架构前先读 `docs/roadmap.md` 和 `STATUS.md`。**
- **提交被 lefthook 拒了，照报错改，不要 `--no-verify`。**

## 相关文档

- `STATUS.md` — 做到哪了、下一步做什么、哪些事还没定
- `docs/roadmap.md` — M0–M5 分阶段目标
- `../os/docs/decisions-panel.md` — 为什么移除 Cockpit、面板与镜像怎么对接
