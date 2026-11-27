/**
 * 用户名和密码校验的单元测试。
 *
 * 这两条规则是初始化的第一道门槛，也是前后端共用的——错了会让用户建出
 * 奇怪的账号，或者被一段看不懂的报错挡住。所以用测试把边界钉死。
 *
 * 只测纯函数。`createUser` 那些要真跑 useradd 的放集成测试（还没建）。
 */

import { describe, expect, test } from "bun:test";
import { MIN_PASSWORD_LENGTH } from "@reinas/shared";
import { validatePassword, validateUsername } from "./users.ts";

describe("validateUsername", () => {
  test("接受常规名字", () => {
    for (const name of ["alice", "bob123", "a", "user-name", "user_name", "a1"]) {
      expect(validateUsername(name).ok).toBe(true);
    }
  });

  test("拒绝大写字母开头", () => {
    // Linux 用户名传统上全小写，大小写混用会让 tab 补全和日志核对变麻烦
    expect(validateUsername("Alice").ok).toBe(false);
  });

  test("拒绝数字或符号开头", () => {
    for (const name of ["1alice", "-alice", "_alice"]) {
      expect(validateUsername(name).ok).toBe(false);
    }
  });

  test("拒绝大写字母", () => {
    expect(validateUsername("aliceB").ok).toBe(false);
  });

  test("拒绝空格和特殊符号", () => {
    for (const name of ["alice bob", "alice@host", "alice.b", "alice/b"]) {
      expect(validateUsername(name).ok).toBe(false);
    }
  });

  test("32 位是上限", () => {
    // useradd 的 NAME_MAX 是 32，超了会失败，提前拦住
    expect(validateUsername("a".repeat(32)).ok).toBe(true);
    expect(validateUsername("a".repeat(33)).ok).toBe(false);
  });

  test("拒绝空字符串", () => {
    expect(validateUsername("").ok).toBe(false);
  });

  test("拒绝系统保留名", () => {
    // 这些名字要么已存在，要么会让系统服务起不来
    for (const name of ["root", "reinas", "daemon", "bin", "nobody", "sshd"]) {
      const result = validateUsername(name);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // 保留名的报错要和格式错误区分开，否则用户不知道该换名字还是换格式
        expect(result.message).toContain("保留");
      }
    }
  });
});

describe("validatePassword", () => {
  test("长度刚好达标就通过", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH)).ok).toBe(true);
  });

  test("少一位就拒绝", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1)).ok).toBe(false);
  });

  test("拒绝空密码", () => {
    expect(validatePassword("").ok).toBe(false);
  });

  test("不限制字符类型", () => {
    // 现在只看长度。以后加了复杂度策略，这条测试会失败——那时候是有意的，
    // 记得同步改这里和 docs/api.md 的错误码表。
    expect(validatePassword("密码密码密码密码").ok).toBe(true);
    expect(validatePassword("        ").ok).toBe(true);
  });

  test("报错信息里带出最小长度", () => {
    const result = validatePassword("short");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(String(MIN_PASSWORD_LENGTH));
    }
  });
});
