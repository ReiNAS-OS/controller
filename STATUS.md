# 当前状态

最后更新：2026-11-24

## 做到哪了

**M0 未开始。** 只有仓库骨架和文档，没有任何代码。

## 下一步

M0 的目标是「跑通」，具体要做：

1. bun workspace + TypeScript 配置
2. 服务端最小 HTTP 服务，一个健康检查端点
3. 前端最小页面，能显示后端返回的状态
4. `bun build --compile` 出二进制，在 Fedora 45 上验证能跑

## 待定的事

这些还没决定，动手前要定：

- **特权模型**。M2 之前必须定。当前倾向：先让 `reinas` 有免密 sudo 跑通功能，
  M4 再决定要不要收敛成独立特权进程。
- **前端窗口管理的实现**。自己写还是用 `react-rnd` 这类现成库。
- **二进制里的 public 目录**。是嵌进二进制（真单文件），还是放在旁边
  （改前端不用重编）。

## 与 os 仓库的关系

`os` 那边已经为 controller 预留了位置，但**还没有把 controller 打进镜像**：

- 防火墙没开 5090（`os/kiwi/config.sh` 里有注释标记）
- 镜像里没有 controller 的 systemd unit
- Cargo 里也没有相关文件

controller 打出第一个能跑的二进制后，才需要把这些接上。接的时候要改两处：
`os/kiwi/config.sh` 的防火墙段，和 `os/kiwi/reinas.kiwi` 的 `<packages>` 段
（用 `<file>` 把二进制和 unit 带进镜像）。

参考 `os/docs/decisions-panel.md` 的 D-009。
