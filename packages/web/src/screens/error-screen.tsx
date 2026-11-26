/**
 * 后端连不上时的错误页。
 *
 * 和「未初始化」是两件不同的事，必须区分：一台已经初始化好的机器连不上
 * 后端时，如果显示成初始化页，用户会以为系统没配好而重走一遍流程。
 *
 * 所以这里明确说「连不上」，并给重试按钮。
 */

interface ErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export function ErrorScreen(props: ErrorScreenProps) {
  return (
    <div className="screen screen--error">
      <div className="screen__badge screen__badge--error">连接失败</div>
      <h1 className="screen__title">无法连接到 ReiNAS 服务</h1>
      <p className="screen__body">
        Web 界面已加载，但拿不到初始化状态。请确认 <code>reinas serve</code> 正在运行。
      </p>
      <pre className="screen__detail">{props.message}</pre>
      <button type="button" className="screen__action" onClick={props.onRetry}>
        重试
      </button>
    </div>
  );
}
