#!/usr/bin/env python3
"""
自动登录 QEMU 里的 ReiNAS 并执行命令。

存在的理由：x86_64 在这台 Apple Silicon 上只能 TCG 纯模拟，启动 5-15 分钟，
手动盯着不现实。这个脚本读串口、在合适的时机发送登录和命令。

⚠️ 一个踩过的坑：不要每轮循环都检查 "Password:"，否则同一个提示会触发
   多次密码发送，三次错误直接把账号锁住。这里用状态机，每个状态只执行一次。
"""

import os
import select
import subprocess
import sys
import time

VM_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".qemu")
DISK = os.path.join(VM_DIR, "test.raw")
VARS = os.path.join(VM_DIR, "OVMF_VARS.fd")
OVMF = "/opt/homebrew/share/qemu/edk2-x86_64-code.fd"

USER = os.environ.get("VM_USER", "root")
PASSWORD = os.environ.get("VM_PASS", "123456")
# 登录成功后要执行的命令。用 ; 分隔。
COMMANDS = os.environ.get("VM_CMD", "id; uname -r; echo ===DONE===")
TIMEOUT = int(os.environ.get("VM_TIMEOUT", "1200"))
# 看到这个字符串就认为命令跑完了
SENTINEL = "===DONE==="


def main() -> int:
    cmd = [
        "qemu-system-x86_64",
        "-machine", "q35,smm=on",
        "-accel", "tcg,thread=multi",
        "-cpu", "max",
        "-smp", "4",
        "-m", "4096",
        "-drive", f"if=pflash,format=raw,readonly=on,file={OVMF}",
        "-drive", f"if=pflash,format=raw,file={VARS}",
        "-drive", f"file={DISK},format=qcow2,if=virtio",
        "-netdev", "user,id=n0,hostfwd=tcp::5090-:5090",
        "-device", "virtio-net-pci,netdev=n0",
        "-serial", "stdio",
        "-display", "none",
    ]

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    assert proc.stdout is not None and proc.stdin is not None
    os.set_blocking(proc.stdout.fileno(), False)

    # 状态机。每个状态只跳一次，避免重复发送。
    #   wait_login → wait_password → wait_shell → done
    state = "wait_login"
    buf = b""
    sent_cmds = False
    deadline = time.time() + TIMEOUT

    try:
        while time.time() < deadline:
            readable, _, _ = select.select([proc.stdout], [], [], 1)
            if readable:
                try:
                    chunk = proc.stdout.read(8192)
                    if chunk:
                        buf += chunk
                        sys.stdout.buffer.write(chunk)
                        sys.stdout.flush()
                except Exception:
                    pass

            tail = buf[-4000:].lower()

            if state == "wait_login" and b"login:" in tail:
                time.sleep(1)
                proc.stdin.write(f"{USER}\n".encode())
                proc.stdin.flush()
                state = "wait_password"
                buf = b""
            elif state == "wait_password" and b"password:" in tail:
                time.sleep(1)
                proc.stdin.write(f"{PASSWORD}\n".encode())
                proc.stdin.flush()
                state = "wait_shell"
                buf = b""
            elif state == "wait_shell":
                # 登录失败会回到 login:，这时直接报错退出
                if b"login incorrect" in tail or b"login:" in tail[-200:]:
                    print("\n[auto-vm] 登录失败：账号或密码不对", file=sys.stderr)
                    return 2
                # 看到 shell 提示符（# 或 $ 结尾的行）
                if not sent_cmds and (b"#" in tail[-50:] or b"$" in tail[-50:]):
                    time.sleep(2)
                    proc.stdin.write(f"{COMMANDS}\n".encode())
                    proc.stdin.flush()
                    sent_cmds = True
                    state = "done"
                    buf = b""
            elif state == "done" and SENTINEL.encode() in buf:
                # 再等一秒把剩余输出收干净
                time.sleep(1)
                return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()

    print(f"\n[auto-vm] 超时（{TIMEOUT}s），最后状态 {state}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
