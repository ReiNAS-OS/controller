/**
 * 初始化页面。
 *
 * 这是系统第一次启动时用户唯一能看到的东西——**没有 Dock、没有窗口、
 * 没有任何绕过入口**。初始化没完成之前不该露出桌面。
 *
 * 两步，现在都在同一页完成：
 *   1. 创建管理员账号（AccountForm）
 *   2. 写 setup.json 标记完成（完成按钮）
 *
 * 分成两步而不是创建账号就自动完成，是因为初始化后面还要加存储、网络
 * 配置。现在把"完成"单独做成一个动作，加步骤时不用改结构。
 */

import { useState } from "react";
import { api, errorCodeOf, errorMessageOf, unwrap } from "~/packages/web/src/api.ts";
import { AccountForm } from "./account-form.tsx";

const STEPS = [
  { id: "account", label: "管理员账号" },
  { id: "finish", label: "完成" },
];

/** 完成动作的状态。 */
type FinishState = { kind: "idle" } | { kind: "working" } | { kind: "error"; message: string };

interface SetupPageProps {
  /** 初始化完成后回调，外层据此切到桌面 */
  onFinished: () => void;
}

export function SetupPage(props: SetupPageProps) {
  const [username, setUsername] = useState<string | null>(null);
  const [finish, setFinish] = useState<FinishState>({ kind: "idle" });

  const handleFinish = () => {
    if (!username) {
      return;
    }
    void finishSetup(username, setFinish, props.onFinished);
  };

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
              <li key={step.id} className={`setup__step${stepClass(index, username !== null)}`}>
                <span className="setup__step-no">{index === 0 && username ? "✓" : index + 1}</span>
                <span className="setup__step-label">{step.label}</span>
              </li>
            ))}
          </ol>
        </nav>

        <main className="setup__panel">
          {username === null ? (
            <>
              <h1 className="setup__title">创建管理员账号</h1>
              <p className="setup__lead">
                系统目前只有 root 账号。创建一个日常使用的管理员账号，它会拥有 sudo 权限。
              </p>
              <AccountForm onCreated={setUsername} onAlreadyInitialized={props.onFinished} />
              <p className="setup__warn">
                存储和网络的配置会在后续版本接入。创建账号后点下一步即可进入桌面。
              </p>
            </>
          ) : (
            <>
              <h1 className="setup__title">准备就绪</h1>
              <p className="setup__lead">
                管理员账号 <strong>{username}</strong> 已创建。点下面的按钮完成初始化并进入桌面。
              </p>
              {finish.kind === "error" && <p className="setup__field-error">{finish.message}</p>}
              <div className="setup__actions">
                <button
                  type="button"
                  className="setup__btn"
                  onClick={handleFinish}
                  disabled={finish.kind === "working"}
                >
                  {finish.kind === "working" ? "正在完成…" : "完成初始化"}
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/** 步骤条的状态类名。第一步完成后第一步打勾、第二步高亮。 */
function stepClass(index: number, accountCreated: boolean): string {
  if (index === 0) {
    return accountCreated ? " setup__step--done" : " setup__step--current";
  }
  return accountCreated ? " setup__step--current" : "";
}

/**
 * 写 setup.json。成功后才让外层切桌面。
 *
 * 专门处理 CFG_ALREADY_INITIALIZED：说明**别处已经完成了初始化**（另一个
 * 标签页、或者直接 curl 过），这时不该把错误甩给用户，直接进桌面才对
 * ——因为系统确实是配好的。
 */
async function finishSetup(
  username: string,
  setFinish: (state: FinishState) => void,
  onFinished: () => void,
): Promise<void> {
  setFinish({ kind: "working" });
  try {
    await unwrap(api.api.v1.setup.complete.post({ username }));
    onFinished();
  } catch (err) {
    if (errorCodeOf(err) === "CFG_ALREADY_INITIALIZED") {
      onFinished();
      return;
    }
    setFinish({
      kind: "error",
      message: errorMessageOf(err),
    });
  }
}
