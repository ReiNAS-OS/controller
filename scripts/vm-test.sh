#!/usr/bin/env bash
# 在 QEMU 里验证 controller 二进制。
#
# 用途：确认交叉编译出的二进制能在真实 Fedora 上跑起来、API 能响应。
# 这是接进 os 镜像之前的门槛——本地 macOS 跑通不代表 Linux 也跑通。
#
# ⚠️ 这台 Apple Silicon 上 qemu-system-x86_64 只有 tcg（纯软件模拟），启动到
#    登录约 5-15 分钟。这是架构限制，不是配置问题。
#
# 用法：
#   ./scripts/vm-test.sh prepare [镜像路径]   准备测试环境
#   ./scripts/vm-test.sh run                  启动虚拟机（串口输出到终端）
#   ./scripts/vm-test.sh serve                起 HTTP 服务供虚机取二进制
#   ./scripts/vm-test.sh check                查 API 是否响应
#   ./scripts/vm-test.sh clean                清掉测试环境
#
# 环境变量：
#   BASE_IMAGE  Fedora 的 raw 镜像路径。默认找 ../os/.vm/*.raw
#   VM_MEM      内存，默认 4096
#   VM_CPUS     CPU 数，默认 4
#   SSH_PORT    宿主机转发到虚机 22 的端口，默认 5099

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly VM_DIR="$REPO_ROOT/.qemu"
readonly DISK="$VM_DIR/test.raw"
readonly BINARY="$REPO_ROOT/apps/cli/dist/reinas"

readonly VM_MEM="${VM_MEM:-4096}"
readonly VM_CPUS="${VM_CPUS:-4}"
readonly SSH_PORT="${SSH_PORT:-5099}"

