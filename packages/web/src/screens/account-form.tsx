/**
 * 初始化第一步的表单：创建管理员账号。
 *
 * 单独一个文件是为了让 SetupPage 只管布局和步骤条，表单的校验、提交、
 * 错误显示全在这里。
 *
 * 前端校验只做即时反馈，**真正的判定在后端**：用户名是否保留、是否已
 * 存在、密码策略都以接口返回为准。这里不做重复实现。
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { api, errorCodeOf, errorMessageOf, unwrap } from "~/packages/web/src/api.ts";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "created"; username: string }
  | { kind: "error"; message: string };

interface AccountFormProps {
  /**
   * 创建成功后回调。返回 ok:false 表示后续步骤（写标记）失败，
   * 表单据此显示错误并把按钮恢复可用。
   */
  onCreated: (username: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  /** 外层正在收尾（写标记）时禁用表单，避免重复提交 */
  disabled?: boolean;
  /**
   * 后端说"已经初始化过了"时回调。
   *
   * 这个信号和"创建成功"是两件不同的事：说明别处（另一个标签页、或者
   * 直接 curl）已经完成了初始化。这时不该进"准备就绪"，而是让整个应用
   * 直接切到桌面——系统确实是配好的。所以单独一个回调，不复用 onCreated。
   */
  onAlreadyInitialized: () => void;
}

export function AccountForm(props: AccountFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  const mismatch = confirm !== "" && password !== confirm;
  const canSubmit = canSubmitForm({
    disabled: props.disabled === true,
    values: { username, password, confirm },
    mismatch,
    submitting: submit.kind === "submitting",
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    void createAccount(
      { username, password },
      setSubmit,
      props.onCreated,
      props.onAlreadyInitialized,
    );
  };

  return (
    <form className="setup__form" onSubmit={handleSubmit}>
      <label className="setup__field">
        <span className="setup__field-label">用户名</span>
        <input
          className="setup__input"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="小写字母开头，可用数字、- 和 _"
          autoComplete="username"
          spellCheck={false}
          required
        />
      </label>

      <label className="setup__field">
        <span className="setup__field-label">密码</span>
        <input
          className="setup__input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 8 位"
          autoComplete="new-password"
          required
        />
      </label>

      <label className="setup__field">
        <span className="setup__field-label">确认密码</span>
        <input
          className="setup__input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>

      {mismatch && <p className="setup__field-error">两次输入的密码不一致</p>}
      {submit.kind === "error" && <p className="setup__field-error">{submit.message}</p>}
      {submit.kind === "created" && (
        <p className="setup__field-ok">
          账号 <strong>{submit.username}</strong> 创建成功，已在 wheel 组（可 sudo）。
        </p>
      )}

      <div className="setup__actions">
        <button type="submit" className="setup__btn" disabled={!canSubmit}>
          {submit.kind === "submitting" ? "创建中…" : "创建账号"}
        </button>
      </div>
    </form>
  );
}

/**
 * 提交到后端。失败原因直接用接口返回的 message，不自己编文案。
 *
 * CFG_ALREADY_INITIALIZED 单独处理：说明别处已经完成初始化，这时不该报错，
 * 而是让外层直接进桌面——系统确实是配好的，只是这个页面开得太久了。
 */
async function createAccount(
  input: { username: string; password: string },
  setSubmit: (state: SubmitState) => void,
  onCreated: (username: string) => Promise<{ ok: true } | { ok: false; message: string }>,
  onAlreadyInitialized: () => void,
): Promise<void> {
  setSubmit({ kind: "submitting" });
  try {
    await unwrap(api.api.v1.setup.user.post(input));
    setSubmit({ kind: "created", username: input.username });
    // 账号建好了，交给外层收尾（写标记）。失败时把原因显示出来，
    // 并把按钮恢复可用——虽然重试会撞"已存在"，但至少用户能看见状态。
    const result = await onCreated(input.username);
    if (!result.ok) {
      setSubmit({ kind: "error", message: result.message });
    }
  } catch (err) {
    if (errorCodeOf(err) === "CFG_ALREADY_INITIALIZED") {
      onAlreadyInitialized();
      return;
    }
    setSubmit({
      kind: "error",
      message: errorMessageOf(err),
    });
  }
}

/** 表单能不能提交。抽出来降低组件本身的复杂度。 */
function canSubmitForm(input: {
  disabled: boolean;
  values: { username: string; password: string; confirm: string };
  mismatch: boolean;
  submitting: boolean;
}): boolean {
  if (input.disabled || input.submitting || input.mismatch) {
    return false;
  }
  const { username, password, confirm } = input.values;
  return username !== "" && password !== "" && confirm !== "";
}
