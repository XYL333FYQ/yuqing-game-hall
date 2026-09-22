// 此文件由 scripts/generate-game-catalog.mjs 生成，请修改对应 game.json。
// - public/games/fruit-party/game.json
// - public/games/der-koloss/game.json
// - external-games/suroi/game.json
// - public/games/sanctuarys-end/game.json
// - public/games/littlejs-arcade/game.json
// - external-games/scribble/game.json
// - public/games/pvp-arena/game.json
// - external-games/tosios/game.json
// - public/games/hexgl/game.json
// - external-games/openfront/game.json
// - game-sources/rejected/kaetram/game.json
import type { GameManifest } from "../platform/game-manifest";

export const GAME_MANIFESTS = [
  {
    "schemaVersion": 2,
    "id": "fruit-party",
    "order": 1,
    "featured": true,
    "discovery": {
      "audiences": [
        "single",
        "duo"
      ],
      "popularRank": 1,
      "featuredRank": 1
    },
    "theme": {
      "accent": "#dd5037",
      "dark": "#231411"
    },
    "presentation": {
      "title": "果切派对",
      "originalTitle": "Fruit Party",
      "mark": "果切",
      "category": "短局动作与好友对战",
      "tagline": "切开飞舞的水果，和朋友来一场爽快对决。",
      "description": "在飞舞的水果中快速挥刀，挑战限时街机与经典无尽，也可以和朋友用房间码来一场 1v1 果切比赛。",
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
      "highlights": [
        "限时挑战与经典无尽两种节奏",
        "水果、炸弹和连切反馈带来爽快手感",
        "和朋友用房间码进行 1v1 对决"
      ],
      "art": {
        "cover": "/games/fruit-party/assets/fruits/watermelon.svg",
        "hero": "/games/fruit-party/assets/fruits/watermelon.svg"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "选择玩法"
    },
    "platform": {
      "hosting": "hybrid",
      "technology": "TypeScript · Canvas 2D · Node.js · WebSocket",
      "license": "大厅代码 MIT；玩法底座与第三方资源许可见 THIRD_PARTY_NOTICES",
      "sourceUrl": "https://github.com/forinda/canvas-games",
      "localization": "完整中文界面；玩法、美术、音效、街机系统和联机房间已在本项目内重做与扩展。",
      "fit": "浏览器运行包可独立静态部署，房间服务单独部署到 VPS；大厅只读取清单并通过 iframe 启动。",
      "highlights": [
        "两种完整单人模式",
        "共享种子的好友实时对战",
        "引擎、渲染、输入和音频均有独立模块"
      ],
      "cautions": [
        "目前仅支持电脑和鼠标",
        "体感实验室不再直接控制果切刀刃",
        "好友联机前必须配置可访问的 VPS WebSocket 服务地址"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/fruit-party/index.html",
        "startUrl": "/games/fruit-party/index.html?route=home"
      }
    },
    "capabilities": [
      "audio",
      "multiplayer",
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "der-koloss",
    "order": 2,
    "featured": true,
    "discovery": {
      "audiences": [
        "single",
        "multi"
      ],
      "popularRank": 2,
      "featuredRank": 2
    },
    "theme": {
      "accent": "#f06a3d",
      "dark": "#251713"
    },
    "presentation": {
      "title": "孤堡尸潮",
      "originalTitle": "Der Koloss CE",
      "mark": "尸潮",
      "category": "第一人称波次生存",
      "tagline": "守住孤堡，在一波又一波的尸潮中活下来。",
      "description": "守住据点、购买武器、解锁防守区域并救援队友，在越来越凶猛的尸潮中坚持更久。",
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
      "highlights": [
        "逐波增强的敌人与特殊轮次",
        "购买武器并解锁新的防守区域",
        "和队友互相救援，共同守住据点"
      ],
      "art": {
        "cover": "/games/der-koloss/assets/der-koloss-og-v06-courtyard-1200x630.png",
        "hero": "/games/der-koloss/assets/der-koloss-og-v06-courtyard-1200x630.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "开始游戏"
    },
    "platform": {
      "hosting": "static",
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
    "capabilities": [
      "audio",
      "multiplayer",
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "microphone",
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "suroi",
    "order": 3,
    "discovery": {
      "audiences": [
        "multi"
      ],
      "popularRank": 3
    },
    "theme": {
      "accent": "#57b86b",
      "dark": "#102416"
    },
    "presentation": {
      "title": "荒野生存",
      "originalTitle": "Suroi",
      "mark": "生存",
      "category": "多人俯视角生存竞技",
      "tagline": "搜集装备、躲避危险，在荒野中成为最后的幸存者。",
      "description": "搜集装备、躲避毒圈、判断枪声方向，在不断缩小的战场中寻找机会，成为最后的幸存者。",
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
      "highlights": [
        "搜集枪械、护甲和投掷物",
        "在毒圈变化中寻找路线和时机",
        "单排、双排与四排带来不同的生存节奏"
      ],
      "art": {},
      "availability": {
        "state": "external",
        "label": "在线体验"
      },
      "actionLabel": "前往体验"
    },
    "platform": {
      "hosting": "server",
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
    }
  },
  {
    "schemaVersion": 2,
    "id": "sanctuarys-end",
    "order": 4,
    "featured": true,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 4,
      "featuredRank": 3
    },
    "theme": {
      "accent": "#9d72e8",
      "dark": "#1c1428"
    },
    "presentation": {
      "title": "庇护所终章",
      "originalTitle": "Sanctuary’s End",
      "mark": "冒险",
      "category": "暗黑式动作角色扮演",
      "tagline": "深入地下城，在技能与装备之间找到自己的战斗方式。",
      "description": "选择职业、组合技能与装备词条，深入地下城迎战成群怪物和首领，在一次次探索中让角色变得更强。",
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
      "highlights": [
        "四种职业与各自的技能成长",
        "装备词条、商人和锻造带来持续选择",
        "地下城、精英怪与首领战层层推进"
      ],
      "art": {
        "cover": "/games/sanctuarys-end/image.png",
        "hero": "/games/sanctuarys-end/image.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "开始游戏"
    },
    "platform": {
      "hosting": "hybrid",
      "technology": "JavaScript · Three.js · Node.js · WebSocket",
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
    "capabilities": [
      "multiplayer",
      "audio",
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "littlejs-arcade",
    "order": 5,
    "discovery": {
      "audiences": [
        "single",
        "duo"
      ],
      "popularRank": 6
    },
    "theme": {
      "accent": "#f2b942",
      "dark": "#2a210e"
    },
    "presentation": {
      "title": "迷你街机合集",
      "originalTitle": "LittleJS Arcade",
      "mark": "街机",
      "category": "轻量街机合集",
      "tagline": "赛车、生存、台球和坦克，一次打开一整排小游戏。",
      "description": "从赛车、生存、防空到台球和坦克，挑一款短小直接的小游戏，随时开始一局轻松的街机时间。",
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
      "highlights": [
        "赛车、生存、防空、台球和坦克等多种玩法",
        "每款游戏都能快速开始",
        "适合一个人消磨时间，也适合本地轮流挑战"
      ],
      "art": {
        "cover": "/games/littlejs-arcade/images/social_image.png",
        "hero": "/games/littlejs-arcade/images/social_image.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "开始游戏"
    },
    "platform": {
      "hosting": "static",
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
    }
  },
  {
    "schemaVersion": 2,
    "id": "scribble",
    "order": 6,
    "featured": true,
    "discovery": {
      "audiences": [
        "multi"
      ],
      "popularRank": 5,
      "featuredRank": 4
    },
    "theme": {
      "accent": "#4ea7e8",
      "dark": "#102131"
    },
    "presentation": {
      "title": "你画我猜",
      "originalTitle": "Scribble.rs",
      "mark": "画猜",
      "category": "多人派对猜词",
      "tagline": "轮流画画和猜词，把一群人的笑声聚到一起。",
      "description": "轮流画画和猜词，和朋友开一间房，在有限时间里画出提示、抢先猜中答案。",
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
      "highlights": [
        "轮流作画、限时猜词和回合计分",
        "简单规则，朋友第一次玩也能马上加入",
        "每一轮都可能画出意料之外的答案"
      ],
      "art": {},
      "availability": {
        "state": "external",
        "label": "在线体验"
      },
      "actionLabel": "前往体验"
    },
    "platform": {
      "hosting": "server",
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
    }
  },
  {
    "schemaVersion": 2,
    "id": "pvp-arena",
    "order": 7,
    "discovery": {
      "audiences": [
        "duo",
        "multi"
      ],
      "popularRank": 7
    },
    "theme": {
      "accent": "#e45272",
      "dark": "#28121a"
    },
    "presentation": {
      "title": "像素竞技场",
      "originalTitle": "PVP",
      "mark": "对战",
      "category": "复古多人竞技场射击",
      "tagline": "拾起武器，在像素竞技场里快速决出胜负。",
      "description": "在小地图中高速移动、拾取武器，与身边的朋友或远方的对手展开一场节奏明快的短局对战。",
      "tags": [
        "1–4 人",
        "射击",
        "本地对战"
      ],
      "play": {
        "modes": "本地对战 / 远程对战",
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
      "highlights": [
        "一台电脑多人同屏",
        "拾取武器，在小地图中快速周旋",
        "规则短平快，适合随时再开一局"
      ],
      "art": {
        "cover": "/games/pvp-arena/client/screenshot.png",
        "hero": "/games/pvp-arena/client/screenshot.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "开始游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "原生 JavaScript · Socket.IO · PeerJS",
      "license": "MIT / GPL-3.0（上游双文件均保留）",
      "sourceUrl": "https://github.com/kesiev/pvp",
      "localization": "主菜单、启动设置、模式规则、操作说明、HUD、结算、联机大厅与错误提示均已汉化（专属词表 client/js/i18n/zh-CN.js，优先于公共 bridge）；玩家昵称和地图专名保留原文。",
      "fit": "短局节奏直接，本地多人和 WebRTC 代码值得拆看，但成品视觉不符合当前游戏厅定位。",
      "highlights": [
        "一台电脑多人同屏",
        "局域网和 PeerJS 实验路径",
        "地图与武器机制足够简洁"
      ],
      "cautions": [
        "使用前必须逐文件澄清许可",
        "远程对战依赖雨晴自建 PeerJS 信令与 TURN；未配置 WEBRTC_SERVICE_URL 时会明确提示而不会回退到公共服务",
        "复古美术只能做玩法参考"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/pvp-arena/client/index.html",
        "upstreamUrl": "https://www.kesiev.com/pvp/"
      }
    }
  },
  {
    "schemaVersion": 2,
    "id": "tosios",
    "order": 8,
    "discovery": {
      "audiences": [
        "multi"
      ],
      "popularRank": 9
    },
    "theme": {
      "accent": "#ef8754",
      "dark": "#2a170f"
    },
    "presentation": {
      "title": "双队乱斗",
      "originalTitle": "TOSIOS",
      "mark": "乱斗",
      "category": "多人 2D 竞技射击",
      "tagline": "在紧凑地图中组队交锋，抢下属于你的胜利。",
      "description": "在紧凑地图中进行死亡竞赛或团队战，灵活走位、瞄准射击，与对手争夺每一分优势。",
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
      "highlights": [
        "死亡竞赛与团队模式自由切换",
        "紧凑地图带来连续交锋",
        "适合和朋友组队来一场短局对抗"
      ],
      "art": {},
      "availability": {
        "state": "external",
        "label": "在线体验"
      },
      "actionLabel": "前往体验"
    },
    "platform": {
      "hosting": "server",
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
    }
  },
  {
    "schemaVersion": 2,
    "id": "hexgl",
    "order": 9,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 8
    },
    "theme": {
      "accent": "#3dcbd1",
      "dark": "#0d2225"
    },
    "presentation": {
      "title": "极速光轨",
      "originalTitle": "HexGL",
      "mark": "竞速",
      "category": "未来悬浮竞速",
      "tagline": "驾驶悬浮载具冲过霓虹赛道，刷新自己的纪录。",
      "description": "驾驶高速悬浮载具穿越霓虹赛道，在连续弯道和急速镜头中保持路线，挑战更快的计时成绩。",
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
      "highlights": [
        "霓虹赛道与高速悬浮驾驶",
        "计时挑战和幽灵回放",
        "适合一遍遍熟悉路线、刷新纪录"
      ],
      "art": {
        "cover": "/games/hexgl/css/mobile.jpg",
        "hero": "/games/hexgl/css/mobile.jpg"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "开始游戏"
    },
    "platform": {
      "hosting": "static",
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
    }
  },
  {
    "schemaVersion": 2,
    "id": "openfront",
    "order": 10,
    "discovery": {
      "audiences": [
        "multi"
      ],
      "popularRank": 10
    },
    "theme": {
      "accent": "#6d8ee8",
      "dark": "#121a2c"
    },
    "presentation": {
      "title": "世界前线",
      "originalTitle": "OpenFrontIO",
      "mark": "策略",
      "category": "大规模多人领土策略",
      "tagline": "在世界地图上扩张领地，和大量玩家争夺胜利。",
      "description": "从一小片领地开始扩张，调配兵力、判断局势，与大量玩家在世界地图上争夺最终控制权。",
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
      "highlights": [
        "大地图领土扩张与兵力调配",
        "和大量玩家同场博弈",
        "每局局势都会随着选择不断变化"
      ],
      "art": {},
      "availability": {
        "state": "external",
        "label": "在线体验"
      },
      "actionLabel": "前往体验"
    },
    "platform": {
      "hosting": "server",
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
    }
  },
  {
    "schemaVersion": 2,
    "id": "kaetram",
    "order": 11,
    "discovery": {
      "audiences": [
        "multi"
      ],
      "popularRank": 11
    },
    "theme": {
      "accent": "#b58a5a",
      "dark": "#271d13"
    },
    "presentation": {
      "title": "凯特兰冒险",
      "originalTitle": "Kaetram Open",
      "mark": "MMO",
      "category": "像素多人在线角色扮演",
      "tagline": "探索像素世界，接取任务并挑战怪物与首领。",
      "description": "探索像素世界、接取任务、挑战怪物与首领，和其他玩家一起在持续变化的大陆上冒险。",
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
      "highlights": [
        "任务、怪物与首领挑战",
        "像素地图和多个探索区域",
        "持续世界中的多人冒险体验"
      ],
      "art": {},
      "availability": {
        "state": "unavailable",
        "label": "暂不可用"
      },
      "actionLabel": "暂不可用"
    },
    "platform": {
      "hosting": "restricted",
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
  }
] as const satisfies readonly GameManifest[];
