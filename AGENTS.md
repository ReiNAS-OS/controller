# ReiNAS Controller

ReiNAS 的 Web 控制器。跑在 NAS 上，提供桌面式 Web 界面和命令行工具。

**当前状态**：M0 骨架已跑通，M1 未开始。见 `STATUS.md`。

## 是什么

一个单二进制程序，内含三样东西：

```
reinas                 ← CLI 入口（唯一可执行文件）
  └─ reinas serve      ← 启动 @reinas/server 提供的 HTTP 服务
       └─ public/      ← 前端静态资源，编译时嵌入二进制
```

**NAS 上不需要安装 node / bun / 任何 JS 运行时。** 前端产物和业务代码全部
打进同一个可执行文件。

## 技术栈

```
运行时      bun 1.4
服务端      ElysiaJS
类型检查    tsrs（TypeScript 7 的 Rust 移植，已完全替代 tsc）
Lint        oxlint（type-aware + type-check，由 tsrs 支撑）
Format      oxfmt
Git hooks   lefthook
编排        turbo
前端        Vite 8 + React 19 + React Compiler
```

**没有安装原版 `typescript`。** 类型检查全部走 `tsrs`。

## 目录

```
apps/
  cli/      唯一入口。只做参数解析和命令分发，不写业务
packages/
  server/   ElysiaJS 路由与响应包装，提供 HTTP 服务
  web/      前端（Vite + React）
  core/     业务逻辑，不依赖 HTTP。CLI 与 server 共用
  shared/   跨边界类型、错误码、常量
public/     前端构建产物，编译时嵌入二进制
dist/       bun compile 输出的二进制
scripts/    编译脚本
```

**`apps/` 只有一个包**：cli。它是最终交付物（一个可执行二进制）。
其余全是 `packages/` 里的库，被 cli 或彼此 import。

**依赖方向只能是单向的**：

```
cli → server → core → shared
  └──────────────────↗
cli → shared
```

`core` 不知道 server 和 cli 存在。这条由 lint 和 code review 共同保证。

## 常用命令

```bash
bun install                              # 装依赖
bun run dev                              # 前后端同时热更新（推荐）
bun run dev:server                       # 只起后端（5090，bun --watch）
bun run dev:web                          # 只起前端（5174，Vite HMR）
bun run build                            # 前端 → public → 编译二进制
TARGET=bun-darwin-arm64 bun run build    # 交叉编译（默认 linux-x64）
bun run lint                             # oxlint，type-aware + type-check
bun run lint:fix                         # 全量修复
bun run fmt                              # oxfmt
bun run test                             # bun test
```

### dev 怎么工作

`bun run dev` 用 turbo 并行跑两个常驻任务：

```
后端  bun --watch → 5090    改代码自动重启
前端  Vite       → 5174     HMR，改代码不刷新页面

浏览器开 http://127.0.0.1:5174
  └─ Vite 把 /api 代理到 127.0.0.1:5090
```

**为什么前端绑 127.0.0.1**：Vite 默认只监听 `::1`（IPv6），curl 和一部分
浏览器走 IPv4 会连不上，表现为「Vite 说 ready 但打不开」。加 `--host 127.0.0.1`
避开。

**为什么端口是 5174 不是默认 5173**：5173 常被别的项目占。`--strictPort`
保证端口被占时直接报错，而不是静默换一个让人找半天。

## 代码规矩

全部由 lint 强制，没有 warn，违反就提交不了。

**类型与安全**

- `no-explicit-any` — 不许写 `any`
- `no-floating-promises` / `no-misused-promises` — Promise 必须处理
- `no-unnecessary-type-assertion` — 多余的 `as` 会报错

**控制流**

- `no-nested-ternary` — 不许嵌套三元
- `complexity` 上限 10 — 函数太绕就拆
- `max-depth` 上限 3 — 嵌套不超三层
- `max-lines-per-function` 80 行
- `max-params` 4 个
- `no-else-return` / `no-lonely-if` / `curly` — 控制流写清楚
- `eqeqeq` — 必须 `===`
- `no-shadow` — 不许遮蔽外层变量

**命名**

- `unicorn/filename-case` — 文件名必须 kebab-case

**React**

- `react/exhaustive-deps` — hook 依赖必须完整（error，不是 warn）
- `react-hooks/rules-of-hooks` — hook 调用位置
- `react/jsx-key` / `no-array-index-key`

**模块边界**

- `import/no-relative-parent-imports` — **禁止 `../` 跨目录 import**
- `no-restricted-imports` — 禁止 `../*`，以及直接 import 别包的 `src/` 内部文件

## Import 规则

三条路，按场景选：

```
同目录文件      "./sibling.ts"
本包内跨目录    "~/apps/cli/src/server/x.ts"   ← 用 ~ 别名，不用 ../
跨包            "@reinas/core"                 ← 走包的公开出口
```

`~` 指向**仓库根**，在 tsconfig 的 `paths` 和 Vite 的 `resolve.alias` 里各配了
一份，必须保持一致。bun 运行时自动读 tsconfig 的 paths，不用额外配。

**为什么不许 `../`**：一旦允许，目录一挪所有相对路径全断，而编辑器不会
提醒你。用 `~` 和包名，挪目录时只改一处配置。

**为什么不许 import 别包的 `src/`**：那等于绕过包的公开 API，内部重构会
静默破坏调用方。要暴露新东西就在那个包的 `package.json` 里加 export。

## 规矩（人写的，lint 管不到的）

- **`core` 不许 import cli 或 web 的东西。** 它是共享业务层，反向依赖会让
  CLI 和 HTTP 无法独立测试。
- **不要安装原版 `typescript`。** 类型检查用 `tsrs`。两者诊断有细微差异，
  混用会看到不同的报错。
- **提交被 lefthook 拒了，照报错改，不要 `--no-verify`。**
- **改架构前先读 `docs/roadmap.md` 和 `STATUS.md`。**

## 相关文档

- `STATUS.md` — 做到哪了、下一步、哪些事还没定
- `docs/roadmap.md` — M0–M5 分阶段目标
- `../os/docs/decisions-panel.md` — 为什么移除 Cockpit、与镜像怎么对接
