/**
 * 初始化状态判定的单元测试。
 *
 * 这块逻辑判错的后果很严重：
 *   - 把已初始化的机器判成未初始化 → 用户重走一遍，建重复账号
 *   - 把未初始化判成已初始化 → 用户进不了桌面，也没有初始化入口
 *
 * 用 REINAS_SETUP_FILE 指到临时目录来隔离，不碰真实的 /etc/reinas。
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { completeSetup, getSetupStatus } from "./setup.ts";

let dir: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "reinas-setup-test-"));
  originalEnv = process.env["REINAS_SETUP_FILE"];
  process.env["REINAS_SETUP_FILE"] = join(dir, "setup.json");
});

afterEach(async () => {
  if (originalEnv === undefined) {
    delete process.env["REINAS_SETUP_FILE"];
  } else {
    process.env["REINAS_SETUP_FILE"] = originalEnv;
  }
  await rm(dir, { recursive: true, force: true });
});

/** 拿到当前测试用的标记文件路径。 */
function setupPath(): string {
  return join(dir, "setup.json");
}

describe("getSetupStatus", () => {
  test("文件不存在时报未初始化", async () => {
    const status = await getSetupStatus();
    expect(status.state).toBe("uninitialized");
  });

  test("文件存在时报已初始化", async () => {
    await writeFile(
      setupPath(),
      JSON.stringify({ completedAt: "2026-01-01T00:00:00Z", version: "0.1.0", username: "alice" }),
    );
    const status = await getSetupStatus();
    expect(status.state).toBe("initialized");
  });

  test("文件损坏时**仍然**报已初始化", async () => {
    // 这是刻意的设计：文件存在 = 初始化完成过。把配好的机器判回未初始化，
    // 会引导用户重来一遍，比读出脏数据危险得多。
    await writeFile(setupPath(), "{ 这不是合法 JSON");
    const status = await getSetupStatus();
    expect(status.state).toBe("initialized");
  });

  test("文件内容缺字段时仍报已初始化，用默认值补", async () => {
    await writeFile(setupPath(), JSON.stringify({ foo: "bar" }));
    const status = await getSetupStatus();
    expect(status.state).toBe("initialized");
    if (status.state === "initialized") {
      // completedAt 读不出来就是空串，version 退回当前版本
      expect(status.completedAt).toBe("");
      expect(status.version.length).toBeGreaterThan(0);
    }
  });

  test("文件是空文件时仍报已初始化", async () => {
    await writeFile(setupPath(), "");
    const status = await getSetupStatus();
    expect(status.state).toBe("initialized");
  });
});

describe("completeSetup", () => {
  test("写入后状态变为已初始化", async () => {
    await completeSetup("alice");
    const status = await getSetupStatus();
    expect(status.state).toBe("initialized");
  });

  test("记录里带用户名和完成时间", async () => {
    const record = await completeSetup("bob");
    expect(record.username).toBe("bob");
    // ISO 8601，前端可能直接显示
    expect(record.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record.version.length).toBeGreaterThan(0);
  });

  test("重复调用会覆盖而不是报错", async () => {
    // 幂等性：写接口本身有「已初始化就拒绝」的守卫，但底层函数不该假设
    await completeSetup("first");
    const second = await completeSetup("second");
    const status = await getSetupStatus();
    expect(status.state).toBe("initialized");
    if (status.state === "initialized") {
      expect(status.completedAt).toBe(second.completedAt);
    }
  });

  test("不留临时文件", async () => {
    // 原子写用的是 <target>.tmp + rename，失败时可能残留
    await completeSetup("alice");
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(dir);
    expect(files.filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
});
