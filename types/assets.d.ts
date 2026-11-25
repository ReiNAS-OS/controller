/**
 * 资源和 HTML 入口的类型声明。
 *
 * 两件 Bun 的类型包里没覆盖的事：
 *
 *   .html   Bun 的 HTML import 返回 HTMLBundle，可以直接放进 Bun.serve 的
 *           routes。bun-types 定义了接口但没声明模块，所以自己补。
 *   .css    副作用导入（`import "./style.css"`）。Bun 打包器会处理它并产出
 *           独立的 css 文件；TS 需要一个声明才不报错。
 */

declare module "*.html" {
  const bundle: Bun.HTMLBundle;
  export default bundle;
}

declare module "*.css" {
  const content: string;
  export default content;
}
