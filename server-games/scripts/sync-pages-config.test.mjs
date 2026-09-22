// sync-pages-config.mjs 的测试。
//
// 这里最需要守住的是「不要破坏用户已有的变量」：同步必须只动我们负责的三个键，
// 其余原样保留；拿不准的时候就中止，而不是把别人的配置写没了。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MANAGED_KEYS, buildProjectPatch, validateServiceUrl } from "./sync-pages-config.mjs";

const values = {
  FRUIT_PARTY_SERVICE_URL: "https://rooms.example.com",
  SANCTUARY_RELAY_URL: "wss://sanctuary.example.com/socket",
  WEBRTC_SERVICE_URL: "https://rtc.example.com",
};

const projectWith = (envVars) => ({
  name: "yuqing-game-hall",
  deployment_configs: { production: { env_vars: envVars } },
});

const mergedVars = (result) => result.payload.deployment_configs.production.env_vars;

describe("地址校验", () => {
  it("接受带路径的中继地址与根路径的 gateway 地址", () => {
    assert.deepEqual(validateServiceUrl("SANCTUARY_RELAY_URL", "wss://sanctuary.example.com/socket"), {
      ok: true,
      value: "wss://sanctuary.example.com/socket",
    });
    assert.deepEqual(validateServiceUrl("WEBRTC_SERVICE_URL", "https://rtc.example.com"), {
      ok: true,
      value: "https://rtc.example.com",
    });
  });

  it("统一去掉尾部斜杠，避免消费方拼出双斜杠", () => {
    assert.equal(validateServiceUrl("FRUIT_PARTY_SERVICE_URL", "https://rooms.example.com/").value, "https://rooms.example.com");
    assert.equal(validateServiceUrl("SANCTUARY_RELAY_URL", "wss://sanctuary.example.com/socket/").value, "wss://sanctuary.example.com/socket");
  });

  it("把空值当作“该服务尚未部署”，而不是错误", () => {
    assert.deepEqual(validateServiceUrl("WEBRTC_SERVICE_URL", ""), { ok: true, value: "" });
    assert.deepEqual(validateServiceUrl("WEBRTC_SERVICE_URL", undefined), { ok: true, value: "" });
  });

  it("拒绝协议不匹配的地址", () => {
    assert.equal(validateServiceUrl("SANCTUARY_RELAY_URL", "https://sanctuary.example.com/socket").ok, false);
    assert.equal(validateServiceUrl("WEBRTC_SERVICE_URL", "wss://rtc.example.com").ok, false);
    assert.equal(validateServiceUrl("FRUIT_PARTY_SERVICE_URL", "ftp://rooms.example.com").ok, false);
  });

  it("拒绝给 WEBRTC_SERVICE_URL 带路径", () => {
    const result = validateServiceUrl("WEBRTC_SERVICE_URL", "https://rtc.example.com/yuqing-rtc");
    assert.equal(result.ok, false);
    assert.ok(result.message.includes("根路径"));
  });

  it("拒绝带用户名、密码、查询串或片段的地址", () => {
    for (const bad of [
      "https://user:pass@rtc.example.com",
      "https://rtc.example.com?x=1",
      "https://rtc.example.com#frag",
    ]) {
      assert.equal(validateServiceUrl("WEBRTC_SERVICE_URL", bad).ok, false, bad);
    }
  });
});

describe("合并进 Pages 项目", () => {
  it("写入三个受管键，并保留其它已有变量", () => {
    const result = buildProjectPatch(
      projectWith({
        KEEP_ME: { type: "plain_text", value: "kept" },
        ALSO_KEEP: { type: "secret_text", value: "secret-value" },
      }),
      values,
    );
    assert.equal(result.ok, true, result.message);
    const merged = mergedVars(result);
    assert.deepEqual(merged.KEEP_ME, { type: "plain_text", value: "kept" });
    assert.deepEqual(merged.ALSO_KEEP, { type: "secret_text", value: "secret-value" });
    for (const key of MANAGED_KEYS) {
      assert.equal(merged[key].type, "plain_text");
    }
    assert.equal(merged.WEBRTC_SERVICE_URL.value, "https://rtc.example.com");
    assert.deepEqual(result.preserved.sort(), ["ALSO_KEEP", "KEEP_ME"]);
  });

  it("项目还没有任何变量时也能工作", () => {
    const result = buildProjectPatch(projectWith(undefined), values);
    assert.equal(result.ok, true, result.message);
    assert.equal(mergedVars(result).FRUIT_PARTY_SERVICE_URL.value, "https://rooms.example.com");
  });

  it("GitHub 上留空时清空对应变量，让 GitHub 成为唯一来源", () => {
    const result = buildProjectPatch(
      projectWith({ WEBRTC_SERVICE_URL: { type: "plain_text", value: "https://old.example.com" } }),
      { ...values, WEBRTC_SERVICE_URL: "" },
    );
    assert.equal(result.ok, true, result.message);
    assert.equal(mergedVars(result).WEBRTC_SERVICE_URL.value, "");
    assert.deepEqual(result.cleared, ["WEBRTC_SERVICE_URL"]);
  });

  it("值没变化时不产生改动", () => {
    const result = buildProjectPatch(projectWith({
      FRUIT_PARTY_SERVICE_URL: { type: "plain_text", value: "https://rooms.example.com" },
      SANCTUARY_RELAY_URL: { type: "plain_text", value: "wss://sanctuary.example.com/socket" },
      WEBRTC_SERVICE_URL: { type: "plain_text", value: "https://rtc.example.com" },
    }), values);
    assert.equal(result.ok, true, result.message);
    assert.deepEqual(result.changes, []);
    assert.deepEqual(result.cleared, []);
  });

  it("地址不合法时中止，不返回任何 payload", () => {
    const result = buildProjectPatch(projectWith({}), { ...values, WEBRTC_SERVICE_URL: "not-a-url" });
    assert.equal(result.ok, false);
    assert.equal(result.payload, undefined);
  });

  it("遇到无法回写的 secret 变量时中止，避免误删", () => {
    const result = buildProjectPatch(
      projectWith({ MY_SECRET: { type: "secret_text" } }),
      values,
    );
    assert.equal(result.ok, false);
    assert.ok(result.message.includes("MY_SECRET"));
    assert.equal(result.payload, undefined);
  });
});
