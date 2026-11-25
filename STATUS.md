# 当前状态

最后更新：2026-11-25

## 做到哪了

**M0 骨架已跑通，M1 未开始。**

已验证的能力：

```
reinas --version              → 0.1.0
reinas info                   → 主机名/内核/架构/内存/负载
reinas serve                  → 监听 5090
  GET /api/health             → ok
  GET /api/system/overview    → 系统信息 JSON
bun run build                 → turbo 编排 5 个包 + 交叉编译二进制
bun run dev                   → 前后端各自热更新（5090 / 5174）
单文件分发                     → 二进制拷到任意目录启动，界面和静态资源都正常
```

产物：交叉编译 `bun-linux-x64` 得到 105 MB ELF 二进制（含前端）。

## 结构上的决定

**`apps/` 下只有 cli，其余全是 packages。** cli 是最终交付物（一个可执行
二进制）；server / web / core / shared 都是库，被 cli 或彼此 import。

**server 是独立包，不是 cli 的子模块。** `reinas serve` 只是调
`@reinas/server` 的 `serve()`。这样 server 能单独测试、单独被别的入口调用。

**turbo 做编排。** 前端产物要先于二进制存在，否则编译出的二进制里没有界面。
`turbo run build` 保证顺序。

## 下一步

M1 的目标是「只读系统信息 + 桌面 shell」，具体：

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

`os` 那边已经为 controller 预留了位置，但**还没有把 controller 打进镜像**：

- 防火墙没开 5090（`os/kiwi/config.sh` 有注释标记）
- 镜像里没有 controller 的 systemd unit
- 镜像里没有 controller 二进制

接的时候要改两处：`os/kiwi/config.sh` 的防火墙段，和 `os/kiwi/reinas.kiwi`
的 `<packages>` 段（用 `<file>` 把二进制和 unit 带进镜像）。

**但二进制还没在 Fedora 上验证过**——只在 macOS 上跑通。要在 QEMU 里测过
才能确认 Linux 上没问题。这是接进镜像之前的门槛。
