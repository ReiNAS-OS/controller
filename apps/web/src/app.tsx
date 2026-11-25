/**
 * M0 界面：证明前后端能通，并把窗口骨架立起来。
 *
 * 这一版刻意只做一个窗口。窗口管理器（拖拽、缩放、focus 栈）留到 M1，
 * 因为那需要先看清真实数据长什么样再设计。
 */

import { useEffect, useState } from "react";
import { fetchHealth, fetchOverview } from "./api.ts";

export function App() {
  const [health, setHealth] = useState<string>("连接中…");
  const [overview, setOverview] = useState<string>("");

  useEffect(() => {
    fetchHealth()
      .then((h) => setHealth(`ok · v${h.version} · 运行 ${h.uptime}s`))
      .catch((err: unknown) => setHealth(`失败：${String(err)}`));

    fetchOverview()
      .then((o) => setOverview(`${o.hostname} · ${o.kernel} · ${o.arch}`))
      .catch(() => setOverview("（非 Linux 环境，无 /proc）"));
  }, []);

  return (
    <div style={{ padding: 24, display: "grid", gap: 16, maxWidth: 720 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 20 }}>ReiNAS Controller</h1>
        <p className="dim mono" style={{ margin: "4px 0 0", fontSize: 13 }}>
          M0 骨架 · 端口 5090
        </p>
      </header>

      <section className="card">
        <h2 style={{ margin: "0 0 8px", fontSize: 14 }}>后端</h2>
        <p className="mono" style={{ margin: 0, fontSize: 13, color: "var(--accent)" }}>
          {health}
        </p>
      </section>

      <section className="card">
        <h2 style={{ margin: "0 0 8px", fontSize: 14 }}>系统</h2>
        <p className="mono dim" style={{ margin: 0, fontSize: 13 }}>
          {overview || "读取中…"}
        </p>
      </section>
    </div>
  );
}
