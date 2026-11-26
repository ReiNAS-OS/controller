/**
 * 初始化页面（占位）。
 *
 * 这是系统第一次启动时用户唯一能看到的东西——**没有 Dock、没有窗口、
 * 没有任何绕过入口**。初始化没完成之前不该露出桌面。
 *
 * 现在只有流程骨架和占位步骤，真正的配置项（主机名、存储池、账号）等
 * 后端开始支持后再往里填。
 */

const STEPS = [
  { id: "welcome", label: "欢迎", done: true },
  { id: "account", label: "管理员账号", done: false },
  { id: "storage", label: "存储", done: false },
  { id: "network", label: "网络", done: false },
  { id: "finish", label: "完成", done: false },
];

export function SetupPage() {
  return (
    <div className="screen screen--setup">
      <header className="setup__header">
        <span className="setup__mark">ReiNAS</span>
        <span className="setup__stage">初始化</span>
      </header>

      <div className="setup__layout">
        <nav className="setup__steps" aria-label="初始化步骤">
          <ol>
            {STEPS.map((step, index) => (
              <li
                key={step.id}
                className={`setup__step${step.done ? " setup__step--done" : ""}${
                  index === 1 ? " setup__step--current" : ""
                }`}
              >
                <span className="setup__step-no">{step.done ? "✓" : index + 1}</span>
                <span className="setup__step-label">{step.label}</span>
              </li>
            ))}
          </ol>
        </nav>

        <main className="setup__panel">
          <h1 className="setup__title">欢迎使用 ReiNAS</h1>
          <p className="setup__lead">系统尚未初始化。完成下面的配置后即可进入桌面。</p>

          <div className="setup__placeholder">
            <span className="setup__placeholder-title">配置表单占位</span>
            <span className="setup__placeholder-note">
              管理员账号、存储池、网络等步骤会在后端支持后接入这里。
            </span>
          </div>

          <footer className="setup__actions">
            <button type="button" className="setup__btn setup__btn--ghost" disabled>
              上一步
            </button>
            <button type="button" className="setup__btn" disabled>
              下一步
            </button>
          </footer>

          <p className="setup__warn">
            按钮暂不可用：初始化流程尚未实现，完成配置后需要写入
            <code>/etc/reinas/setup.json</code> 才会进入桌面。
          </p>
        </main>
      </div>
    </div>
  );
}
