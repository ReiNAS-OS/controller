# 当前状态

最后更新：2026-11-27

## 做到哪了

**M0 骨架 + 桌面 UI 外壳 + 初始化流程已完成。M1 的数据层未开始。**

能跑的：

```
reinas --version              → 0.1.0
reinas info                   → 主机名/内核/架构/内存/负载
reinas serve                  → 监听 5090（API + 内嵌前端）
  GET  /api/v1/health             → ok
  GET  /api/v1/system/overview    → 系统信息 JSON
  GET  /api/v1/setup/status       → 未初始化 / 已初始化
  POST /api/v1/setup/user         → 建第一个普通用户（useradd + wheel）
  POST /api/v1/setup/complete     → 写 setup.json，之后前端进桌面
bun run dev                    → Vite 5173 + API 5090
bun run build:linux:arm64      → 交叉编译 aarch64 二进制（~105 MB，含前端）
```

界面：完整桌面外壳。左侧 Dock（macOS 风格）、Win11 风格窗口、拖拽/八向缩放/
双击标题栏最大化、最小化/关闭/focus 栈。窗口内容目前是占位。

初始化：系统未初始化时强制进初始化页，**没有 Dock、没有窗口、没有任何绕过
入口**。创建管理员账号后自动写 `setup.json` 并进桌面。已初始化时访问初始化
接口返回 409。

已验证：拖动、缩放、边界夹取、最大化铺满、最小化恢复、关闭清理、Dock 层级。
在 aarch64 Fedora 虚机里跑通过（`reinas serve` 二进制形态）。

## 下一步

M1 剩下的是「把真实数据接进窗口」：

1. 磁盘列表（`lsblk -J` 解析）→ 存储应用的磁盘页
2. btrfs 子卷与使用率（`btrfs subvolume list` + `df`）→ 存储应用
3. 系统信息接进设置窗口的「系统」页
4. 窗口吸附分屏（可选）

数据层需要的类型、core 采集函数、API 端点都还没写。

## 待定的事

- **特权模型**。M2 之前必须定。当前 `reinas serve` 以 **root** 运行（初始化要
  调 `useradd` / `chpasswd`），M4 再决定要不要收敛成独立特权进程。
- **面板登录态**。现在 API 无鉴权，任何人访问 5090 都能调。初始化完成后写接口
  已封，但读接口和未来的管理接口需要登录后才能用。
- **CSS 方案**。现在是手写 CSS + CSS 变量（约 500 行）。要不要上 CSS Modules
  看下一阶段界面复杂度。
- **窗口管理器是否换库**。调研过 `react-rnd`（2026-03 更新，`bounds` 支持元素
  边界）、`@use-gesture`（2024-03 停更，`bounds` 只限相对位移）、`dockview`
  （功能全但偏 IDE 停靠模型）。结论：维持手搓，需要时再评估。

## 与 os 仓库的关系

**还没把 controller 打进镜像**。已经做掉的部分：

- ✅ 防火墙开了 5090（`os/kiwi/config.sh` 第 8 节）
- ✅ 镜像补了 `fedora-repos` + `fedora-gpg-keys`（dnf 可用）

还缺：

- 镜像里没有 controller 的 systemd unit
- 镜像里没有 controller 二进制

接的时候改 `os/kiwi/reinas.kiwi` 的 `<packages>` 段（用 `<file>` 把二进制和
unit 带进镜像），或者做成 RPM。

**门槛**：二进制已在 aarch64 Fedora 虚机里验证过可运行。
