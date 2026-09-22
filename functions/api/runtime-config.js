const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

export function onRequestGet({ env }) {
  try {
    return Response.json({
      fruitPartyServiceUrl: publicServiceUrl(env.FRUIT_PARTY_SERVICE_URL, ["http:", "https:"]),
      sanctuaryRelayUrl: publicServiceUrl(env.SANCTUARY_RELAY_URL, ["ws:", "wss:"]),
      // 雨晴自建 WebRTC 基础设施（PeerJS 信令 + STUN + TURN）的公开入口。
      // 游戏只读取这个地址，不把 VPS 域名或 IP 写进源码。
      webrtcServiceUrl: publicServiceUrl(env.WEBRTC_SERVICE_URL, ["http:", "https:"]),
    }, { headers: JSON_HEADERS });
  } catch (error) {
    console.error("Invalid public runtime configuration", error);
    return Response.json(
      { error: "Cloudflare runtime configuration is invalid." },
      { status: 500, headers: JSON_HEADERS },
    );
  }
}

function publicServiceUrl(value, allowedProtocols) {
  const configured = String(value ?? "").trim();
  if (!configured) return "";
  const url = new URL(configured);
  if (
    !allowedProtocols.includes(url.protocol)
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error("Only a public service URL without credentials, query, or fragment is allowed.");
  }
  return url.href;
}
