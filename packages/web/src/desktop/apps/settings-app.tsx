/**
 * 设置应用。
 *
 * Win11 风格的设置界面：左侧导航栏、右侧内容区。内容现在是占位——
 * M1 阶段真正的数据（系统信息、存储）还没接进来，先看骨架。
 *
 * 左侧导航的选中项是本地 state，不放到 reducer 里：这是应用内部状态，
 * 关掉窗口就该重置，没必要提到桌面层。
 */

import { useState } from "react";

interface Section {
  id: string;
  label: string;
  /** 内容区显示的标题 */
  heading: string;
  /** 占位说明 */
  blurb: string;
}

const SECTIONS: Section[] = [
  {
    id: "system",
    label: "系统",
    heading: "系统信息",
    blurb: "主机名、内核版本、运行时间、内存与负载会显示在这里。",
  },
  {
    id: "storage",
    label: "存储",
    heading: "存储",
    blurb: "磁盘列表、btrfs 子卷和使用率会显示在这里。",
  },
  {
    id: "network",
    label: "网络",
    heading: "网络",
    blurb: "接口地址、链路状态和 DNS 配置会显示在这里。",
  },
  {
    id: "about",
    label: "关于",
    heading: "关于 ReiNAS",
    blurb: "版本、构建信息和开源许可会显示在这里。",
  },
];

export function SettingsApp() {
  const [activeId, setActiveId] = useState("system");
  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];

  return (
    <div className="settings">
      <aside className="settings__nav">
        <div className="settings__user">
          <span className="settings__avatar" aria-hidden="true" />
          <span className="settings__username">root</span>
        </div>

        <ul className="settings__list">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                className={`settings__tab${section.id === activeId ? " settings__tab--on" : ""}`}
                onClick={() => setActiveId(section.id)}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="settings__content">
        <h2 className="settings__heading">{active?.heading}</h2>
        <p className="settings__blurb">{active?.blurb}</p>

        <div className="settings__placeholder">
          <span>占位内容</span>
        </div>
      </div>
    </div>
  );
}
