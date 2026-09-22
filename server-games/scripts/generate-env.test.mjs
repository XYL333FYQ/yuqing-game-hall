// generate-env.mjs 的测试。核心是「配置有问题时必须失败，并且说清是哪一项」。
//
// 校验逻辑是纯函数，绝大多数用例直接在进程内调用，不起子进程；
// 另有一条用例以子进程运行 CLI，确认落盘、权限与「日志里不出现值」这些契约。
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ENV_KEYS, SECRET_KEYS, VARIABLE_KEYS, buildEnvFile } from "./generate-env.mjs";

const generator = fileURLToPath(new URL("./generate-env.mjs", import.meta.url));

// 一组已知良好的配置，供各用例按需覆盖
const validEnv = {
  ALLOWED_ORIGINS: "https://games.example.com",
  TURN_PUBLIC_HOST: "rtc.example.com",
  TURN_EXTERNAL_IP: "203.0.113.10",
  TURN_REALM: "rtc.example.com",
  TURN_PORT: "3478",
  TURN_MIN_PORT: "49160",
  TURN_MAX_PORT: "49200",
  TURN_CREDENTIAL_TTL_SECONDS: "3600",
  TURN_SHARED_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef",
};

const withOverrides = (overrides) => ({ ...validEnv, ...overrides });

function expectReject(overrides, expectedFragment) {
  const result = buildEnvFile(withOverrides(overrides));
  assert.equal(result.ok, false, `期望被拒绝，实际通过了：${JSON.stringify(overrides)}`);
  if (expectedFragment) {
    assert.ok(
      result.message.includes(expectedFragment),
      `错误信息里没有「${expectedFragment}」：${result.message}`,
    );
  }
  return result;
}

describe("配置齐全时生成 .env", () => {
  it("包含全部键，顺序与声明一致", () => {
    const result = buildEnvFile(validEnv, { timestamp: "2026-09-21T00:00:00Z", revision: "abc123" });
    assert.equal(result.ok, true, result.message);
    const keys = [...result.content.matchAll(/^([A-Z_]+)=/gm)].map((match) => match[1]);
    assert.deepEqual(keys, [...ENV_KEYS]);
    assert.deepEqual([...ENV_KEYS], [...VARIABLE_KEYS, ...SECRET_KEYS]);
  });

  it("值原样写入，不带引号也不加转义", () => {
    const result = buildEnvFile(validEnv);
    assert.equal(result.ok, true, result.message);
    assert.ok(result.content.includes("ALLOWED_ORIGINS=https://games.example.com\n"));
    assert.ok(result.content.includes(`TURN_SHARED_SECRET=${validEnv.TURN_SHARED_SECRET}\n`));
  });

  it("带有“自动生成、不要手改”的说明与来源信息", () => {
    const result = buildEnvFile(validEnv, { timestamp: "2026-09-21T00:00:00Z", revision: "deadbeef" });
    assert.ok(result.content.includes("由 GitHub Actions 自动生成"));
    assert.ok(result.content.includes("2026-09-21T00:00:00Z"));
    assert.ok(result.content.includes("deadbeef"));
  });

  it("文件以换行结尾，符合 env_file 的逐行解析", () => {
    const result = buildEnvFile(validEnv);
    assert.ok(result.content.endsWith("\n"));
  });
});

describe("缺配置时必须报出缺哪一项", () => {
  it("缺 Variables 时列出名称并指向 Variables", () => {
    const result = buildEnvFile({ TURN_SHARED_SECRET: validEnv.TURN_SHARED_SECRET });
    assert.equal(result.ok, false);
    assert.ok(result.message.includes("ALLOWED_ORIGINS"));
    assert.ok(result.message.includes("TURN_EXTERNAL_IP"));
    assert.ok(result.message.includes("Variables 添加"));
  });

  it("缺 Secret 时列出名称并指向 Secrets", () => {
    const withoutSecret = { ...validEnv };
    delete withoutSecret.TURN_SHARED_SECRET;
    const result = buildEnvFile(withoutSecret);
    assert.equal(result.ok, false);
    assert.ok(result.message.includes("TURN_SHARED_SECRET"));
    assert.ok(result.message.includes("Secrets 添加"));
  });

  it("一次报出全部缺项，避免改一个跑一次", () => {
    const result = buildEnvFile({});
    assert.equal(result.ok, false);
    for (const key of ENV_KEYS) assert.ok(result.message.includes(key), `没报出 ${key}`);
  });

  it("把空字符串当作缺失，而不是当成合法值", () => {
    const result = buildEnvFile(withOverrides({ TURN_PUBLIC_HOST: "" }));
    assert.equal(result.ok, false);
    assert.ok(result.message.includes("TURN_PUBLIC_HOST"));
  });
});

