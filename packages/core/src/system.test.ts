/**
 * 系统信息采集的单元测试。
 *
 * 只测能确定预期的部分：架构名映射、版本号格式、内存计算的边界。
 * 真实数值（主机名、内核版本）依赖运行环境，不在这里断言。
 */

import { describe, expect, test } from "bun:test";
import { getArch, getHealth, getLoadAverage, getUptimeSeconds } from "./system.ts";

describe("getArch", () => {
  test("返回 uname 风格的架构名", async () => {
    const arch = await getArch();
    // 这套命名要和 `uname -m` 一致。历史上出过返回 "arm64" 而 kernel
    // 字段写 "...aarch64" 的自相矛盾，所以这里钉死是哪种写法。
    expect(["aarch64", "x86_64", "i686"]).toContain(arch);
  });

  test("不返回 Node 风格的 arm64 / x64", async () => {
    const arch = await getArch();
    // 这两个是 process.arch 的原始写法，必须被映射掉
    expect(arch).not.toBe("arm64");
    expect(arch).not.toBe("x64");
  });
});

describe("getUptimeSeconds", () => {
  test("返回非负整数", () => {
    const uptime = getUptimeSeconds();
    expect(Number.isInteger(uptime)).toBe(true);
    expect(uptime).toBeGreaterThanOrEqual(0);
  });
});

describe("getLoadAverage", () => {
  test("三个值都是有限数字", async () => {
    const load = await getLoadAverage();
    for (const value of [load.one, load.five, load.fifteen]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("getHealth", () => {
  test("返回 ok 和版本号", async () => {
    const health = await getHealth();
    expect(health.status).toBe("ok");
    // 版本号来自 shared 常量或构建时注入，不该是空串
    expect(health.version.length).toBeGreaterThan(0);
  });

  test("uptime 是数字", async () => {
    const health = await getHealth();
    expect(typeof health.uptime).toBe("number");
  });
});
