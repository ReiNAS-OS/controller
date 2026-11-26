/**
 * 初始化（首次配置）相关的跨边界类型。
 *
 * 判定权在后端：前端不能自己记「是否初始化过」，换浏览器、无痕模式、
 * 刷新都会丢。后端读 /etc/reinas/setup.json 是否存在，是唯一可信来源。
 */

/**
 * 初始化状态。
 *
 * 用可辨识联合而不是 `{ initialized: boolean }`：界面要根据状态分流到
 * 不同页面，联合类型能让 ts-pattern / switch 做穷尽检查——将来加状态
 * （比如「初始化失败」「需要迁移」）时，忘了处理会编译报错。
 */
export type SetupStatus =
  | { state: "uninitialized" }
  | { state: "initialized"; completedAt: string; version: string };

/**
 * setup.json 的持久化形状。
 *
 * 这是写到磁盘上的内容，和 HTTP 响应的 SetupStatus 刻意分开：
 * 磁盘格式改了不该直接影响 API；只在 core 层做一次转换。
 */
export interface SetupRecord {
  /** 完成时间（ISO 8601） */
  completedAt: string;
  /** 完成时的 controller 版本 */
  version: string;
}
