# 当前状态

最后更新：2026-11-25

## 做到哪了

**M0 骨架已跑通，M1 未开始。**

```
reinas --version              → 0.1.0
reinas info                   → 主机名/内核/架构/内存/负载
reinas serve                  → 监听 5090
  GET /api/health             → ok
  GET /api/system/overview    → 系统信息 JSON
bun run dev                   → 单进程 5090，前端 HMR + 后端热重载
bun run build                 → turbo 编排 5 个包 + 交叉编译二进制
单文件分发                     → 二进制拷到任意目录启动，界面和静态资源都正常
```

产物：`apps/cli/dist/reinas`，交叉编译 `bun-linux-x64` 约 105 MB（含前端）。

## 下一步

M1 的目标是「只读系统信息 + 桌面 shell」：

1. 磁盘列表（`lsblk` 解析）
2. 存储概览（btrfs 子卷 + 使用率）
3. 前端窗口管理器（拖拽、缩放、focus 栈）
4. 把上面三块做成可用的 app

## 待定的事

- **特权模型**。M2 之前必须定。当前倾向：先让 `reinas` 有免密 sudo 跑通功能，
  M4 再决定要不要收敛成独立特权进程。
- **窗口管理器的实现**。自己写基于 pointer events 的，还是用 `react-rnd`。
- **CSS 方案**。现在是手写 CSS + CSS 变量，还没定要不要上 CSS Modules 或
  Tailwind。

## 与 os 仓库的关系

`os` 那边已经预留了位置，但**还没把 controller 打进镜像**：

- 防火墙没开 5090（`os/kiwi/config.sh` 有注释标记）
- 镜像里没有 controller 的 systemd unit
- 镜像里没有 controller 二进制

接的时候改两处：`os/kiwi/config.sh` 的防火墙段，和 `os/kiwi/reinas.kiwi` 的
`<packages>` 段（用 `<file>` 把二进制和 unit 带进镜像）。

**门槛**：二进制只在 macOS 上跑通过，还没在 Fedora 上验证。要在 QEMU 里测
过才能确认 Linux 上没问题。
