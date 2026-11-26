/**
 * 窗口与桌面的基础类型。
 *
 * 坐标一律是「舞台坐标系」的像素值：原点在 Dock 右侧的内容区左上角，
 * 不含视口滚动。窗口被拖动/缩放时只改这里的数字，渲染层不做换算。
 */

/** 矩形。窗口的位置和尺寸。 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 一个打开的窗口。
 *
 * `appId` 指向应用定义，`id` 是这个窗口实例的唯一标识——同一个应用理论上
 * 可以开多个窗口（现在 Dock 里只有一个应用，但结构按多实例来，免得以
 * 后加窗口就改数据模型）。
 */
export interface WindowState extends Rect {
  /** 窗口实例 id */
  id: string;
  /** 对应的应用 id */
  appId: string;
  /** 标题栏文字 */
  title: string;
  /** 层叠顺序。越大越靠前。 */
  z: number;
  /** 最小化时隐藏，但状态保留 */
  minimized: boolean;
  /** 最大化时铺满舞台，此时忽略 x/y/width/height */
  maximized: boolean;
}
