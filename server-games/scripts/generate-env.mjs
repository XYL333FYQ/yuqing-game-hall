// 从 GitHub Actions Variables / Secrets 生成 server-games 的生产 .env。
//
// 用法：node server-games/scripts/generate-env.mjs <输出路径>
// 输入：以下环境变量（由 workflow 从 vars.* / secrets.* 注入）
//   Variables: ALLOWED_ORIGINS TURN_PUBLIC_HOST TURN_EXTERNAL_IP TURN_REALM
//              TURN_PORT TURN_MIN_PORT TURN_MAX_PORT TURN_CREDENTIAL_TTL_SECONDS
//   Secrets:   TURN_SHARED_SECRET
//
// 设计原则：
//   1. 缺哪个变量就报哪个，绝不生成残缺配置（宁可部署失败，也不要启动半残服务）；
//   2. 值里不允许出现会破坏 KEY=value 解析的字符 —— 直接拒绝，而不是尝试转义，
//      因为不同版本的 compose / shell 对这些字符的解释并不一致；
//   3. 只打印键名，不打印值；调用方负责把输出文件放在仓库之外并限制权限。
//
// 校验逻辑放在 buildEnvFile() 里并以纯函数导出，测试可以直接调用，
// 不需要起子进程。
import { writeFileSync } from "node:fs";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const VARIABLE_KEYS = Object.freeze([
  "ALLOWED_ORIGINS",
  "TURN_PUBLIC_HOST",
  "TURN_EXTERNAL_IP",
  "TURN_REALM",
  "TURN_PORT",
  "TURN_MIN_PORT",
  "TURN_MAX_PORT",
  "TURN_CREDENTIAL_TTL_SECONDS",
]);

export const SECRET_KEYS = Object.freeze(["TURN_SHARED_SECRET"]);

export const ENV_KEYS = Object.freeze([...VARIABLE_KEYS, ...SECRET_KEYS]);

const HOST_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const ORIGINS_PATTERN = /^https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:,https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?)*$/;
const SECRET_PATTERN = /^[A-Za-z0-9+/=_-]{32,}$/;

function reject(message) {
  return { ok: false, message };
}

