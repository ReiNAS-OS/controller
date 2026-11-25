# ReiNAS Controller

ReiNAS 的 Web 控制器。跑在 NAS 上，提供桌面式 Web 界面和命令行工具。

**当前状态**：M0 骨架已跑通，M1 未开始。见 `STATUS.md`。

## 是什么

一个单二进制程序：

```
reinas                  ← CLI 入口（唯一可执行文件）
  └─ reinas serve       ← 启动 @reinas/server 的 HTTP 服务
       └─ 前端产物       ← 编译时嵌入二进制
```

**NAS 上不需要安装 node / bun / 任何 JS 运行时。**

## 技术栈

```
运行时      bun 1.4
服务端      ElysiaJS
类型检查    tsrs      TypeScript 7 的 Rust 移植（未安装原版 typescript）
Lint        oxlint    type-aware + type-check
Format      oxfmt
Git hooks   lefthook
编排        turbo
前端        React 19 + Bun 打包器（不用 Vite）
```

## 目录

```
apps/
  cli/      唯一入口。只做参数解析和命令分发，不写业务
packages/
  server/   ElysiaJS 路由与响应包装
  web/      前端。index.html 指向源码，不是构建产物
  core/     业务逻辑，不依赖 HTTP
  shared/   跨边界类型、错误码、常量
scripts/    仓库级工具（文件大小检查等）
docs/       详细文档
```

**`apps/` 只有一个包**：cli，它是最终交付物。其余都是 `packages/` 的库。

**依赖方向单向**：`cli → server → core → shared`。`core` 不知道 server 和
cli 存在。cli 额外把 web 声明成 devDependency——不是 import 它，而是让 turbo
知道「cli 构建需要 web 的产物」。

## 常用命令

```bash
bun install                              # 装依赖
bun run dev                              # 单进程 5090，前端 HMR
bun run build                            # turbo 编排全部构建
TARGET=bun-darwin-arm64 bun run build    # 本机调试
bun run lint / lint:fix / fmt            # 检查 / 修复 / 格式化
```

**所有根命令只调 turbo 或工具**，不直接跨包执行子模块的脚本。

### dev 怎么工作

一个进程、一个端口：

```
Bun.serve 的 routes
  /api/*  →  Elysia 的 handle()
  /*      →  packages/web/index.html（Bun 的 HTML import）
                 └─ 转译 .tsx、注入 HMR、改代码自动更新
```

dev 和生产访问同一个 URL（5090），不会出现「开发开 5174，部署后是 5090」。

**为什么不用 Vite**：Bun 1.3+ 自带 dev server 和打包器，覆盖 HMR 和 React。
多一个 Vite 就多一套配置要和 dev 行为对齐，而「dev 和生产不一致」正是最容易
出问题的地方。

## 这个项目特有的坑

1. **产物必须放在包目录内。** turbo 只缓存包目录下的 outputs。产物落到仓库
   根时，缓存命中只重放日志、不恢复文件，删掉产物再构建会得到空目录。
   所以前端产物在 `packages/web/dist/`，二进制在 `apps/cli/dist/`。

2. **`bun build --compile` 要嵌入静态资源，必须用 `compile.assets`。**
   旧的 `files` 参数在新版 bun 里静默不生效，表现是二进制跑起来只返回纯文本、
   静态资源 404。

3. **bundled 后 `import.meta.dir` 是 `/$bunfs/root`。** 找嵌入资源的路径要
   同时兼容源码运行和编译形态，见 `packages/server/src/index.ts` 的
   `resolvePublicDir`。

4. **本地 macOS 跑通不代表 Fedora 跑通。** 二进制要在 QEMU 里验过才能接进
   os 镜像。流程见 `docs/testing.md`。

5. **不要安装原版 `typescript`。** 类型检查走 `tsrs`，两者诊断有
   细微差异，混用会看到不同的报错。elysia 把 typescript 声明成 optional
   peer，缺了不影响。

## 代码规矩

全部由 lint 强制，违反就提交不了。完整清单见 **[docs/lint-rules.md](docs/lint-rules.md)**。

最常撞上的几条：`no-explicit-any`、`no-nested-ternary`、`complexity≤10`、
`max-depth≤3`、文件名 kebab-case、hook 依赖必须完整、不许 `../` 跨目录 import。

## API 与客户端

**所有端点带 `/api/v1/` 前缀。** 端口和版本定义在
`packages/shared/src/constants.ts`。改接口的语义或响应形状才加 `/v2/`，
只新增端点或加字段不用——细节见 **[docs/api.md](docs/api.md)**。

**前端不用手写 fetch，走 Eden。** `packages/web/src/api.ts` 导出 `api` 实例，
类型从后端自动推出来：

```ts
const health = await unwrap(api.api.v1.health.get());
```

改了后端路由，前端编译就报不匹配。但有两个前提，破坏任何一个类型会静默退化
成 `any`：

1. 后端路由必须用方法链（`.get().get()`），不能分开调用
2. 前后端 elysia 版本必须一致

## 查 Elysia 文档

遇到任何 Elysia 相关问题，先查 **https://elysiajs.com/llms.txt** —— 官方给
LLM 用的文档索引，列出全部页面的 markdown 直链（`.html` 换 `.md`）。

## 提交规则

- 提交被 lefthook 拒了，照报错改，不要 `--no-verify`。
- 文件超 20 KB 会被拦，按功能拆开。确实不该拆的加进 `scripts/check-size.ts`
  的跳过列表。
- 写新函数、新规则前，先搜项目里有没有现成的。
- 改架构前先读 `docs/` 下的决策记录。

## 相关文档

- `STATUS.md` — 进度、下一步、待定事项
- `docs/roadmap.md` — M0–M5 分阶段目标
- `docs/api.md` — API 版本策略、响应形状、Eden 的硬要求
- `docs/lint-rules.md` — 完整 lint 规则与 import 约束
- `docs/decisions.md` — 结构决策（D-001 起）
- `docs/testing.md` — 在 QEMU 里验证二进制
- `../os/docs/decisions-panel.md` — 为什么移除 Cockpit、与镜像怎么对接
