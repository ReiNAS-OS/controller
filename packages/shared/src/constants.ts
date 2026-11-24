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

/** API 路由前缀。前端和后端都从这里取，避免两边写死不同路径。 */
export const API_PREFIX = "/api";
