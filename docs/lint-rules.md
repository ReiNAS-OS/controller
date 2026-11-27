# Lint 规则清单

配置在 `.oxlintrc.json`。**全部是 error，没有 warn**——违反就提交不了。

为什么这么严：这个项目要打进 NAS 镜像，一个类型错误或明显的 bug 意味着一
次完整的 15 分钟重建。能在本地拦住的就别留到构建。

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

`~` 指向**仓库根**。配置点在 tsconfig 的 `paths`，另外 Vite 的
`resolve.alias` 也要有一份（`packages/web/vite.config.ts`）——两处必须一致，
否则 dev 能解析、构建报找不到模块。tsrs 读 tsconfig，bun 运行时也读它。

**为什么不许 `../`**：一旦允许，目录一挪所有相对路径全断，而编辑器不会
提醒你。用 `~` 和包名，挪目录时只改一处配置。

**为什么不许 import 别包的 `src/`**：那等于绕过包的公开 API，内部重构会
静默破坏调用方。要暴露新东西就在那个包的 `package.json` 里加 export。


## 怎么改

```bash
bun run lint        # 检查
bun run lint:fix    # 自动修复（能修的都会修）
```

提交时 lefthook 会自动跑 fix 再验一遍，修不掉的才阻断提交。
