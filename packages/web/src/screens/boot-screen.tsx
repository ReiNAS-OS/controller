/**
 * 启动画面。
 *
 * 状态还没确定时显示它。**不能直接返回 null**：浏览器白屏会被当成页面
 * 挂了，而且用户看不出是在加载还是出错。
 *
 * 刻意做得极简：一个标记 + 一行字。这里停留通常只有几十毫秒，动画多了
 * 反而会在闪现时显得突兀。
 */

export function BootScreen() {
  return (
    <div className="screen screen--boot">
      <div className="screen__mark">ReiNAS</div>
      <div className="screen__pulse" aria-hidden="true" />
      <p className="screen__hint">正在启动…</p>
    </div>
  );
}
