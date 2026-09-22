const
	// Netplay update frequency
	SOCKETIO_UPDATETIME=0,
	SOCKETIO_PREDICTORSTRENGTH=0.5,
	PEERJS_UPDATETIME=2,
	PEERJS_PREDICTORSTRENGTH=0.5,

	// Netplay Predictor
	PREDICTOR_DISTANCETOLLERANCE=[0.1,0.9],
	PREDICTOR_ANGLETOLLERANCE=[-0.78,0.78],

	// PEERJS Connection timers/flags
	PEERJS_CONNECTIONTIME=10,
	PEERJS_CONNECTIONCOOLDOWN=3,
	PEERJS_CONNECTIONTRIES=3,
	PEERJS_JOINTIME=5,
	PEERJS_ENABLEDESTROY=false,
	PEERJS_BULKMODE=true,

	// PEERJS Configuration
	PEERJS_NETLABEL="NET", // Used by GUI.
	PEERJS_UNAVAILABLE_MESSAGE="联机服务未配置：缺少雨晴自建 WebRTC 服务地址。";

// 像素竞技场的联机与孤堡尸潮共用雨晴自建的 WebRTC 基础设施：
// PeerJS 信令、STUN、TURN 都来自 Cloudflare 运行时配置（WEBRTC_SERVICE_URL），
// 由 ../../_shared/yuqing-webrtc.js 统一解析，本文件不再写死任何公共 STUN/TURN。
//
// 配置不可用时一律返回 null 并明确报错，不回退到公共 PeerJS 服务，
// 否则无法判断自建信令与 TURN 是否真的在工作。

function PEERJS_CONFIG_READY() {
	return !!(window.YuqingWebRTC&&window.YuqingWebRTC.isReady());
}

// 返回给 netplay 大厅显示的一句话状态；就绪时返回空字符串。
function PEERJS_STATUS_TEXT() {
	var runtime=window.YuqingWebRTC;
	if (!runtime) return "联机服务未加载";
	if (runtime.isReady()) return "";
	return runtime.message?runtime.message():PEERJS_UNAVAILABLE_MESSAGE;
}

function PEERJS_OPTIONS() {
	var runtime=window.YuqingWebRTC;
	if (!runtime||!runtime.isReady()) return null;
	return runtime.peerOptions();
}

function PEERJS_DIAG(key,status,detail) {
	if (window.YuqingNetDiag&&window.YuqingNetDiag.report) window.YuqingNetDiag.report(key,status,detail);
}