readonly OVMF_CODE="${OVMF_CODE:-/opt/homebrew/share/qemu/edk2-x86_64-code.fd}"
readonly OVMF_VARS_SRC="${OVMF_VARS_SRC:-/opt/homebrew/share/qemu/edk2-i386-vars.fd}"

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m错误:\033[0m %s\n' "$*" >&2; exit 1; }

# 找基础镜像。优先用 os 仓库构建出的产物。
find_base_image() {
  if [[ -n "${BASE_IMAGE:-}" ]]; then
    printf '%s' "$BASE_IMAGE"
    return
  fi
  # 排除临时解压目录（sqfs_x 之类）和测试环境自身
  local found
  found=$(find "$REPO_ROOT/.." -maxdepth 3 \( -name "ReiNAS*.raw" -o -name "*.qcow2" \) \
    -not -path "*/.qemu/*" -not -path "*/sqfs_x/*" 2>/dev/null | head -1)
  [[ -n "$found" ]] || die "找不到基础镜像。设 BASE_IMAGE 指向一个 Fedora raw 镜像。"
  printf '%s' "$found"
}

# 把二进制和 systemd unit 塞进镜像。
#
# 做法：用 qemu-nbd 挂载镜像的分区，直接拷文件。macOS 上没有 qemu-nbd 的
# 内核模块，所以走「构造一个 ext4 数据盘 + 首启脚本」这条路更稳。
prepare() {
  local base
  base=$(find_base_image)
  log "基础镜像: $base"

  [[ -f "$BINARY" ]] || die "找不到二进制 $BINARY。先跑 bun run build。"

  mkdir -p "$VM_DIR"

  # 用 qcow2 分层盘，backing file 指向基础镜像。
  #
  # 为什么不直接 cp：基础镜像是 8G，拷贝要几分钟，而且每次跑测试都占 8G。
  # qcow2 overlay 只记录差异，创建是秒级的。基础镜像保持只读，测试可重复。
  if [[ ! -f "$DISK" ]]; then
    log "创建 qcow2 分层盘（backing: $base）"
    # 必须和基础镜像同样大小。GPT 的备份分区头在磁盘末尾，尺寸不同会
    # 导致 UEFI 找不到可引导分区（表现为一直 PXE 重试）。
    local base_size
    base_size=$(qemu-img info --output=json "$base" | python3 -c 'import json,sys;print(json.load(sys.stdin)["virtual-size"])')
    qemu-img create -f qcow2 -F raw -b "$base" "$DISK" "$base_size" >/dev/null
  else
    log "复用已有测试镜像"
  fi

  # OVMF 变量盘要给每台虚机一份独立的
  if [[ ! -f "$VM_DIR/OVMF_VARS.fd" ]]; then
    [[ -f "$OVMF_VARS_SRC" ]] || die "找不到 OVMF vars 模板: $OVMF_VARS_SRC"
    cp "$OVMF_VARS_SRC" "$VM_DIR/OVMF_VARS.fd"
  fi

  cat > "$VM_DIR/README.txt" <<EOF
测试环境已准备。

下一步：./scripts/vm-test.sh run
启动后登录（如果镜像有 root 密码，用构建时的 --root-password 设置的那个）。

controller 二进制位置：$BINARY
要手动传进虚机，可以在虚机里执行：
  curl -O http://10.0.2.2:8000/reinas   （宿主机先跑 python3 -m http.server）
EOF

  log "环境就绪: $VM_DIR"
}

run() {
  [[ -f "$DISK" ]] || die "测试镜像不存在。先跑 prepare。"

  command -v qemu-system-x86_64 >/dev/null || die "找不到 qemu-system-x86_64"

  log "启动虚拟机（tcg 纯模拟，到登录提示约 5-15 分钟）"
  log "串口输出直接打在这个终端。退出：Ctrl-A 然后 X"

  exec qemu-system-x86_64 \
    -machine q35,smm=on \
    -accel tcg,thread=multi \
    -cpu max \
    -smp "$VM_CPUS" \
    -m "$VM_MEM" \
    -drive if=pflash,format=raw,readonly=on,file="$OVMF_CODE" \
    -drive if=pflash,format=raw,file="$VM_DIR/OVMF_VARS.fd" \
    -drive file="$DISK",format=qcow2,if=virtio \
    -netdev "user,id=n0,hostfwd=tcp::${SSH_PORT}-:22,hostfwd=tcp::5090-:5090" \
    -device virtio-net-pci,netdev=n0 \
    -nographic
}

# 检查虚机里的 API。需要虚机已启动且 controller 在跑。
# 在宿主机起一个临时 HTTP 服务，虚机通过 10.0.2.2 访问（QEMU user 网络的网关）。
# 这样不用往镜像里塞文件，也能测任意构建产物。
serve() {
  [[ -f "$BINARY" ]] || die "找不到二进制 $BINARY。先跑 bun run build。"

  local dir="$VM_DIR/serve"
  mkdir -p "$dir"
  cp "$BINARY" "$dir/reinas"
  chmod +x "$dir/reinas"

  log "HTTP 服务: http://0.0.0.0:8000/reinas"
  log "虚机里执行："
  log "  curl -o /tmp/reinas http://10.0.2.2:8000/reinas && chmod +x /tmp/reinas"
  log "  /tmp/reinas serve &"
  log "然后宿主跑：./scripts/vm-test.sh check"
  log "退出：Ctrl-C"

  cd "$dir" || die "进不去 $dir"
  exec python3 -m http.server 8000
}

check() {
  local url="http://127.0.0.1:5090/api/v1/health"
  log "查询 $url"

  if ! curl -sf --max-time 5 "$url" >/dev/null 2>&1; then
    die "连不上。确认虚机已启动，且 controller 在虚机里跑着（reinas serve）。"
  fi

  curl -s --max-time 5 "$url" | python3 -m json.tool
  log "API 正常"
}

clean() {
  log "清理 $VM_DIR"
  rm -rf "$VM_DIR"
}

case "${1:-}" in
  prepare) shift; [[ $# -gt 0 ]] && export BASE_IMAGE="$1"; prepare ;;
  run)     run ;;
  serve)   serve ;;
  check)   check ;;
  clean)   clean ;;
  *)
    sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
    exit 1
    ;;
esac