function assertPlain(name, value) {
  // 换行必须先单独查：它是 .env 的行分隔符，会直接截断配置
  if (/[\n\r]/.test(value)) return `${name} 含换行符；.env 是逐行 KEY=value，换行会截断配置`;
  if (/[^\x21-\x7e]/.test(value)) return `${name} 含空白或非 ASCII 字符；请只使用可打印 ASCII`;
  if (/["'$#\\`]/.test(value)) return `${name} 含 " ' $ # \\ 或反引号，会破坏 .env 解析`;
  return "";
}

function assertInteger(name, value, minimum, maximum) {
  if (!/^\d+$/.test(value)) return `${name} 必须是整数，当前为「${value}」`;
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    return `${name} 必须在 ${minimum}–${maximum} 之间，当前为「${value}」`;
  }
  return "";
}

/**
 * 校验并生成 .env 内容。
 * @returns {{ ok: true, content: string, keys: string[] } | { ok: false, message: string }}
 */
export function buildEnvFile(env, { timestamp = new Date().toISOString(), revision = "local" } = {}) {
  const read = (name) => String(env[name] ?? "");

  // 1) 缺失检查：一次列出全部缺项，避免“改一个跑一次”
  const missingVariables = VARIABLE_KEYS.filter((name) => !read(name));
  const missingSecrets = SECRET_KEYS.filter((name) => !read(name));
  if (missingVariables.length > 0 || missingSecrets.length > 0) {
    let message = "缺少部署配置。";
    if (missingVariables.length > 0) {
      message += ` 请在 Settings → Secrets and variables → Actions → Variables 添加：${missingVariables.join(" ")}。`;
    }
    if (missingSecrets.length > 0) {
      message += ` 请在同一个页面的 Secrets 添加：${missingSecrets.join(" ")}。`;
    }
    return reject(message);
  }

  // 2) 字符白名单
  for (const name of ENV_KEYS) {
    const problem = assertPlain(name, read(name));
    if (problem) return reject(problem);
  }

  // 3) 逐项格式与范围
  if (!ORIGINS_PATTERN.test(read("ALLOWED_ORIGINS"))) {
    return reject(`ALLOWED_ORIGINS 必须是英文逗号分隔的 http(s)://主机[:端口]，当前为「${read("ALLOWED_ORIGINS")}」`);
  }
  if (!HOST_PATTERN.test(read("TURN_PUBLIC_HOST"))) {
    return reject(`TURN_PUBLIC_HOST 必须是主机名或 IPv4 地址，当前为「${read("TURN_PUBLIC_HOST")}」`);
  }
  if (!IPV4_PATTERN.test(read("TURN_EXTERNAL_IP"))) {
    return reject(`TURN_EXTERNAL_IP 必须是 IPv4 地址，当前为「${read("TURN_EXTERNAL_IP")}」`);
  }
  if (!HOST_PATTERN.test(read("TURN_REALM"))) {
    return reject(`TURN_REALM 必须是主机名或 IPv4 地址，当前为「${read("TURN_REALM")}」`);
  }
  for (const [name, minimum, maximum] of [
    ["TURN_PORT", 1, 65535],
    ["TURN_MIN_PORT", 1, 65535],
    ["TURN_MAX_PORT", 1, 65535],
    ["TURN_CREDENTIAL_TTL_SECONDS", 300, 86400],
  ]) {
    const problem = assertInteger(name, read(name), minimum, maximum);
    if (problem) return reject(problem);
  }
  if (!SECRET_PATTERN.test(read("TURN_SHARED_SECRET"))) {
    return reject("TURN_SHARED_SECRET 必须是至少 32 位的 base64 / 十六进制风格随机串（建议 openssl rand -hex 32）");
  }

  // 4) 跨变量一致性：这类错误运行时只会表现为“连不上”，提前拦下来
  const turnPort = Number(read("TURN_PORT"));
  const minPort = Number(read("TURN_MIN_PORT"));
  const maxPort = Number(read("TURN_MAX_PORT"));
  if (minPort > maxPort) {
    return reject(`TURN_MIN_PORT（${minPort}）不能大于 TURN_MAX_PORT（${maxPort}）`);
  }
  if (turnPort >= minPort && turnPort <= maxPort) {
    return reject(`TURN_PORT（${turnPort}）落在中继端口段 ${minPort}–${maxPort} 内，会和 coturn 的中继端口冲突`);
  }

  // 5) 所有值都已确认不含危险字符，直接 KEY=value 即可，无需引号
  const lines = [
    "# 由 GitHub Actions 自动生成，请勿在 VPS 上手动编辑。",
    `# 生成时间（UTC）：${timestamp}`,
    `# 来源提交：${revision}`,
    ...ENV_KEYS.map((name) => `${name}=${read(name)}`),
  ];
  return { ok: true, content: `${lines.join("\n")}\n`, keys: [...ENV_KEYS] };
}

function main() {
  const output = process.argv[2];
  if (!output) {
    process.stderr.write("用法：node generate-env.mjs <输出路径>\n");
    process.exit(2);
  }

  const result = buildEnvFile(process.env, {
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    revision: process.env.GITHUB_SHA || "local",
  });
  if (!result.ok) {
    process.stderr.write(`::error title=部署配置格式错误::${result.message}\n`);
    process.exit(1);
  }

  // 0600：只有生成它的进程能读，避免同机其它用户看到 TURN 密钥
  writeFileSync(output, result.content, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(`已生成 .env：${result.keys.length} 个键（Variables ${VARIABLE_KEYS.length} + Secrets ${SECRET_KEYS.length}）\n`);
  process.stdout.write(`包含的键：${result.keys.join(" ")}\n`);
}

// `node generate-env.mjs <file>` 直接执行；被 import（测试）时不执行。
// 不能拿 argv[1] 和 import.meta.url 的 pathname 直接比字符串：Windows 上是反斜杠，
// 而且路径里只要有中文 pathname 就会被百分号编码，永远比不相等。
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main();
}