describe("危险字符必须被拒绝，而不是尝试转义", () => {
  // 这些值一旦写进 .env，不同版本的 compose / shell 会给出不同解释
  const dangerous = [
    ["分号注入", "rtc.example.com;rm -rf /"],
    ["行尾注释", "rtc.example.com #comment"],
    ["变量展开", "$HOME"],
    ["双引号", 'rtc"example.com'],
    ["单引号", "rtc'example.com"],
    ["反斜杠", "rtc\\example.com"],
    ["命令替换（反引号）", "rtc`whoami`.com"],
    ["换行符", "rtc.example.com\nevil=1"],
    ["回车符", "rtc.example.com\revil=1"],
    ["制表符", "rtc\texample.com"],
    ["前导空格", " rtc.example.com"],
    ["全角字符", "rtc。example.com"],
    ["emoji", "rtc.example.com🎮"],
  ];
  for (const [label, value] of dangerous) {
    it(`拒绝${label}`, () => {
      expectReject({ TURN_REALM: value }, "TURN_REALM");
    });
  }

  it("拒绝密钥里的命令替换", () => {
    expectReject({ TURN_SHARED_SECRET: `${validEnv.TURN_SHARED_SECRET}$(id)` }, "TURN_SHARED_SECRET");
  });

  it("拒绝 Origin 列表里的空格", () => {
    expectReject({ ALLOWED_ORIGINS: "https://a.example.com, https://b.example.com" }, "ALLOWED_ORIGINS");
  });
});

describe("格式与范围校验", () => {
  it("拒绝非 http(s) 的 ALLOWED_ORIGINS", () => {
    expectReject({ ALLOWED_ORIGINS: "ftp://games.example.com" }, "ALLOWED_ORIGINS");
  });

  it("接受多个逗号分隔的 Origin", () => {
    const result = buildEnvFile(withOverrides({ ALLOWED_ORIGINS: "https://a.example.com,https://b.example.com" }));
    assert.equal(result.ok, true, result.message);
  });

  it("接受带端口的 Origin", () => {
    const result = buildEnvFile(withOverrides({ ALLOWED_ORIGINS: "http://127.0.0.1:5173" }));
    assert.equal(result.ok, true, result.message);
  });

  it("拒绝非 IPv4 的 TURN_EXTERNAL_IP", () => {
    expectReject({ TURN_EXTERNAL_IP: "turn.example.com" }, "TURN_EXTERNAL_IP");
  });

  it("拒绝带端口的 TURN_EXTERNAL_IP", () => {
    expectReject({ TURN_EXTERNAL_IP: "203.0.113.10:3478" }, "TURN_EXTERNAL_IP");
  });

  it("拒绝非数字的 TURN_PORT", () => {
    expectReject({ TURN_PORT: "3478/tcp" }, "TURN_PORT");
  });

  it("拒绝越界的 TURN_CREDENTIAL_TTL_SECONDS", () => {
    expectReject({ TURN_CREDENTIAL_TTL_SECONDS: "999999" }, "TURN_CREDENTIAL_TTL_SECONDS");
    expectReject({ TURN_CREDENTIAL_TTL_SECONDS: "60" }, "TURN_CREDENTIAL_TTL_SECONDS");
  });

  it("拒绝过短的 TURN_SHARED_SECRET", () => {
    expectReject({ TURN_SHARED_SECRET: "short" }, "TURN_SHARED_SECRET");
  });

  it("接受 base64 风格的密钥", () => {
    const result = buildEnvFile(withOverrides({ TURN_SHARED_SECRET: "AbC+/=_-0123456789abcdefghijklmnop" }));
    assert.equal(result.ok, true, result.message);
  });

  it("拒绝 TURN_MIN_PORT > TURN_MAX_PORT", () => {
    expectReject({ TURN_MIN_PORT: "49200", TURN_MAX_PORT: "49160" }, "不能大于");
  });

  it("拒绝落在中继端口段内的 TURN_PORT", () => {
    expectReject({ TURN_PORT: "49170" }, "会和 coturn 的中继端口冲突");
  });

  it("接受端口段边界之外的 TURN_PORT", () => {
    const result = buildEnvFile(withOverrides({ TURN_PORT: "3478", TURN_MIN_PORT: "49160" }));
    assert.equal(result.ok, true, result.message);
  });

  it("接受以 IPv4 作为 TURN_REALM", () => {
    const result = buildEnvFile(withOverrides({ TURN_REALM: "203.0.113.10" }));
    assert.equal(result.ok, true, result.message);
  });
});

describe("CLI 契约", () => {
  const workdir = mkdtempSync(join(tmpdir(), "yuqing-generate-env-"));

  it("写出文件、限制权限，并且不在日志里输出任何值", () => {
    const output = join(workdir, "cli.env");
    const saved = new Map();
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
    let success;
    try {
      Object.assign(process.env, validEnv);
      success = spawnSync(process.execPath, [generator, output], { encoding: "utf8" });
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }

    assert.equal(success.status, 0, success.stderr);
    const content = readFileSync(output, "utf8");
    assert.ok(content.includes(`TURN_SHARED_SECRET=${validEnv.TURN_SHARED_SECRET}\n`));

    // 日志里只能出现键名，不能出现值
    assert.ok(!success.stdout.includes(validEnv.TURN_SHARED_SECRET));
    assert.ok(!success.stderr.includes(validEnv.TURN_SHARED_SECRET));
    assert.ok(success.stdout.includes("TURN_SHARED_SECRET"));

    if (process.platform === "linux") {
      assert.equal(statSync(output).mode & 0o777, 0o600);
    }
  });

  it("缺配置时以退出码 1 失败，并输出 GitHub 注解", () => {
    const output = join(workdir, "cli-missing.env");
    const saved = new Map();
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
    let result;
    try {
      result = spawnSync(process.execPath, [generator, output], { encoding: "utf8" });
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    assert.equal(result.status, 1);
    assert.match(result.stderr, /::error title=部署配置格式错误::/);
    assert.ok(result.stderr.includes("ALLOWED_ORIGINS"));
  });
});
