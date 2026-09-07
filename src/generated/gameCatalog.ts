// 此文件由 scripts/generate-game-catalog.mjs 生成，请修改对应 game.json。
// - public/games/fruit-party/game.json
// - public/games/der-koloss/game.json
// - server-games/suroi/game.json
// - public/games/sanctuarys-end/game.json
// - public/games/littlejs-arcade/game.json
// - server-games/scribble/game.json
// - public/games/pvp-arena/game.json
// - server-games/tosios/game.json
// - public/games/hexgl/game.json
// - server-games/openfront/game.json
// - game-sources/rejected/kaetram/game.json
import type { GameManifest } from "../platform/game-manifest";

export const GAME_MANIFESTS = [
  {
    "schemaVersion": 1,
    "id": "fruit-party",
    "order": 1,
    "name": "果切派对",
    "originalName": "Canvas Games · Fruit Ninja module",
    "mark": "果切",
    "category": "短局动作与好友对战",
    "description": "90 秒动态街机、经典三命无尽，以及使用房间码的好友 1v1 果切比赛。",
    "hosting": "static",
    "hostingLabel": "正式可玩",
    "featured": true,
    "theme": {
      "accent": "#dd5037",
      "dark": "#231411"
    },
    "tags": [
      "单人",
      "1v1",
      "街机"
    ],
    "play": {
      "modes": "90 秒街机 / 经典无尽 / 好友房间",
      "players": "1–2 人",
      "controls": "按住鼠标左键快速划过水果",
      "inputs": [
        "mouse"
      ],
      "devices": [
        "desktop"
      ],
      "vision": false
    },
    "technology": "TypeScript · Canvas 2D · Cloudflare Durable Objects",
    "license": "大厅代码 MIT；玩法底座与第三方资源许可见 THIRD_PARTY_NOTICES",
    "sourceUrl": "https://github.com/forinda/canvas-games",
    "localization": "完整中文界面；玩法、美术、音效、街机系统和联机房间已在本项目内重做与扩展。",
    "fit": "它是游戏厅当前最完整的自有改造游戏，因此保留原生 TypeScript 开发和测试，而不是降级成难以调试的复制版静态页面。",
    "highlights": [
      "两种完整单人模式",
      "共享种子的好友实时对战",
      "引擎、渲染、输入和音频均有独立模块"
    ],
    "cautions": [
      "目前仅支持电脑和鼠标",
      "体感实验室不再直接控制果切刀刃",
      "好友联机依赖 Cloudflare Worker 与 Durable Object"
    ],
    "capabilities": [
      "audio",
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ],
    "cover": "/games/fruit-party/assets/fruits/watermelon.svg",
    "launch": {
      "kind": "iframe",
      "entry": "/games/fruit-party/index.html"
    }
  },
  {
    "schemaVersion": 1,
    "id": "der-koloss",
    "order": 2,
    "name": "孤堡尸潮",
    "originalName": "Der Koloss CE",
    "mark": "尸潮",
    "category": "第一人称波次生存",
    "description": "守住据点、购买武器、救援队友，在一波比一波凶的尸潮中活下去。",
    "hosting": "static",
    "hostingLabel": "静态版已接入",
    "theme": {
      "accent": "#f06a3d",
      "dark": "#251713"
    },
    "tags": [
      "单人",
      "四人合作",
      "打怪"
    ],
    "play": {
      "modes": "单人 / 最多四人联机",
      "players": "1–4 人",
      "controls": "键盘移动 · 鼠标瞄准射击",
      "inputs": [
        "keyboard",
        "mouse"
      ],
      "devices": [
        "desktop"
      ],
      "vision": false
    },
    "technology": "原生 JavaScript · Three.js · WebRTC",
    "license": "代码 MIT；素材许可混杂",
    "sourceUrl": "https://github.com/rishipr/der-koloss-ce",
    "localization": "主菜单、角色与辅助选项、房间、操作设置以及常见战斗 HUD 和交互提示已汉化；武器专名与角色语音保留原作。",
    "fit": "这批项目里最接近联机生存打怪的完整玩法原型，适合拆解波次、商店、复活和房间结构。",
    "highlights": [
      "逐波增强的敌人与特殊轮次",
      "武器墙、随机箱、强化与可开启区域",
      "主机权威房间、WebRTC 与队友复活"
    ],
    "cautions": [
      "含明显的商业游戏致敬名称、人物和语音，公开发布前仍需替换相关素材",
      "原仓库中的无授权商业录音已从游戏厅副本移除",
      "技术上可静态部署，不代表现有全部素材都已取得商业发布许可"
    ],
    "launch": {
      "kind": "iframe",
      "entry": "/games/der-koloss/index.html",
      "upstreamUrl": "https://www.derkoloss.com/"
    }
  },
  {
    "schemaVersion": 1,
    "id": "suroi",
    "order": 3,
    "name": "荒野生存",
    "originalName": "Suroi",
    "mark": "生存",
    "category": "多人俯视角生存竞技",
    "description": "搜集装备、躲避毒圈、判断枪声方向，在快节奏战局里成为最后的幸存者。",
    "hosting": "server",
    "hostingLabel": "需专用服务器",
    "theme": {
      "accent": "#57b86b",
      "dark": "#102416"
    },
    "tags": [
      "多人",
      "生存",
      "射击"
    ],
    "play": {
      "modes": "单排 / 双排 / 四排",
      "players": "多人匹配",
      "controls": "键盘移动 · 鼠标瞄准射击",
      "inputs": [
        "keyboard",
        "mouse"
      ],
      "devices": [
        "desktop"
      ],
      "vision": false
    },
    "technology": "Bun · TypeScript · PixiJS · WebSocket",
    "license": "GPL-3.0",
    "sourceUrl": "https://github.com/HasangerGames/suroi",
    "localization": "游戏厅中文说明已完成；当前进入的是原作者在线服务，内部语言和服务状态由上游维护。自建版汉化需要和服务端版本一起固定后再做。",
    "fit": "完成度和真实多人质量最高，适合研究权威服务端、毒圈、拾取、队伍和大量实时玩家同步。",
    "highlights": [
      "完整匹配、毒圈、枪械、护甲与投掷物",
      "服务端权威结算，客户端反馈依然迅速",
      "活跃的线上版本，可直接检验真实战局"
    ],
    "cautions": [
      "玩法偏 PvP，不是合作打怪",
      "GPL 代码复用会带来对应开源义务",
      "Bun 服务端不能原样部署到 Cloudflare Worker"
    ],
    "launch": {
      "kind": "external",
      "url": "https://suroi.io/"
    }
  },
  {
    "schemaVersion": 1,
    "id": "sanctuarys-end",
    "order": 4,
    "name": "庇护所终章",
    "originalName": "Sanctuary’s End",
    "mark": "冒险",
    "category": "暗黑式动作角色扮演",
    "description": "选择职业、组合技能与装备词条，深入地下城迎战成群怪物和首领。",
    "hosting": "static",
    "hostingLabel": "静态版已接入",
    "theme": {
      "accent": "#9d72e8",
      "dark": "#1c1428"
    },
    "tags": [
      "单人",
      "打怪",
      "养成"
    ],
    "play": {
      "modes": "单人冒险",
      "players": "1 人",
      "controls": "键盘移动 · 鼠标战斗与界面操作",
      "inputs": [
        "keyboard",
        "mouse"
      ],
      "devices": [
        "desktop"
      ],
      "vision": false
    },
    "technology": "JavaScript · Three.js",
    "license": "MIT",
    "sourceUrl": "https://github.com/J3vb/Sanctuarys_End",
    "localization": "角色、帮助、设置、装备属性与部位、技能、符文、怪物区域及主要商店面板已汉化；少量世界专名与剧情内容保留原作。",
    "fit": "单机打怪内容最完整，职业、技能、掉落、锻造和 Boss 已形成可玩的长线循环。",
    "highlights": [
      "四种职业与技能树",
      "装备词条、商人、锻造和本地存档",
      "地下城、精英怪与首领战"
    ],
    "cautions": [
      "现有联网模块只同步在线状态和聊天",
      "真正合作战斗需要重新设计权威同步",
      "美术和反馈还需要统一到游戏厅质量线"
    ],
    "launch": {
      "kind": "iframe",
      "entry": "/games/sanctuarys-end/sanctuary.html",
      "upstreamUrl": "https://j3vb.github.io/Sanctuarys_End/sanctuary.html"
    }
  },
  {
    "schemaVersion": 1,
    "id": "littlejs-arcade",
    "order": 5,
    "name": "迷你街机合集",
    "originalName": "LittleJS Arcade",
    "mark": "街机",
    "category": "轻量街机合集",
    "description": "赛车、生存、防空、台球和坦克等一批短小直接的浏览器小游戏。",
    "hosting": "static",
    "hostingLabel": "静态版已接入",
    "theme": {
      "accent": "#f2b942",
      "dark": "#2a210e"
    },
    "tags": [
      "单人",
      "本地双人",
      "合集"
    ],
    "play": {
      "modes": "随子游戏变化",
      "players": "1–2 人，随子游戏变化",
      "controls": "键盘 / 鼠标 / 手柄",
      "inputs": [
        "keyboard",
        "mouse",
        "gamepad"
      ],
      "devices": [
        "desktop"
      ],
      "vision": false
    },
    "technology": "LittleJS · 原生 JavaScript",
    "license": "主体 MIT；独立素材单独署名",
    "sourceUrl": "https://github.com/KilledByAPixel/LittleJSArcade",
    "localization": "合集目录以及 63 款本地子游戏的开始、暂停、设置、结算、教程、操作说明和常用 HUD 已统一汉化；WASD、Shift 等实际按键名与角色专名保留原文。",
    "fit": "适合快速挑出一两个玩法加工成雨晴游戏厅自己的短局游戏。",
    "highlights": [
      "启动快、代码集中、容易拆解",
      "覆盖多种操作和局长",
      "非常适合先验证玩法再重做美术"
    ],
    "cautions": [
      "合集内各游戏质量不完全一致",
      "Twemoji 等素材需要保留许可",
      "后续更新上游代码时必须保留本地汉化桥接层"
    ],
    "launch": {
      "kind": "iframe",
      "entry": "/games/littlejs-arcade/index.html",
      "upstreamUrl": "https://killedbyapixel.github.io/LittleJSArcade/"
    }
  },
  {
    "schemaVersion": 1,
    "id": "scribble",
    "order": 6,
    "name": "你画我猜",
    "originalName": "Scribble.rs",
    "mark": "画猜",
    "category": "多人派对猜词",
    "description": "轮流画画和猜词，规则天然适合朋友开房，也最容易做出中文词库特色。",
    "hosting": "server",
    "hostingLabel": "需专用服务器",
    "theme": {
      "accent": "#4ea7e8",
      "dark": "#102131"
    },
    "tags": [
      "多人",
      "派对",
      "创作"
    ],
    "play": {
      "modes": "多人房间",
      "players": "多人房间",
      "controls": "鼠标绘画 · 键盘猜词",
      "inputs": [
        "keyboard",
        "mouse",
        "touch"
      ],
      "devices": [
        "desktop",
        "mobile"
      ],
      "vision": false
    },
    "technology": "TypeScript 前端 · Go 服务端 · WebSocket",
    "license": "BSD-3-Clause；部分美术另行授权",
    "sourceUrl": "https://github.com/scribble-rs/scribble.rs",
    "localization": "游戏厅中文说明已完成；现阶段连接上游房间服务。自建时会固定版本并替换完整中文词库、提示与房间界面。",
    "fit": "房间规则成熟、上手门槛低，很适合成为游戏厅第一款轻社交联机游戏。",
    "highlights": [
      "创建房间、回合轮换和计分完整",
      "中文词库可做成校园、网络梗和自定义主题",
      "低延迟要求比动作联机宽松"
    ],
    "cautions": [
      "官方实例会在无流量时休眠，首次打开可能需要等待它唤醒",
      "原 Logo、背景与部分图标不能直接整体搬用",
      "自建版需要补举报、房主控制和 WebSocket 反向代理"
    ],
    "launch": {
      "kind": "external",
      "url": "https://scribblers.bios-marcel.link/"
    }
  },
  {
    "schemaVersion": 1,
    "id": "pvp-arena",
    "order": 7,
    "name": "像素竞技场",
    "originalName": "PVP",
    "mark": "对战",
    "category": "复古多人竞技场射击",
    "description": "在小地图中高速移动、拾取武器，与本地或远程玩家展开短局对战。",
    "hosting": "static",
    "hostingLabel": "静态版已接入",
    "theme": {
      "accent": "#e45272",
      "dark": "#28121a"
    },
    "tags": [
      "1–4 人",
      "射击",
      "本地对战"
    ],
    "play": {
      "modes": "本地 / 局域网 / 实验性 WebRTC",
      "players": "1–4 人",
      "controls": "键盘或手柄",
      "inputs": [
        "keyboard",
        "gamepad"
      ],
      "devices": [
        "desktop"
      ],
      "vision": false
    },
    "technology": "原生 JavaScript · Socket.IO · PeerJS",
    "license": "MIT / GPL-3.0（上游双文件均保留）",
    "sourceUrl": "https://github.com/kesiev/pvp",
    "localization": "主菜单、启动设置、模式规则、操作说明及常见 Canvas HUD 与对局提示已汉化；玩家昵称和地图专名保留原文。",
    "fit": "短局节奏直接，本地多人和 WebRTC 代码值得拆看，但成品视觉不符合当前游戏厅定位。",
    "highlights": [
      "一台电脑多人同屏",
      "局域网和 PeerJS 实验路径",
      "地图与武器机制足够简洁"
    ],
    "cautions": [
      "使用前必须逐文件澄清许可",
      "公网 WebRTC 缺少可靠 TURN",
      "复古美术只能做玩法参考"
    ],
    "launch": {
      "kind": "iframe",
      "entry": "/games/pvp-arena/client/index.html",
      "upstreamUrl": "https://www.kesiev.com/pvp/"
    }
  },
  {
    "schemaVersion": 1,
    "id": "tosios",
    "order": 8,
    "name": "双队乱斗",
    "originalName": "TOSIOS",
    "mark": "乱斗",
    "category": "多人 2D 竞技射击",
    "description": "在紧凑地图中进行死亡竞赛或团队战，观察权威房间同步如何组织。",
    "hosting": "server",
    "hostingLabel": "需专用服务器",
    "theme": {
      "accent": "#ef8754",
      "dark": "#2a170f"
    },
    "tags": [
      "多人",
      "团队",
      "射击"
    ],
    "play": {
      "modes": "死亡竞赛 / 团队模式",
      "players": "多人房间",
      "controls": "键盘移动 · 鼠标瞄准",
      "inputs": [
        "keyboard",
        "mouse"
      ],
      "devices": [
        "desktop"
      ],
      "vision": false
    },
    "technology": "PixiJS · Colyseus · TypeScript",
    "license": "MIT",
    "sourceUrl": "https://github.com/halftheopposite/tosios",
    "localization": "游戏厅中文说明已完成；当前试玩使用上游在线服务。自建版本需同时汉化大厅、比分板、武器提示和服务端房间消息。",
    "fit": "客户端与权威房间分层清楚，适合参考实时竞技的服务端结构。",
    "highlights": [
      "PixiJS 客户端与服务端清晰分离",
      "死亡竞赛和团队玩法完整",
      "房间状态同步结构容易阅读"
    ],
    "cautions": [
      "不是生存打怪玩法",
      "Colyseus 服务端不能直接放入 Durable Object",
      "线上项目状态需在正式选择时再次确认"
    ],
    "launch": {
      "kind": "external",
      "url": "https://tosios.online/"
    }
  },
  {
    "schemaVersion": 1,
    "id": "hexgl",
    "order": 9,
    "name": "极速光轨",
    "originalName": "HexGL",
    "mark": "竞速",
    "category": "未来悬浮竞速",
    "description": "驾驶高速悬浮载具穿越霓虹赛道，重点体验速度感、镜头和计时追逐。",
    "hosting": "static",
    "hostingLabel": "静态版已接入",
    "theme": {
      "accent": "#3dcbd1",
      "dark": "#0d2225"
    },
    "tags": [
      "单人",
      "竞速",
      "3D"
    ],
    "play": {
      "modes": "单人计时",
      "players": "1 人",
      "controls": "键盘驾驶",
      "inputs": [
        "keyboard",
        "gamepad"
      ],
      "devices": [
        "desktop"
      ],
      "vision": false
    },
    "technology": "旧版 Three.js · CoffeeScript",
    "license": "MIT",
    "sourceUrl": "https://github.com/BKcore/HexGL",
    "localization": "启动、控制方式、画质、界面开关和继续提示已汉化；赛道内计时与结算术语继续沿用易辨认的原作缩写。",
    "fit": "视觉速度感仍有参考价值，可拆出赛道、幽灵回放与操作反馈。",
    "highlights": [
      "浏览器 3D 高速竞速",
      "计时与幽灵回放",
      "本地无需后端即可试玩"
    ],
    "cautions": [
      "技术栈年代较久",
      "原项目长期停止维护",
      "更适合参考后重制，不适合整仓长期维护"
    ],
    "launch": {
      "kind": "iframe",
      "entry": "/games/hexgl/index.html",
      "upstreamUrl": "http://hexgl.bkcore.com/play/"
    }
  },
  {
    "schemaVersion": 1,
    "id": "openfront",
    "order": 10,
    "name": "世界前线",
    "originalName": "OpenFrontIO",
    "mark": "策略",
    "category": "大规模多人领土策略",
    "description": "在世界地图上扩张领地、调配兵力并与大量玩家争夺最终控制权。",
    "hosting": "server",
    "hostingLabel": "需专用服务器",
    "theme": {
      "accent": "#6d8ee8",
      "dark": "#121a2c"
    },
    "tags": [
      "多人",
      "策略",
      "大地图"
    ],
    "play": {
      "modes": "大规模在线对局",
      "players": "大房间多人对局",
      "controls": "鼠标与键盘",
      "inputs": [
        "keyboard",
        "mouse",
        "touch"
      ],
      "devices": [
        "desktop",
        "mobile"
      ],
      "vision": false
    },
    "technology": "TypeScript · 确定性模拟 · 专用服务端",
    "license": "AGPL-3.0；生产 API 并非全部开放",
    "sourceUrl": "https://github.com/openfrontio/OpenFrontIO",
    "localization": "上游官网已提供中文界面；游戏厅保留中文玩法说明，自建时需继续维护完整术语、新手教学和版本同步。",
    "fit": "产品完成度很高，适合研究确定性模拟、回放和大房间，但体量远超当前小游戏范围。",
    "highlights": [
      "高人数同局与确定性模拟",
      "地图、回放和完整产品流程",
      "社区活跃、真实线上压力可观察"
    ],
    "cautions": [
      "官网可能先显示 Cloudflare 安全验证，这不是游戏厅加载器卡死",
      "AGPL 会影响后续代码发布方式",
      "源码与资源接近大型独立项目，不适合塞入静态小游戏构建"
    ],
    "launch": {
      "kind": "external",
      "url": "https://openfront.io/"
    }
  },
  {
    "schemaVersion": 1,
    "id": "kaetram",
    "order": 11,
    "name": "凯特兰冒险",
    "originalName": "Kaetram Open",
    "mark": "MMO",
    "category": "像素多人在线角色扮演",
    "description": "任务、怪物、首领、地图分区与多人世界较完整，但当前许可不适合作为本项目底座。",
    "hosting": "restricted",
    "hostingLabel": "许可受限",
    "theme": {
      "accent": "#b58a5a",
      "dark": "#271d13"
    },
    "tags": [
      "MMO",
      "打怪",
      "任务"
    ],
    "play": {
      "modes": "多人持续世界",
      "players": "大型多人在线",
      "controls": "鼠标与键盘",
      "inputs": [
        "keyboard",
        "mouse"
      ],
      "devices": [
        "desktop"
      ],
      "vision": false
    },
    "technology": "TypeScript · WebSocket · 多包工作区",
    "license": "MPL-2.0 + 自定义 OPL",
    "sourceUrl": "https://github.com/Kaetram/Kaetram-Open",
    "localization": "不进入正式汉化排期，仅保留产品与架构观察。",
    "fit": "内容系统值得观察，但自定义许可明确限制 AI 相关使用，因此不会复用代码。",
    "highlights": [
      "怪物、任务、成就与地图分区",
      "浏览器 MMO 的完整工程拆分",
      "可观察持续世界的产品结构"
    ],
    "cautions": [
      "自定义许可明确限制 AI 相关用途",
      "必须保留特定署名与开放要求",
      "当前产品版本与开放源码已经分叉"
    ],
    "launch": {
      "kind": "none"
    }
  }
] as const satisfies readonly GameManifest[];
