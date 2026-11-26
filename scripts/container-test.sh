#!/usr/bin/env bash
# 在 Fedora 容器里验证 controller 二进制。
#
# 这是**默认的验证方式**。几秒出结果，因为 OrbStack / Docker Desktop 在
# Apple Silicon 上用虚拟化跑目标架构，不是纯软件模拟。
#
# 容器的平台跟着二进制架构自动选，所以 x64 和 arm64 产物都能直接测：
#   bun run build:linux:x86_64   → x86-64 二进制
#   bun run build:linux:arm64    → aarch64 二进制
#
# 对比：QEMU 跑完整镜像要 5-15 分钟（TCG），只在需要验证 systemd、SELinux、
# 首启扩盘这些「容器测不出来」的东西时才用 scripts/vm-test.sh。
#
# 用法：
#   ./scripts/container-test.sh            跑全部检查
#   ./scripts/container-test.sh version    只查版本
#   ./scripts/container-test.sh api        只查 API
#
# 环境变量：
#   IMAGE      容器镜像，默认 fedora:45
#   PORT       宿主机端口，默认 5090
#   PLATFORM   强制容器平台，默认按二进制 ELF 头自动判断

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly BINARY="$REPO_ROOT/apps/cli/dist/reinas"

readonly IMAGE="${IMAGE:-fedora:45}"
readonly PORT="${PORT:-5090}"

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m错误:\033[0m %s\n' "$*" >&2; exit 1; }

[[ -f "$BINARY" ]] || die "找不到 $BINARY。先跑 bun run build。"
command -v docker >/dev/null || die "找不到 docker"

# 容器平台必须跟着二进制的真实架构走。
#
# 硬编码 linux/amd64 时，构建出 aarch64 二进制后在 amd64 容器里会报
# "exec /reinas: no such file or directory" —— 看起来像二进制损坏，实际是
# 架构不匹配。这里直接读 ELF 头判断，测 x64 和 arm64 都不用改脚本。
detect_platform() {
  local desc
  desc=$(file -b "$BINARY")
  case "$desc" in
    *aarch64*) printf 'linux/arm64' ;;
    *x86-64*)  printf 'linux/amd64' ;;
    *)
      # file 认不出来时退回宿主架构，不要瞎猜
      case "$(uname -m)" in
        arm64|aarch64) printf 'linux/arm64' ;;
        *)             printf 'linux/amd64' ;;
      esac
      ;;
  esac
}

readonly PLATFORM="${PLATFORM:-$(detect_platform)}"

# 二进制挂进容器，只读。容器本身用 --rm，跑完即弃。
run_in_container() {
  docker run --rm --platform "$PLATFORM" \
    -v "$BINARY:/reinas:ro" \
    -p "$PORT:5090" \
    "$IMAGE" \
    bash -c "$1"
}

check_version() {
  log "版本检查"
  local out
  out=$(run_in_container '/reinas --version' 2>/dev/null | tail -1)
  [[ "$out" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "版本输出异常: $out"
  log "  版本 $out"
}

check_api() {
  log "API 与服务"
  local out
  out=$(run_in_container '
    /reinas serve > /tmp/srv.log 2>&1 &
    sleep 3
    echo "---API---"
    curl -sf --max-time 5 http://127.0.0.1:5090/api/v1/health || echo "FAIL"
    echo
    echo "---PAGE---"
    curl -sf --max-time 5 http://127.0.0.1:5090/ | head -c 60 || echo "FAIL"
    echo
    echo "---LOG---"
    cat /tmp/srv.log
  ' 2>/dev/null)

  echo "$out" | grep -q '"ok":true' || die "API 没返回 ok"
  echo "$out" | grep -q '<!doctype html>' || die "前端页面没返回"

  log "  API ok"
  log "  前端 ok"
}

check_cli() {
  log "CLI 子命令"
  local info
  info=$(run_in_container '/reinas info' 2>/dev/null)
  echo "$info" | grep -q '内核' || die "info 输出异常"
  log "  info ok"
  log "  $(echo "$info" | head -1)"
}

case "${1:-all}" in
  version) check_version ;;
  api)     check_api ;;
  cli)     check_cli ;;
  all)
    check_version
    check_cli
    check_api
    log "全部通过"
    ;;
  *)
    sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
    exit 1
    ;;
esac
