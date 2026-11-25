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

## D-002：前端工具链用 Bun，不用 Vite

**背景**：需要 dev 时前端热更新、生产时产物进二进制。

**试过的方案**：Vite 以 middleware mode 塞进 Elysia 的端口。dev 侧能跑通，
但生产编译会把 vite 整条依赖图拉进来（`Could not resolve: "esbuild"`），
静态 import 和动态 import 都拦不住。

**决策**：用 Bun 1.3+ 自带的全栈 dev server。

依据 <https://elysiajs.com/patterns/fullstack-dev-server>，机制是
`Bun.serve` 的 `routes` 加 HTML import：

```ts
Bun.serve({
  development: true,
  routes: {
    "/api/*": (req) => app.handle(req),  // Elysia
    "/*":     index,                     // HTML import，自带 HMR
  },
})
```

`packages/web/index.html` 的 `<script src="./src/main.tsx">` 指向**源码**，
Bun 自己转译，不需要预先构建。

**实测**：dev 和生产同端口同 URL；改 .tsx 后 bundle hash 变化且含新内容；
生产二进制里搜不到 HMR 客户端痕迹（`dev.ts` 是动态 import）。

**省掉的依赖**：vite、@vitejs/plugin-react、babel-plugin-react-compiler。

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
