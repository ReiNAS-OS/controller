# 测试与部署

controller 的产物是 Linux 二进制，但开发机是 macOS。**本地跑通不代表 Fedora
跑通**——最小镜像里可能没有你以为有的命令。

先把「日常开发」和「验证产物」分开，这两件事该在不同的地方做：

## 日常开发：前端在宿主机跑

```bash
cd controller && bun run dev      # 宿主机 5090，HMR 正常
```

**改 `.tsx` 立刻生效，不用重启。** 这是开发 UI 的主力方式。

前端不依赖 Linux——浏览器拿到的就是编译后的 JS，跑在哪个 OS 上没差别。
把前端挪进虚机只会拖慢迭代：9p 传来的文件改动不触发 Bun 的重新编译，
每次都要手动重启 dev server（实测过）。

## 后端改动的验证：进虚机

只有要验证**真 Linux 的命令输出**时才需要虚机：

```bash
cd os && ./scripts/vm.sh dev      # 9p 挂载 controller 仓库，串口可写
```

典型场景：`lsblk` 的 JSON 长什么样、`btrfs subvolume list` 的输出格式、
`/proc` 里某个字段的实际取值。

⚠️ **虚机里跑 dev server 时改前端代码不会自动重载。** Bun 的 dev server
在客户端首次请求模块时编译并缓存，它能感知宿主机通过 9p 写入的变化（日志
里会出现 `Reloaded in 0ms`），但客户端拿到的仍是缓存产物。改完要重启：

```bash
# 虚机里
pkill -f 'bun run dev'; cd /mnt/reinas && bun run dev
```

## 两层验证，从快到慢

### 第一层：容器（默认，5 秒）

```bash
bun run build:linux:arm64      # 或 bun run build:linux:x86_64
bun run test:linux
```

会检查三件事：版本号、`reinas info` 的输出、`serve` 起来后 API 和前端是否响应。

原理：把二进制只读挂进 `fedora:45` 容器。OrbStack 和 Docker Desktop 在
Apple Silicon 上用虚拟化跑目标架构，不是软件模拟，所以几秒出结果。

**容器的平台按二进制的 ELF 头自动选**，x64 和 arm64 产物都能直接测，不用改
脚本：

| 构建命令 | 产物 | 容器平台 |
|---|---|---|
| `bun run build:linux:x86_64` | `ELF x86-64` | `linux/amd64` |
| `bun run build:linux:arm64` | `ELF aarch64` | `linux/arm64` |

把 `--platform` 写死成 `linux/amd64` 时，跑 arm64 二进制会报
`exec /reinas: no such file or directory`——看着像二进制坏了，其实是架构不匹配。

**这一层应该覆盖绝大多数验证。** 改动业务逻辑、加 API、改 CLI 都在这里测。

## 第二层：完整虚拟机（慢，5-15 分钟）

只有需要验证**容器测不出来的东西**时才用：

- systemd unit 能不能起来
- SELinux 上下文对不对
- 首启扩盘（`dracut-kiwi-oem-repart`）
- 和 os 镜像的其它组件共存

```bash
bun run test:vm-prepare     # 秒级，创建 qcow2 分层盘
bun run test:vm-run         # 启动（串口输出到终端）
```

进虚机后从宿主取二进制：

```bash
# 另开终端
bun run test:vm-serve

# 虚机里
curl -o /tmp/reinas http://10.0.2.2:8000/reinas
chmod +x /tmp/reinas
/tmp/reinas serve &
```

```bash
bun run test:vm-check       # 宿主查 API
bun run test:vm-clean
```

### 为什么这么慢

Apple Silicon 上 `qemu-system-x86_64` **只有 tcg**（纯软件模拟），没有 hvf。
启动到登录 5-15 分钟，交互很卡。这是架构限制，不是配置问题。

`qemu-system-aarch64` 有 hvf 但架构不是最终目标。

## 容器测试抓到的真实 bug

第一版 `getOverview()` 调 `uname -srm` 和 `hostname` 命令。macOS 和完整
Fedora 上都有，所以本地一直是绿的。

在 `fedora:45` 最小容器里直接 `ENOENT: Executable not found in $PATH: "hostname"`。

改成优先读内核接口：

```
主机名   /proc/sys/kernel/hostname      读不到才退回 hostname 命令
内核版本 /proc/sys/kernel/osrelease
架构     process.arch（bun 自带）
运行时间 /proc/uptime
```

**这类问题只有最小镜像能暴露。** 完整 Fedora 装了 coreutils，看不出差异。

## 踩过的坑（QEMU）

**1. overlay 大小必须和基础镜像一致。**

GPT 备份分区头在磁盘**末尾**。声明成 64 G 而基础镜像只有 8 G，备份头位置对
不上，UEFI 找不到可引导分区——表现为一直尝试 PXE 网络启动，看着像镜像没装好。

**2. `-drive` 的 `format` 必须匹配真实格式。**

overlay 是 qcow2，写成 `format=raw` 会让 QEMU 把 qcow2 头当分区表读。症状和
上一条完全一样，很难区分。

**3. 自动登录脚本要用电状态机，不要每轮循环重新匹配。**

第一版每轮都检查 `Password:`，同一个提示触发三次密码发送，三次失败直接把账号
锁定（`Login incorrect`），看起来像密码错了。见 `scripts/auto-vm.py` 的状态机。

**4. macOS 上没有 libguestfs。**

`guestfish` / `virt-copy-in` 都装不了，没法直接往镜像里塞文件。用「宿主起
HTTP 服务 + 虚机 curl」绕过。

## 已验证的启动链

```
OVMF (UEFI)
  → BdsDxe 从 virtio 盘引导
    → GRUB 2.12 "ReiNAS (7.3.4-300.fc45.x86_64) 0.1.0"
      → 内核
        → systemd
          → 串口 agetty，显示 4 行 issue
            → login: root / 123456（仅 --root-password 构建）
```

登录已验证。`reinas --version`、`reinas serve`、API 全部正常。

## 后续：接进 os 镜像

虚机里跑通之后：

1. `os/kiwi/config.sh` 防火墙加 `--add-port=5090/tcp`
2. `os/kiwi/reinas.kiwi` 用 `<file>` 把二进制和 systemd unit 带进镜像
3. 重新构建，在真机上验证

参考 `../os/docs/decisions-panel.md` 的 D-009。
