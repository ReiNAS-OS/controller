/**
 * 初始化页面。
 *
 * 这是系统第一次启动时用户唯一能看到的东西——**没有 Dock、没有窗口、
 * 没有任何绕过入口**。初始化没完成之前不该露出桌面。
 *
 * 只有一步：创建管理员账号。系统出厂只有 root，浏览器登录态不能用 root
 * 登录，所以必须先建一个普通用户出来。账号建好后立刻写 setup.json 并
 * 进桌面——没有单独的"完成"按钮，那一步没有意义。
 */

import { useState } from "react";
import { api, errorCodeOf, errorMessageOf, unwrap } from "~/packages/web/src/api.ts";
import { AccountForm } from "./account-form.tsx";

interface SetupPageProps {
  /** 初始化完成后回调，外层据此切到桌面 */
  onFinished: () => void;
}

export function SetupPage(props: SetupPageProps) {
  // 账号已建好、正在写标记的过程中要禁用表单，避免重复提交
  const [finishing, setFinishing] = useState(false);

  return (
    <div className="screen screen--setup">
      <header className="setup__header">
        <span className="setup__mark">ReiNAS</span>
        <span className="setup__stage">初始化</span>
      </header>

      <div className="setup__layout">
        <nav className="setup__steps" aria-label="初始化步骤">
          <ol>
            <li className="setup__step setup__step--current">
              <span className="setup__step-no">{finishing ? "✓" : 1}</span>
              <span className="setup__step-label">管理员账号</span>
            </li>
          </ol>
        </nav>

        <main className="setup__panel">
          <h1 className="setup__title">创建管理员账号</h1>
          <p className="setup__lead">
            系统目前只有 root 账号。创建一个日常使用的管理员账号，它会拥有 sudo 权限。
            创建完成后即可进入桌面。
          </p>

          <AccountForm
            disabled={finishing}
            onCreated={async (username) => {
              setFinishing(true);
              const result = await finishSetup(username, props.onFinished);
              if (!result.ok) {
                setFinishing(false);
              }
              return result;
            }}
            onAlreadyInitialized={props.onFinished}
          />
        </main>
      </div>
    </div>
  );
}

/**
 * 写 setup.json 完成初始化。
 *
 * 失败时返回可读原因交给表单显示——此时用户已经建出来了，再次提交只会
 * 拿到"已存在"。所以错误信息要说清楚"账号已建好、只是标记没写上"，
 * 让用户知道该做什么。
 */
async function finishSetup(
  username: string,
  onFinished: () => void,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await unwrap(api.api.v1.setup.complete.post({ username }));
    onFinished();
    return { ok: true };
  } catch (err) {
    // 409 说明别处已经完成了初始化，直接进桌面
    if (errorCodeOf(err) === "CFG_ALREADY_INITIALIZED") {
      onFinished();
      return { ok: true };
    }
    return {
      ok: false,
      message: `账号已创建，但初始化标记写入失败：${errorMessageOf(err)}`,
    };
  }
}
