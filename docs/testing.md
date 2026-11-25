# 测试与部署到虚拟机

controller 的产物是 Linux 二进制，但开发机是 macOS。**本地跑通不代表 Fedora
上跑通**——SELinux、glibc 版本、文件系统上下文都可能出问题。

所以接进 os 镜像之前，要在 QEMU 里过一遍。

## 快速流程

```bash
# 1. 构建 Linux 二进制（默认目标就是 linux-x64）
bun run build

# 2. 准备测试环境（秒级，用 qcow2 overlay 不复制 8G 镜像）
./scripts/vm-test.sh prepare

# 3. 起一个 HTTP 服务给虚机取二进制
./scripts/vm-test.sh serve

# 4. 另开一个终端启动虚机
./scripts/vm-test.sh run
```

在虚机里（通过串口登录后）：

```bash
curl -o /tmp/reinas http://10.0.2.2:8000/reinas
chmod +x /tmp/reinas
/tmp/reinas serve &
```

回到宿主机验证：

```bash
./scripts/vm-test.sh check      # 查 /api/v1/health
```

## 为什么用 qcow2 overlay

基础镜像是 8 GB raw。直接 `cp` 要几分钟且每次占 8 G。qcow2 分层盘把基础镜像
当只读 backing file，自身只记录差异，创建是秒级的，占几百 KB。

```bash
qemu-img create -f qcow2 -F raw -b BASE.raw test.raw  # 大小必须和 BASE 一致
```

## 踩过的坑

**1. overlay 大小必须和基础镜像一致。**

GPT 的备份分区头在磁盘**末尾**。声明成 64 G 而基础镜像只有 8 G，备份头位置
就对不上，UEFI 找不到可引导分区——表现为一直尝试 PXE 网络启动，看起来像是
「镜像没装好」。

脚本里用 `qemu-img info` 读基础镜像的实际大小，不要写死。

**2. `-drive` 的 `format` 必须匹配真实格式。**

overlay 是 qcow2，写成 `format=raw` 会让 QEMU 把 qcow2 的头当分区表读，同样
表现为找不到可引导分区。这个错误和上一条症状一模一样，很难区分。

**3. macOS 上没有 libguestfs。**

`guestfish` / `virt-copy-in` 都装不了，所以没法直接往镜像里塞文件。用
「宿主起 HTTP 服务 + 虚机 curl」绕过。

**4. x86_64 在这台机器上只有 TCG。**

Apple Silicon 上 `qemu-system-x86_64` 没有 hvf，纯软件模拟。启动到登录提示
**5-15 分钟**。`qemu-system-aarch64` 有 hvf 但架构不是最终目标。

迭代时能不改镜像就不改，每次改二进制只需重启虚机里的进程。

## 已验证的启动链

```
OVMF (UEFI)
  → BdsDxe 从 virtio 盘引导
    → GRUB 2.12 菜单 "ReiNAS (7.3.4-300.fc45.x86_64) 0.1.0"
      → 内核
        → systemd
          → 串口 agetty，显示 4 行 issue
            → login:
```

## 已知问题

- 镜像里 `systemd-repart.service` 报 `[FAILED]`。这是历史遗留配置，已从
  `os/kiwi/config.sh` 删除，但**测试用的这个镜像是在删除之前构建的**，所以
  仍会看到。重新构建后应当消失。

## 后续

虚机里跑通之后的下一步是把 controller 接进 os 镜像：

1. `os/kiwi/config.sh` 防火墙加 `--add-port=5090/tcp`
2. `os/kiwi/reinas.kiwi` 用 `<file>` 把二进制和 systemd unit 带进镜像
3. 重新构建，在真机上验证

参考 `../os/docs/decisions-panel.md` 的 D-009。
