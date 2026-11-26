/**
 * 文件管理应用。
 *
 * 现在只有窗口骨架，没有真实功能——目录树、文件列表、操作按钮都是占位。
 * 真接数据要等后端提供目录枚举 API。
 *
 * 布局是双栏：左侧目录树、右侧文件列表，加顶部路径栏。这是文件管理器的
 * 通用形态，先把结构立起来，后面往里填数据不用动布局。
 */

/** 左侧目录树。占位数据，不是真实挂载点。 */
const PLACES = [
  { id: "root", label: "根目录", icon: "▸" },
  { id: "home", label: "主目录", icon: "▸" },
  { id: "srv", label: "共享目录", icon: "▸" },
  { id: "var", label: "系统数据", icon: "▸" },
];

/** 右侧列表。占位行，用来观察行高和对齐。 */
const PLACEHOLDER_ROWS = [
  { name: "Documents", kind: "文件夹", size: "—" },
  { name: "Photos", kind: "文件夹", size: "—" },
  { name: "Media", kind: "文件夹", size: "—" },
  { name: "notes.md", kind: "文件", size: "2.1 KB" },
  { name: "backup.tar.zst", kind: "文件", size: "1.4 GB" },
];

export function FilesApp() {
  return (
    <div className="files">
      <aside className="files__sidebar">
        <div className="files__section-title">位置</div>
        <ul className="files__places">
          {PLACES.map((place) => (
            <li key={place.id}>
              <button type="button" className="files__place">
                <span className="files__place-icon" aria-hidden="true">
                  {place.icon}
                </span>
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="files__main">
        {/* 路径栏。真接数据后这里会跟着导航变。 */}
        <div className="files__pathbar">
          <span className="files__crumb">根目录</span>
          <span className="files__crumb-sep">/</span>
          <span className="files__crumb files__crumb--current">未命名</span>
        </div>

        <div className="files__list">
          <div className="files__row files__row--head">
            <span>名称</span>
            <span>类型</span>
            <span className="files__size">大小</span>
          </div>
          {PLACEHOLDER_ROWS.map((row) => (
            <div key={row.name} className="files__row">
              <span className="files__name">{row.name}</span>
              <span className="files__kind">{row.kind}</span>
              <span className="files__size">{row.size}</span>
            </div>
          ))}
        </div>

        <div className="files__hint">占位内容 · 后端 API 接上后显示真实文件</div>
      </div>
    </div>
  );
}
