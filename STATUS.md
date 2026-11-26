# 当前状态

最后更新：2026-11-26

## 做到哪了

**M0 骨架已跑通。桌面 UI 外壳已完成。M1 的数据层未开始。**

能跑的：

```
reinas --version              → 0.1.0
reinas info                   → 主机名/内核/架构/内存/负载
reinas serve                  → 监听 5090
  GET /api/v1/health             → ok
  GET /api/v1/system/overview    → 系统信息 JSON
bun run dev                    → 单进程 5090，前端 HMR
bun run build:linux:arm64      → 交叉编译 aarch64 二进制（~105 MB，含前端）
```

界面：完整桌面外壳。左侧 Dock（macOS 风格）、Win11 风格窗口、拖拽/八向缩放/
最大化/最小化/关闭/focus 栈。窗口内容目前是占位。

已验证：拖动、缩放、边界夹取、最大化铺满、最小化恢复、关闭清理、Dock 层级。
在 aarch64 Fedora 虚机里跑通过（`reinas serve` 二进制形态）。

## 下一步

M1 剩下的是「把真实数据接进窗口」：

1. 磁盘列表（`lsblk -J` 解析）→ 存储应用的磁盘页
2. btrfs 子卷与使用率（`btrfs subvolume list` + `df`）→ 存储应用
3. 系统信息接进设置窗口的「系统」页
4. 窗口吸附分屏（可选）

数据层需要的类型、core 采集函数、API 端点都还没写。API 客户端
（`packages/web/src/api.ts`）目前无人引用，等数据层接回来再用。

## 待定的事

- **特权模型**。M2 之前必须定。当前倾向：先让 `reinas` 有免密 sudo 跑通功能，
  M4 再决定要不要收敛成独立特权进程。
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
