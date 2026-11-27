# API 规范

改接口之前先读这份。违反这里的约定会让用户已有的脚本和集成失效。

## 版本前缀

所有端点都在 `/api/v1/` 下。前缀定义在 `packages/shared/src/constants.ts`：

```ts
export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;
```

**什么时候该加版本（`/api/v2/`）**

- 改了已有端点的语义
- 改了响应体的形状（删字段、改字段类型）
- 改了端点的成功/失败条件

**什么时候不用加**

- 只新增端点
- 只往响应里加字段（客户端不认新字段也没事）
- 修 bug，行为回归文档描述

加 v2 时**不要删 v1**，两个并存一段时间。用户可能写了定时脚本调 v1，突然
404 会让他们以为 NAS 坏了。

## 现有端点

改接口前先看这里，确认自己改的东西有没有破坏已经约定的形状。

### `GET /health`

探活。不需要特权，不读磁盘。

```json
{ "ok": true, "result": { "status": "ok", "version": "0.1.0", "uptime": 120, "bootTime": "..." } }
```

### `GET /system/overview`

系统概览。只读，不需要特权。数据来自 `/proc`，不是外部命令（最小镜像里
可能没有 coreutils）。

```json
{ "ok": true, "result": {
  "hostname": "ReiNAS", "kernel": "7.3.4-300.fc45.aarch64", "arch": "aarch64",
  "uptimeSeconds": 186, "bootTime": "...",
  "memory": { "totalBytes": 4071563264, "availableBytes": 3601653760, "usedBytes": 469909504 },
  "load": { "one": 0, "five": 0, "fifteen": 0 }
} }
```

### `GET /setup/status`

初始化状态。**判据是 `/etc/reinas/setup.json` 是否存在**，不是读某个字段——
初始化一旦完成就不可回退，文件存在本身就是最终事实。前端靠它决定进初始化页
还是桌面。

返回可辨识联合，前端可以用 `ts-pattern` 穷尽匹配：

```json
{ "ok": true, "result": { "state": "uninitialized" } }
{ "ok": true, "result": { "state": "initialized", "completedAt": "...", "version": "0.1.0" } }
```

元数据读不出来（文件损坏、权限不足）时仍报 `initialized`，用空值填
`completedAt`。把已配好的机器判回未初始化、引导用户重来一遍，比读出脏数据
危险得多。

### `POST /setup/user`

初始化第一步：创建主用户。系统出厂只有 root，这一步建出第一个可登录的普通
账号（`useradd -m -G wheel -s /bin/bash`，拿到 sudo）。

```json
// 请求
{ "username": "alice", "password": "至少 8 位" }

// 成功
{ "ok": true, "result": { "username": "alice" } }
```

**不写 setup.json。** 初始化是多步流程，写完第一步就标记完成会让系统在半配置
状态下进桌面。

失败时的错误码：

| code | HTTP | 场景 |
|---|---|---|
| `CFG_INVALID` | 400 | 用户名格式不对、密码太短、缺字段 |
| `USR_RESERVED_NAME` | 400 | 用了系统保留名（`root` / `reinas` / `daemon` 等） |
| `USR_ALREADY_EXISTS` | 400 | 同名用户已存在 |
| `CFG_ALREADY_INITIALIZED` | 409 | 系统已初始化，不能再建 |
| `INTERNAL` | 500 | `useradd` / `chpasswd` 执行失败 |

### `POST /setup/complete`

初始化最后一步：写标记文件，之后前端就切到桌面。

```json
// 请求
{ "username": "alice" }

// 成功
{ "ok": true, "result": { "completedAt": "...", "version": "0.1.0", "username": "alice" } }
```

用临时文件 + `rename` 原子写。直接写时进程被杀会留下损坏文件，而"文件存在"
就是完成判据——损坏文件会被当成已初始化，用户既进不了桌面也重不了初始化。

已初始化时返回 `409` + `CFG_ALREADY_INITIALIZED`。

### 两个 init 写接口的共同约定

**都先查 `setup/status`，已初始化就拒绝。** 这个检查必须在执行前：否则一台
配好的机器上还能凭空造出新的 sudo 账号。前端的分流只是体验层面的事，直接
`curl` 打接口可以完全绕过它，所以防线必须在后端。

## 响应形状

所有端点统一返回：

```ts
// 成功
{ "ok": true, "result": T }

// 失败
{ "ok": false, "error": { "code": string, "message": string } }
```

前端永远拿到这两种形状之一，不会有时裸对象有时错误对象。定义在
`packages/shared/src/types.ts` 的 `ApiResponse<T>`。

**错误码**用字符串不用数字：日志里能一眼看出是什么错，前端也不用维护映射表。
全部错误码在 `packages/shared/src/errors.ts`。

HTTP 状态码由 `packages/server/src/respond.ts` 的 `STATUS_MAP` 决定。新增错误
码时要同步加进去，否则一律返回 500。

## 客户端：用 Eden，不要手写 fetch

前端调 API 一律通过 `packages/web/src/api.ts` 的 `api` 实例，它是 Eden Treaty：

```ts
const health = await unwrap(api.api.v1.health.get());
```

**类型从后端自动推出来。** 改了后端路由，前端编译就会报不匹配，不用维护第二份
类型定义。

文档：<https://elysiajs.com/eden/overview>

### Eden 的两个硬要求

破坏任意一个，前端类型会静默退化成 `any`——编译能过，运行时才发现错。

1. **后端必须用方法链定义路由。**

   ```ts
   // ✅ 正确：链式，类型会累积
   export function createApiRoutes() {
     return new Elysia({ prefix: API_PREFIX })
       .get("/health", ...)
       .get("/system/overview", ...);
   }

   // ❌ 错误：分开调用，typeof app 丢失路由类型
   const app = new Elysia({ prefix: API_PREFIX });
   app.get("/health", ...);
   return app;
   ```

2. **前后端的 elysia 版本必须一致。** 用 `bun pm why elysia` 检查，顶层应当
   只有一个版本。

### 不要给路由函数写返回类型标注

```ts
// ❌ 这样会擦掉路由信息
export function createApiRoutes(): Elysia { ... }

// ✅ 让 TS 推断
export function createApiRoutes() { ... }
```

`ApiApp` 类型（`packages/server/src/routes.ts`）就是靠推断出来的类型工作的。

## 分层

路由函数只做两件事：**调 core、包装响应**。

```ts
.get("/system/overview", async ({ set }) => {
  try {
    return ok(await getOverview());   // core 干活，ok() 包装
  } catch (err) {
    const body = fromError(err);
    set.status = httpStatusFor(body.ok ? "INTERNAL" : body.error.code);
    return body;
  }
})
```

业务判断全在 `packages/core/` 里，这样 CLI 能复用同一套逻辑——`reinas info`
和 `GET /api/v1/system/overview` 走的是同一个 `getOverview()`。

**不要**在路由里写「如果磁盘没挂载就返回 404」这类判断，那是 core 的事。
