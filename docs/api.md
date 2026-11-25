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
