# ReiNAS Controller

ReiNAS 的 Web 控制器。跑在 NAS 上，提供桌面式 Web 界面和命令行工具。

**单二进制交付**：`reinas` 是唯一可执行文件，`reinas serve` 起 HTTP 服务，
前端产物编译时嵌入。**NAS 上不需要任何 JS 运行时。**

**技术栈**：bun 1.4 / ElysiaJS / React 19 / Vite（dev+build 同一份配置）/
turbo / oxlint + oxfmt + lefthook / 类型检查走 `tsrs`（**不装原版
typescript**）。当前进度见 `STATUS.md`。

## 目录

```
apps/cli        唯一入口，只做参数解析和分发
packages/server ElysiaJS 路由与响应包装
packages/web    前端，src/desktop/ 是桌面外壳
packages/core   业务逻辑，不依赖 HTTP
packages/shared 跨边界类型、错误码、常量
```

**依赖方向单向**：`cli → server → core → shared`。cli 把 web 声明成
devDependency 不是为了 import，是让 turbo 知道构建顺序。

## 常用命令

```bash
bun run dev                    # Vite 5173 + API 5090
bun run build:linux:arm64      # 交叉编译（默认 linux-x64）
bun run lint                   # 规则检查（oxlint --type-aware）
bun run typecheck              # 类型检查（tsrs --noEmit）
bun run check                  # 两个都跑
bun test                       # 单元测试（bun 内置）
bun run fmt / test:linux
```

**所有根命令只调 turbo 或工具**，不直接跨包执行子模块的脚本。

## 开发流程

**前端在宿主机（Vite），后端在 Linux 虚机。** 改 `.tsx` 立刻生效。

```bash
cd ../os && ./scripts/vm.sh dev                      # 虚机，转发 5090
REINAS_API_TARGET=http://127.0.0.1:5090 bun run dev  # 宿主，Vite 反代到虚机
```

后端要在虚机：功能全调 `lsblk` / `btrfs` / `useradd` / `/proc`，macOS 没有。
前端要在宿主机：共享文件系统（9p / vboxsf / NFS）不投递 inotify，监听不触发。

**dev 和 build 必须同一个打包器**（都是 Vite，同一份 `vite.config.ts`）——
两套会行为漂移，本地能跑、构建出来白屏。见 `docs/decisions.md` D-002。

## 这个项目特有的坑

完整版（现象 + 原因 + 结论）见 **[docs/pitfalls.md](docs/pitfalls.md)**。

1. 产物放包目录内 —— turbo 只缓存包目录下的 outputs
2. 嵌资源用 `compile.assets` —— 旧的 `files` 静默失效
3. bundled 后 `import.meta.dir` 是 `/$bunfs/root`
4. 不依赖 `uname` / `hostname` —— 最小镜像没 coreutils，读 `/proc`
5. macOS 跑通不代表 Fedora 跑通 —— 用 `test:linux` 测
6. `TARGET` 要进 `turbo.json` 的 `build.env` —— 否则静默产出错架构
7. systemd 下 `Bun.spawn` 的 stdin 管道会 EPIPE —— 凭据走 env，让 shell 接管道
8. 共享文件系统不投递 inotify —— 前端只能跑本地盘
9. 去掉 `--type-aware` 会让三条规则静默失效 —— 它不是类型检查开关

## 代码规矩

**lint 管规则，tsrs 管类型**，两个独立的命令（`bun run check` 一起跑）。
完整清单见 **[docs/lint-rules.md](docs/lint-rules.md)**。最常
撞的：`no-explicit-any`、`no-nested-ternary`、`complexity≤10`、`max-depth≤3`、
`max-lines-per-function≤80`、kebab-case 文件名、hook 依赖要完整、不许 `../`。

## API 与客户端

**所有端点带 `/api/v1/` 前缀**（定义在 `packages/shared/src/constants.ts`）。
改接口语义或响应形状才加 `/v2/`，只新增端点或加字段不用——见
**[docs/api.md](docs/api.md)**。

**前端走 Eden，不手写 fetch**（`packages/web/src/api.ts`）。两个硬要求，破坏
任一个类型会静默退化成 `any`：后端路由用方法链（`.get().get()`）；前后端
elysia 版本一致。

## 前端界面

`packages/web/src/desktop/`，**纯手搓，无 UI 库**。原生 pointer events +
`setPointerCapture`，CSS 手写变量。每个文件头有详细说明。

两条硬约定：层级固定在 `style.css` 的 `--z-*`，TS 侧 `Z_BASE` 必须一致；
窗口坐标用像素不用 rem。

## 查 Elysia 文档

先查 **https://elysiajs.com/llms.txt** —— 官方文档索引，全部页面的 `.md` 直链。

## 提交规则

- **提交后立刻推送。** 「提交」指 `git commit` + `git push` 两步，只做前者等于
  工作没完成——本地提交别人看不到，换机器就丢，CI 也不会跑。推到远端失败
  （钩子拦下、网络问题）要当场解决，不要留一堆未推送的提交过夜。
- 提交被 lefthook 拒了照报错改，不要 `--no-verify`。
- 文件超 20 KB 会被拦，按功能拆开；不该拆的加进 `scripts/check-size.ts`。
- 写新函数、新规则前先搜项目里有没有现成的。
- 改架构前先读 `docs/` 的决策记录。

## 相关文档

`docs/`：`roadmap.md` 路线、`pitfalls.md` 九个坑、`testing.md` 两层验证、
`api.md` 端点清单与 Eden 硬要求、`lint-rules.md` 完整规则、`decisions.md`
结构决策。另有 `../os/docs/decisions-panel.md`（Cockpit 移除、与镜像对接）。
