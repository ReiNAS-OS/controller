/**
 * 控制器与镜像、前端共用的常量。
 *
 * 改这里的端口要同步改两处：
 *   - os/kiwi/config.sh 的防火墙段（add-port）
 *   - os/kiwi/config.sh 的登录提示（Web panel 地址）
 */

/** HTTP 服务监听端口。Cockpit 用的 9090 已废弃，见 os/docs/decisions-panel.md。 */
export const DEFAULT_PORT = 5090;

/** 版本号。构建时由 bun 的 define 注入，开发时回退到这个值。 */
export const VERSION = "0.1.0";

/**
 * API 版本号。路径里带 v1，是为了以后改接口时能加 /v2/ 并存过渡，
 * 而不是直接破坏已有客户端（包括用户自己写的脚本）。
 *
 * 什么时候该加版本：改了已有端点的**语义**或响应形状。
 * 什么时候不用加：只新增端点、只加字段（向后兼容）。
 */
export const API_VERSION = "v1";

/** API 路由前缀。前端和后端都从这里取，避免两边写死不同路径。 */
export const API_PREFIX = `/api/${API_VERSION}`;

/**
 * 密码最小长度。
 *
 * 后端用它做校验，前端用它渲染输入框提示——放这里是为了让两边只有一个
 * 出处。前端硬编码一个「至少 8 位」的占位符、后端改了校验却没同步，用户
 * 会看到提示说 8 位够、实际提交被拒。
 */
export const MIN_PASSWORD_LENGTH = 8;
