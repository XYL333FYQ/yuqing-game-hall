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
// - public/games/doudizhu/game.json
// - public/games/guandan/game.json
// - public/games/mahjong/game.json
// - public/games/gobang/game.json
// - public/games/a-dark-room/game.json
// - public/games/gridland/game.json
// - public/games/tiny-yurts/game.json
// - public/games/casual-crusade/game.json
// - public/games/infernal-throne/game.json
// - public/games/underrun/game.json
// - public/games/xx142-b2/game.json
// - public/games/packabunchas/game.json
// - public/games/bounce-back/game.json
// - public/games/super-castle/game.json
// - public/games/norman-necromancer/game.json
// - public/games/the-neatness/game.json
// - public/games/backcountry/game.json
// - public/games/radius-raid/game.json
// - public/games/elematter/game.json
// - public/games/bee-kind/game.json
// - public/games/rat-plague/game.json
// - public/games/hextris/game.json
// - public/games/thirteenth-floor/game.json
// - public/games/khan/game.json
// - public/games/classic-tower-defense/game.json
// - public/games/classic-2048/game.json
// - public/games/classic-tetris/game.json
// - public/games/classic-breakout/game.json
// - public/games/sokoban-100/game.json
// - public/games/chinese-chess/game.json
// - public/games/othello/game.json
// - public/games/breaklock/game.json
// - public/games/minesweeper/game.json
// - public/games/asteroids/game.json
// - public/games/binary-puzzle/game.json
// - public/games/visible-dots/game.json
// - public/games/mahjong-solitaire/game.json
// - public/games/sudoku/game.json
// - public/games/klondike/game.json
// - public/games/nonograms/game.json
// - public/games/connect-four/game.json
// - public/games/international-chess/game.json
// - public/games/battleship/game.json
// - public/games/snake-classic/game.json
// - public/games/color-lines/game.json
// - public/games/tower-building/game.json
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
  },
  {
    "schemaVersion": 2,
    "id": "doudizhu",
    "order": 12,
    "discovery": {
      "audiences": [
        "single",
        "duo",
        "multi"
      ],
      "popularRank": 12
    },
    "theme": {
      "accent": "#b84e38",
      "dark": "#173b2b"
    },
    "presentation": {
      "title": "斗地主",
      "originalTitle": "Dou Dizhu Online",
      "mark": "棋牌",
      "category": "好友纸牌对战",
      "tagline": "叫地主、打配合，约朋友开一桌。",
      "description": "经典三人斗地主与二人对决，支持癞子和不洗牌玩法。邀请朋友用房间码加入，也可以让 AI 陪你单机练习。",
      "tags": [
        "棋牌",
        "斗地主",
        "好友联机",
        "单人"
      ],
      "play": {
        "modes": "经典三人 / 二人对决 / 癞子 / 不洗牌",
        "players": "1–3 人",
        "controls": "鼠标点击选择与操作",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "用房间码邀请一到两位朋友",
        "空位由 AI 补齐，也可离线练习",
        "出牌提示、快捷聊天与合成音效"
      ],
      "art": {
        "cover": "/games/doudizhu/cover.svg",
        "hero": "/games/doudizhu/cover.svg"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "hybrid",
      "technology": "原生 JavaScript · PeerJS · WebRTC",
      "license": "MIT；依赖组件许可见 THIRD_PARTY_NOTICES.md",
      "sourceUrl": "https://github.com/DavidWang1231/doudizhu-online",
      "localization": "中文界面；保留原作玩法，接入自建服务运行时配置。",
      "fit": "复用现有自建 PeerJS/STUN/TURN；牌局由房主浏览器裁决，无专用游戏后端。",
      "highlights": [
        "用房间码邀请一到两位朋友",
        "空位由 AI 补齐，也可离线练习",
        "出牌提示、快捷聊天与合成音效"
      ],
      "cautions": [
        "好友联机需配置 WEBRTC_SERVICE_URL",
        "房主退出会结束好友牌局",
        "仅用于好友休闲对局，不提供竞技反作弊保证"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/doudizhu/index.html"
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
    "id": "guandan",
    "order": 13,
    "discovery": {
      "audiences": [
        "single",
        "multi"
      ],
      "popularRank": 13
    },
    "theme": {
      "accent": "#cc9b42",
      "dark": "#153f38"
    },
    "presentation": {
      "title": "掼蛋",
      "originalTitle": "CardRoomPro · Guandan",
      "mark": "棋牌",
      "category": "四人组队纸牌",
      "tagline": "和对家打配合，用一手好牌争先出完。",
      "description": "四人两副牌、固定对家和红桃级牌逢人配。开公开房或私密房邀请朋友，人数不足时召唤 AI 补齐座位。",
      "tags": [
        "棋牌",
        "掼蛋",
        "组队",
        "好友联机"
      ],
      "play": {
        "modes": "好友房间 / AI 补位 / 观战",
        "players": "1–4 人参与，4 个座位",
        "controls": "鼠标点击选择与操作",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "房间号邀请、公开房与实时观战",
        "固定对家、级牌升级与逢人配",
        "AI 陪练、出牌建议与断线恢复"
      ],
      "art": {
        "cover": "/games/guandan/cover.svg",
        "hero": "/games/guandan/cover.svg"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "hybrid",
      "technology": "Vue 2 · Socket.IO · Node.js",
      "license": "MIT；依赖组件许可见 THIRD_PARTY_NOTICES.md",
      "sourceUrl": "https://github.com/TypeThe0ry/CardRoomPro",
      "localization": "中文界面；保留原作玩法，接入自建服务运行时配置。",
      "fit": "静态游戏页面与纯数据后端分离；和麻将共用 CARD_ROOM_SERVICE_URL。",
      "highlights": [
        "房间号邀请、公开房与实时观战",
        "固定对家、级牌升级与逢人配",
        "AI 陪练、出牌建议与断线恢复"
      ],
      "cautions": [
        "包括 AI 陪练在内均需要牌房后端",
        "采用访客与内存模式，重启不保留战绩和牌局",
        "规则以本运行版本为准，并非所有地方掼蛋变体"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/guandan/index.html"
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
    "id": "mahjong",
    "order": 14,
    "discovery": {
      "audiences": [
        "single",
        "multi"
      ],
      "popularRank": 14
    },
    "theme": {
      "accent": "#6e9569",
      "dark": "#163731"
    },
    "presentation": {
      "title": "四人麻将",
      "originalTitle": "CardRoomPro · Mahjong",
      "mark": "棋牌",
      "category": "四人休闲牌桌",
      "tagline": "摸牌、吃碰杠胡，约朋友坐满一桌。",
      "description": "四人麻将牌桌，支持摸牌、出牌、吃碰杠胡与实时观战。用房间号约朋友，也可以邀请 AI 填满空位进行练习。",
      "tags": [
        "棋牌",
        "麻将",
        "好友联机",
        "休闲"
      ],
      "play": {
        "modes": "好友房间 / AI 补位 / 观战",
        "players": "1–4 人参与，4 个座位",
        "controls": "鼠标点击选择与操作",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "四方牌桌与清晰的牌河",
        "邀请 AI 陪练和查看出牌建议",
        "房间码加入与短线恢复"
      ],
      "art": {
        "cover": "/games/mahjong/cover.svg",
        "hero": "/games/mahjong/cover.svg"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "hybrid",
      "technology": "Vue 2 · Socket.IO · Node.js",
      "license": "MIT；依赖组件许可见 THIRD_PARTY_NOTICES.md",
      "sourceUrl": "https://github.com/TypeThe0ry/CardRoomPro",
      "localization": "中文界面；保留原作玩法，接入自建服务运行时配置。",
      "fit": "静态游戏页面与纯数据后端分离；和掼蛋共用 CARD_ROOM_SERVICE_URL。",
      "highlights": [
        "四方牌桌与清晰的牌河",
        "邀请 AI 陪练和查看出牌建议",
        "房间码加入与短线恢复"
      ],
      "cautions": [
        "包括 AI 陪练在内均需要牌房后端",
        "采用上游基础四人规则，不等同于各地麻将规则",
        "访客与内存模式，重启不保留战绩和牌局"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/mahjong/index.html"
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
    "id": "gobang",
    "order": 15,
    "discovery": {
      "audiences": [
        "duo",
        "multi"
      ],
      "popularRank": 15
    },
    "theme": {
      "accent": "#98613b",
      "dark": "#352b23"
    },
    "presentation": {
      "title": "五子棋",
      "originalTitle": "HullQin · Gobang",
      "mark": "棋牌",
      "category": "双人棋盘对弈",
      "tagline": "黑白轮流落子，抢先连成五颗。",
      "description": "在十五路棋盘上轮流落子，横、竖或斜向连成五颗即可获胜。支持同屏双人、好友房间和旁观，重新进入房间可以继续棋局。",
      "tags": [
        "棋牌",
        "五子棋",
        "本地双人",
        "好友联机"
      ],
      "play": {
        "modes": "好友房间 / 同屏双人 / 观战",
        "players": "2 人对弈，可旁观",
        "controls": "鼠标点击选择与操作",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "无需登录，用同一个房间号对弈",
        "同屏双人随时开局",
        "完整连五判断与房间棋局恢复"
      ],
      "art": {
        "cover": "/games/gobang/cover.svg",
        "hero": "/games/gobang/cover.svg"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "hybrid",
      "technology": "原生 JavaScript · SVG · Node.js · WebSocket",
      "license": "MIT；依赖组件许可见 THIRD_PARTY_NOTICES.md",
      "sourceUrl": "https://github.com/HullQin/gobang",
      "localization": "中文界面；保留原作玩法，接入自建服务运行时配置。",
      "fit": "沿用上游棋盘与消息协议，后端移植为独立 Node 服务，并校验轮次、占位与胜负。",
      "highlights": [
        "无需登录，用同一个房间号对弈",
        "同屏双人随时开局",
        "完整连五判断与房间棋局恢复"
      ],
      "cautions": [
        "自由五子棋，不使用连珠禁手规则",
        "无 AI，人少时可玩同屏双人",
        "联机需配置 GOBANG_SERVICE_URL，后端重启会清空房间"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/gobang/index.html"
      }
    },
    "capabilities": [
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
    "id": "a-dark-room",
    "order": 16,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 16
    },
    "theme": {
      "accent": "#b67b45",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "小黑屋",
      "originalTitle": "A Dark Room",
      "mark": "生存",
      "category": "生存经营",
      "tagline": "从一簇火开始，慢慢揭开荒野的秘密。",
      "description": "先点亮火堆，收集木材、扩建村落，再带上装备探索荒野。故事和新玩法随着发展逐步展开。",
      "tags": [
        "生存",
        "经营",
        "冒险",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "鼠标点击按钮；探索时用方向键或 WASD。",
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
        "从一簇火开始，慢慢揭开荒野的秘密。",
        "前期不要急着外出，先让村落稳定生产。"
      ],
      "art": {
        "cover": "/games/a-dark-room/cover.png",
        "hero": "/games/a-dark-room/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MPL-2.0",
      "sourceUrl": "https://github.com/doublespeakgames/adarkroom",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "从一簇火开始，慢慢揭开荒野的秘密。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/a-dark-room/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "gridland",
    "order": 17,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 17
    },
    "theme": {
      "accent": "#769b69",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "格子大陆",
      "originalTitle": "Gridland",
      "mark": "生存",
      "category": "消除生存",
      "tagline": "白天盖房，夜晚迎战，消除决定你的命运。",
      "description": "白天交换图块收集资源、建设据点；入夜后同样的棋盘变成战场，要同时考虑武器、护甲与怪物。",
      "tags": [
        "生存",
        "经营",
        "消除",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "鼠标拖动相邻图块交换，连成三个或更多。",
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
        "白天盖房，夜晚迎战，消除决定你的命运。",
        "白天可以慢慢规划，夜晚要留意敌人和生命。"
      ],
      "art": {
        "cover": "/games/gridland/cover.png",
        "hero": "/games/gridland/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MPL-2.0",
      "sourceUrl": "https://github.com/doublespeakgames/gridland",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "白天盖房，夜晚迎战，消除决定你的命运。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/gridland/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "tiny-yurts",
    "order": 18,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 18
    },
    "theme": {
      "accent": "#90a166",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "小小牧场",
      "originalTitle": "Tiny Yurts",
      "mark": "经营",
      "category": "道路经营",
      "tagline": "为牧场铺路，让每一个小家都忙得过来。",
      "description": "拖出道路，把不同颜色的毡房与牧场相连。动物越来越多，有限道路和拥堵让每次扩建都需要取舍。",
      "tags": [
        "经营",
        "策略",
        "休闲",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "按住鼠标拖动铺路；右键删除；空格暂停。",
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
        "为牧场铺路，让每一个小家都忙得过来。",
        "可以暂停后规划道路；住户需要往返，别只接通一头。"
      ],
      "art": {
        "cover": "/games/tiny-yurts/cover.png",
        "hero": "/games/tiny-yurts/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/js13kGames/tiny-yurts",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "为牧场铺路，让每一个小家都忙得过来。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/tiny-yurts/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "casual-crusade",
    "order": 19,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 19
    },
    "theme": {
      "accent": "#cea873",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "纸牌远征",
      "originalTitle": "Casual Crusade",
      "mark": "策略",
      "category": "路线策略",
      "tagline": "铺下卡牌，为勇士开出一条冒险之路。",
      "description": "把手中的道路卡放进棋盘，连接宝物、战斗和出口。方向、生命与战利品一起决定下一步走向。",
      "tags": [
        "策略",
        "卡牌",
        "冒险",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "鼠标拖动道路卡，点击卡牌旋转，连接到勇士所在道路。",
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
        "铺下卡牌，为勇士开出一条冒险之路。",
        "先看卡牌方向，避免把自己引向无法离开的死路。"
      ],
      "art": {
        "cover": "/games/casual-crusade/cover.png",
        "hero": "/games/casual-crusade/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/js13kGames/casual-crusade",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "铺下卡牌，为勇士开出一条冒险之路。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/casual-crusade/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "infernal-throne",
    "order": 20,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 20
    },
    "theme": {
      "accent": "#cd6544",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "夺回地狱王座",
      "originalTitle": "Infernal Throne",
      "mark": "动作",
      "category": "探索闯关",
      "tagline": "找回失去的力量，重返地狱王座。",
      "description": "探索互相连通的地下世界，打败敌人、找回能力，解锁之前到不了的区域。地图与能力成长让路线逐渐展开。",
      "tags": [
        "动作",
        "探索",
        "冒险",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "方向键移动，Z 跳跃，X 攻击，C / V 使用能力，M 地图。",
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
        "找回失去的力量，重返地狱王座。",
        "新能力也能帮助探索旧区域；不确定方向时查看地图。"
      ],
      "art": {
        "cover": "/games/infernal-throne/cover.png",
        "hero": "/games/infernal-throne/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/arikwex/infernal-sigil",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "找回失去的力量，重返地狱王座。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/infernal-throne/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "underrun",
    "order": 21,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 21
    },
    "theme": {
      "accent": "#da8a40",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "深层突围",
      "originalTitle": "UNDERRUN",
      "mark": "射击",
      "category": "科幻射击",
      "tagline": "清除失控机械，夺回地下设施。",
      "description": "穿过昏暗的立体设施，瞄准并消灭蜘蛛机器人与炮台，找到关键终端。光影、弹幕和路线探索构成紧凑战斗。",
      "tags": [
        "射击",
        "科幻",
        "动作",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "WASD 移动，鼠标瞄准，按住左键射击。",
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
        "清除失控机械，夺回地下设施。",
        "移动射击比站着对射更安全，寻找能恢复生命的拾取物。"
      ],
      "art": {
        "cover": "/games/underrun/cover.png",
        "hero": "/games/underrun/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/phoboslab/underrun",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "清除失控机械，夺回地下设施。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/underrun/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "xx142-b2",
    "order": 22,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 22
    },
    "theme": {
      "accent": "#48bbaa",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "十三秒回溯",
      "originalTitle": "xx142-b2.exe",
      "mark": "解谜",
      "category": "时间循环解谜",
      "tagline": "每次只有十三秒，让过去的自己帮你破局。",
      "description": "作为潜入网络的程序，利用短暂生命探索机关。失败留下的行动轨迹会继续重演，配合过去的自己破解防线。",
      "tags": [
        "解谜",
        "时间循环",
        "科幻",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "WASD 或方向键移动；Backspace 提前结束当前循环。",
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
        "每次只有十三秒，让过去的自己帮你破局。",
        "先让一个回溯分身压住开关，再在下一轮继续前进。"
      ],
      "art": {
        "cover": "/games/xx142-b2/cover.png",
        "hero": "/games/xx142-b2/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/js13kGames/xx142-b2.exe",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "每次只有十三秒，让过去的自己帮你破局。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/xx142-b2/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "packabunchas",
    "order": 23,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 23
    },
    "theme": {
      "accent": "#d6a235",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "星际打包救援",
      "originalTitle": "PACKABUNCHAS",
      "mark": "益智",
      "category": "拼图救援",
      "tagline": "旋转、挪动，把所有小伙伴装进救援舱。",
      "description": "在五种模式里解决形状不同的拼图，把等待救援的生物安排进有限空间。没有倒计时，可以慢慢研究。",
      "tags": [
        "益智",
        "拼图",
        "休闲",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "鼠标拖放拼块，双击旋转。",
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
        "旋转、挪动，把所有小伙伴装进救援舱。",
        "先考虑最难放的大块，留意拐角空位。"
      ],
      "art": {
        "cover": "/games/packabunchas/cover.png",
        "hero": "/games/packabunchas/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/js13kGames/packabunchas",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "旋转、挪动，把所有小伙伴装进救援舱。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/packabunchas/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "bounce-back",
    "order": 24,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 24
    },
    "theme": {
      "accent": "#bd875c",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "回旋镖勇者",
      "originalTitle": "Bounce Back",
      "mark": "动作",
      "category": "随机地牢动作",
      "tagline": "投出回旋镖、冲刺闪避，打穿十层荒野。",
      "description": "随机地图里搜集宝石、购买道具，挑战不同敌人和最终首领。回旋镖要飞回来，走位和投掷时机同样重要。",
      "tags": [
        "动作",
        "随机地图",
        "成长",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "WASD 移动，鼠标瞄准，左键投掷，空格冲刺。",
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
        "投出回旋镖、冲刺闪避，打穿十层荒野。",
        "冲刺可以躲避伤害，死亡后宝石仍保留，可继续买装备。"
      ],
      "art": {
        "cover": "/games/bounce-back/cover.png",
        "hero": "/games/bounce-back/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "GPL-2.0-or-later",
      "sourceUrl": "https://github.com/js13kGames/bounce-back",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "投出回旋镖、冲刺闪避，打穿十层荒野。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/bounce-back/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "super-castle",
    "order": 25,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 25
    },
    "theme": {
      "accent": "#cb765a",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "积木城堡",
      "originalTitle": "Super Castle Game",
      "mark": "动作",
      "category": "积木解谜",
      "tagline": "移动彩色积木，把零散方块组合成城堡。",
      "description": "在立体棋盘上推动整组积木，把分散的方块连成完整城堡。不同方向与形状带来精巧关卡，支持重试和选关。",
      "tags": [
        "益智",
        "解谜",
        "建造",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "方向键或 WASD 移动；R 重试；可点击画面操作。",
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
        "移动彩色积木，把零散方块组合成城堡。",
        "先观察同色积木的位置，移动的是整组方块。"
      ],
      "art": {
        "cover": "/games/super-castle/cover.png",
        "hero": "/games/super-castle/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "GPL-3.0-only",
      "sourceUrl": "https://github.com/js13kGames/super-castle-game",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "移动彩色积木，把零散方块组合成城堡。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/super-castle/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "norman-necromancer",
    "order": 26,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 26
    },
    "theme": {
      "accent": "#b587c3",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "亡灵法师诺曼",
      "originalTitle": "Norman the Necromancer",
      "mark": "冒险",
      "category": "亡灵冒险",
      "tagline": "带着亡灵伙伴，穿过危机四伏的旅程。",
      "description": "在横版竞技场抵挡敌人，施放法术，把倒下的敌人复活成亡灵伙伴。每关结束可用灵魂强化能力，组合出不同战斗流派。",
      "tags": [
        "冒险",
        "动作",
        "像素",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "WASD / 方向键移动，鼠标瞄准，左键施法，空格复活亡灵。",
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
        "带着亡灵伙伴，穿过危机四伏的旅程。",
        "复活伙伴协助作战，每关结束可以选择新的法术与仪式。"
      ],
      "art": {
        "cover": "/games/norman-necromancer/cover.png",
        "hero": "/games/norman-necromancer/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "Unlicense",
      "sourceUrl": "https://github.com/danprince/js13k-2022",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "带着亡灵伙伴，穿过危机四伏的旅程。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/norman-necromancer/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "the-neatness",
    "order": 27,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 27
    },
    "theme": {
      "accent": "#7bb0aa",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "线索迷境",
      "originalTitle": "The Neatness",
      "mark": "益智",
      "category": "连线解谜",
      "tagline": "看似简单的线条，藏着一层又一层规则。",
      "description": "在迷宫般的线条图案中寻找正确路线。关卡逐渐加入新规则，需要观察图形和反馈，而不仅仅是连起两点。",
      "tags": [
        "益智",
        "解谜",
        "逻辑",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "按住鼠标从起点拖向终点，避开障碍；两侧的路径会同时变化。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "看似简单的线条，藏着一层又一层规则。",
        "先观察两侧的障碍，画出一条能同时连通的路线。"
      ],
      "art": {
        "cover": "/games/the-neatness/cover.png",
        "hero": "/games/the-neatness/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "GPL-3.0-only",
      "sourceUrl": "https://github.com/mvasilkov/neatness2022",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "看似简单的线条，藏着一层又一层规则。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/the-neatness/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "backcountry",
    "order": 28,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 28
    },
    "theme": {
      "accent": "#cf9865",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "荒野赏金",
      "originalTitle": "Backcountry",
      "mark": "竞速",
      "category": "西部赏金冒险",
      "tagline": "接下通缉令，在西部荒野赚取赏金。",
      "description": "在立体西部小镇接下通缉任务，移动、追击并攻击敌人，完成任务后领取赏金。每日地图会变化，行动与战斗都由鼠标控制。",
      "tags": [
        "动作",
        "射击",
        "随机地图",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "鼠标点击地面移动；点击敌人攻击；在小镇接受任务。",
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
        "接下通缉令，在西部荒野赚取赏金。",
        "接下通缉任务后再出城，利用走位避免被敌人围住。"
      ],
      "art": {
        "cover": "/games/backcountry/cover.png",
        "hero": "/games/backcountry/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "ISC",
      "sourceUrl": "https://github.com/js13kGames/backcountry",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "接下通缉令，在西部荒野赚取赏金。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/backcountry/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "radius-raid",
    "order": 29,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 29
    },
    "theme": {
      "accent": "#5da8c5",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "霓虹突袭",
      "originalTitle": "Radius Raid",
      "mark": "射击",
      "category": "街机射击",
      "tagline": "一边走位一边瞄准，穿过不断涌来的敌群。",
      "description": "在霓虹竞技场内面对不断升级的敌群，拾取强化并坚持更久。移动、瞄准和弹幕躲避同时进行。",
      "tags": [
        "射击",
        "街机",
        "挑战",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "WASD 或方向键移动；鼠标瞄准，左键射击；P 暂停。",
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
        "一边走位一边瞄准，穿过不断涌来的敌群。",
        "围着敌群走位，优先获取强化，避免被围住。"
      ],
      "art": {
        "cover": "/games/radius-raid/cover.png",
        "hero": "/games/radius-raid/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/jackrugile/radius-raid-js13k",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "一边走位一边瞄准，穿过不断涌来的敌群。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/radius-raid/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "elematter",
    "order": 30,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 30
    },
    "theme": {
      "accent": "#caa461",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "元素防线",
      "originalTitle": "Elematter",
      "mark": "塔防",
      "category": "塔防策略",
      "tagline": "用有限资源筑起防线，守住一波又一波敌人。",
      "description": "在入侵路线附近布局和强化防御，平衡收入与火力。随着敌人变强，旧的布阵也需要调整。",
      "tags": [
        "塔防",
        "策略",
        "防守",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "鼠标选择位置放置防御；根据界面提示升级和开始波次。",
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
        "用有限资源筑起防线，守住一波又一波敌人。",
        "先覆盖路线的关键位置，升级往往比一味铺满更有效。"
      ],
      "art": {
        "cover": "/games/elematter/cover.png",
        "hero": "/games/elematter/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/jackrugile/elematter-js13k",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "用有限资源筑起防线，守住一波又一波敌人。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/elematter/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "bee-kind",
    "order": 31,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 31
    },
    "theme": {
      "accent": "#c5aa53",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "守护蜜蜂",
      "originalTitle": "Bee Kind",
      "mark": "冒险",
      "category": "生态冒险",
      "tagline": "护住蜂巢，带小蜜蜂们度过危机。",
      "description": "扮演养蜂兔子，在横版和俯视地图之间穿梭。保护蜂巢、收集蜂蜜和武器，阻止敌人破坏正在成长的蜂群。",
      "tags": [
        "冒险",
        "像素",
        "防守",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "方向键移动；上方向键跳跃；回车、空格或 Shift 使用蜂蜜枪。",
        "inputs": [
          "keyboard"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "护住蜂巢，带小蜜蜂们度过危机。",
        "关注蜂巢附近的敌人，幼虫吃到蘑菇后会成为威胁。"
      ],
      "art": {
        "cover": "/games/bee-kind/cover.png",
        "hero": "/games/bee-kind/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/picosonic/js13k-2022",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "护住蜂巢，带小蜜蜂们度过危机。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/bee-kind/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "rat-plague",
    "order": 32,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 32
    },
    "theme": {
      "accent": "#96ad66",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "鼠疫小镇",
      "originalTitle": "Rat Plague",
      "mark": "冒险",
      "category": "小镇探索",
      "tagline": "寻找药水与钥匙，救下被鼠疫侵袭的小镇。",
      "description": "探索房屋与地下区域，打开宝箱、寻找钥匙。观察村民身上的颜色，用对应药水治疗，同时阻止老鼠继续传播感染。",
      "tags": [
        "冒险",
        "探索",
        "策略",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "鼠标点击目的地或目标；点击药水与物品使用。",
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
        "寻找药水与钥匙，救下被鼠疫侵袭的小镇。",
        "药水颜色要对应村民的症状，白色药水可以治疗任意颜色。"
      ],
      "art": {
        "cover": "/games/rat-plague/cover.png",
        "hero": "/games/rat-plague/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/picosonic/js13k-2023",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "寻找药水与钥匙，救下被鼠疫侵袭的小镇。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/rat-plague/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "hextris",
    "order": 33,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 33
    },
    "theme": {
      "accent": "#579fc4",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "六边形消除",
      "originalTitle": "Hextris",
      "mark": "消除",
      "category": "旋转消除",
      "tagline": "旋转六边形，让坠落色块连成一片。",
      "description": "旋转中央六边形，把落下的色块堆在六个面上。同色连成片即可消除，连续消除带来更高分数，也腾出更大空间。",
      "tags": [
        "消除",
        "益智",
        "街机",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "左右方向键或 A / D 旋转；空格暂停。",
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
        "旋转六边形，让坠落色块连成一片。",
        "相邻两个面的同色块也能形成连接，不要只盯一个面。"
      ],
      "art": {
        "cover": "/games/hextris/cover.png",
        "hero": "/games/hextris/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "GPL-3.0-or-later",
      "sourceUrl": "https://github.com/Hextris/hextris",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "旋转六边形，让坠落色块连成一片。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/hextris/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "thirteenth-floor",
    "order": 34,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 34
    },
    "theme": {
      "accent": "#9b8e78",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "第十三层",
      "originalTitle": "13th Floor",
      "mark": "惊悚",
      "category": "潜行惊悚",
      "tagline": "找齐房间钥匙，记得躲进黑暗。",
      "description": "在神秘楼层寻找下一把钥匙，逐个打开房间。手电筒能帮你看清道路，也可能暴露位置，追逐到来时要迅速藏身。",
      "tags": [
        "惊悚",
        "潜行",
        "探索",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "WASD 移动，鼠标转向，E 或左键互动，F 手电筒。",
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
        "找齐房间钥匙，记得躲进黑暗。",
        "留意追踪者的灯光；被发现时关灯、转弯并躲进房间。"
      ],
      "art": {
        "cover": "/games/thirteenth-floor/cover.png",
        "hero": "/games/thirteenth-floor/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/js13kGames/13th-floor",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "找齐房间钥匙，记得躲进黑暗。"
      ],
      "cautions": [
        "包含追逐与惊悚元素；需要桌面浏览器和 WebGL2。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/thirteenth-floor/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "khan",
    "order": 35,
    "discovery": {
      "audiences": [
        "single"
      ],
      "popularRank": 35
    },
    "theme": {
      "accent": "#b99664",
      "dark": "#252a29"
    },
    "presentation": {
      "title": "可汗卡牌地牢",
      "originalTitle": "KHAN",
      "mark": "卡牌",
      "category": "卡牌地牢",
      "tagline": "看清敌人意图，组出属于你的战斗牌组。",
      "description": "每回合选择卡牌来攻击、防守或削弱敌人。走过新区域后挑选新牌与能力，逐步搭出牌组，挑战旅途末端的国王。",
      "tags": [
        "卡牌",
        "策略",
        "地牢",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "选择手牌后点击敌人或自己出牌；结束回合后等待敌人行动。升级时选择卡牌并确认。",
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
        "看清敌人意图，组出属于你的战斗牌组。",
        "先看敌人下一回合的行动；防御与削弱能帮助你活到终点。"
      ],
      "art": {
        "cover": "/games/khan/cover.png",
        "hero": "/games/khan/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "浏览器独立游戏运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/BenjaminWFox/KHAN-js13k-2023",
      "localization": "中文菜单、操作提示和主要规则；保留原作署名。",
      "fit": "独立运行包与 JSON 清单；无需新增 VPS 服务。",
      "highlights": [
        "看清敌人意图，组出属于你的战斗牌组。"
      ],
      "cautions": [
        "单人游戏，无需房间服务器；如有本地存档，不会自动跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/khan/index.html"
      }
    },
    "capabilities": [
      "audio",
      "fullscreen"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "classic-tower-defense",
    "order": 36,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#42946f",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "自由布阵塔防",
      "originalTitle": "HTML5 Tower Defense",
      "mark": "塔防",
      "category": "布阵塔防",
      "tagline": "亲手布置防线，让怪物绕进你的火力网。",
      "description": "用围墙改变怪物路线，搭配机枪、激光等防御设施，升级火力并守住一波波进攻。布阵与资源分配比单纯堆塔更重要。",
      "tags": [
        "塔防",
        "策略",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "鼠标选择建筑和空地放置，点击已建防御塔升级或出售；建好首座武器后自动迎战。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "可以自己改变行进路线",
        "多种防御设施与升级",
        "连续波次考验资源分配"
      ],
      "art": {
        "cover": "/games/classic-tower-defense/cover.png",
        "hero": "/games/classic-tower-defense/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/oldj/html5-tower-defense",
      "localization": "游戏内菜单、玩法说明和主要状态为中文，保留原作署名。",
      "fit": "独立静态运行包，通过 game.json 和 iframe 接入。",
      "highlights": [
        "可以自己改变行进路线",
        "多种防御设施与升级",
        "连续波次考验资源分配"
      ],
      "cautions": [
        "单人玩法；本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/classic-tower-defense/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "classic-2048",
    "order": 37,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#d98b46",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "2048 合成",
      "originalTitle": "2048",
      "mark": "2048",
      "category": "数字合成",
      "tagline": "把相同数字叠在一起，留出通往 2048 的空间。",
      "description": "整盘滑动数字方块，让相同的数字合并。每次操作都会增加新方块，需要提前规划最大数字的位置和空格。可以继续挑战超过 2048 的纪录。",
      "tags": [
        "益智",
        "合成",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "方向键移动整盘方块；手机上向四个方向滑动。",
        "inputs": [
          "keyboard",
          "touch"
        ],
        "devices": [
          "desktop",
          "mobile"
        ],
        "vision": false
      },
      "highlights": [
        "经典合成规则",
        "本地保存棋盘与最高分",
        "电脑与手机均可游玩"
      ],
      "art": {
        "cover": "/games/classic-2048/cover.png",
        "hero": "/games/classic-2048/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/gabrielecirulli/2048",
      "localization": "游戏内菜单、玩法说明和主要状态为中文，保留原作署名。",
      "fit": "独立静态运行包，通过 game.json 和 iframe 接入。",
      "highlights": [
        "经典合成规则",
        "本地保存棋盘与最高分",
        "电脑与手机均可游玩"
      ],
      "cautions": [
        "单人玩法；本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/classic-2048/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "classic-tetris",
    "order": 38,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#6382d1",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "俄罗斯方块",
      "originalTitle": "Javascript Tetris",
      "mark": "方块",
      "category": "方块消行",
      "tagline": "旋转、落下、消行，在越来越快的节奏中坚持。",
      "description": "把七种方块放进棋盘，填满一整行即可消除。随着消行数量增加，方块下落越来越快，观察下一块并为长条留下位置。",
      "tags": [
        "益智",
        "街机",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "空格开始；左右移动，上键旋转，下键加速落下，Esc 结束本局。",
        "inputs": [
          "keyboard"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "七种经典方块",
        "下一块预览",
        "随消行逐渐加速"
      ],
      "art": {
        "cover": "/games/classic-tetris/cover.png",
        "hero": "/games/classic-tetris/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/jakesgordon/javascript-tetris",
      "localization": "游戏内菜单、玩法说明和主要状态为中文，保留原作署名。",
      "fit": "独立静态运行包，通过 game.json 和 iframe 接入。",
      "highlights": [
        "七种经典方块",
        "下一块预览",
        "随消行逐渐加速"
      ],
      "cautions": [
        "单人玩法；本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/classic-tetris/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "classic-breakout",
    "order": 39,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#de704c",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "弹球打砖块",
      "originalTitle": "Javascript Breakout",
      "mark": "弹球",
      "category": "弹球闯关",
      "tagline": "接住每一次反弹，把整面砖墙打得干干净净。",
      "description": "移动挡板反弹小球，清除不同造型的砖块。挡板上的击球位置会改变反弹角度；多种关卡图案、有限生命和最高分让每一局都有目标。",
      "tags": [
        "街机",
        "闯关",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "空格开始或发球；左右方向键或 A / D 移动，菜单中上下切换关卡；手机拖动挡板。",
        "inputs": [
          "keyboard",
          "touch"
        ],
        "devices": [
          "desktop",
          "mobile"
        ],
        "vision": false
      },
      "highlights": [
        "多种砖块关卡",
        "反弹角度由接球位置决定",
        "生命与最高分挑战"
      ],
      "art": {
        "cover": "/games/classic-breakout/cover.png",
        "hero": "/games/classic-breakout/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 运行包",
      "license": "MIT; audio CC-BY-ND-2.0",
      "sourceUrl": "https://github.com/jakesgordon/javascript-breakout",
      "localization": "游戏内菜单、玩法说明和主要状态为中文，保留原作署名。",
      "fit": "独立静态运行包，通过 game.json 和 iframe 接入。",
      "highlights": [
        "多种砖块关卡",
        "反弹角度由接球位置决定",
        "生命与最高分挑战"
      ],
      "cautions": [
        "单人玩法；本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/classic-breakout/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage",
      "audio"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "sokoban-100",
    "order": 40,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#a67e42",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "百关推箱子",
      "originalTitle": "Sokoban",
      "mark": "推箱",
      "category": "仓库解谜",
      "tagline": "箱子能推不能拉，走一步之前先想好退路。",
      "description": "把所有箱子推到目标位置，挑战 100 张不同的仓库地图。狭窄通道与互相挡路的箱子考验移动顺序，可以重玩本关和切换关卡。",
      "tags": [
        "解谜",
        "闯关",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "方向键或 WASD 移动；点击关卡按钮切换或重玩。",
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
        "100 张独立地图",
        "关卡切换与重玩",
        "移动次数记录"
      ],
      "art": {
        "cover": "/games/sokoban-100/cover.png",
        "hero": "/games/sokoban-100/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/shunyue1320/sokoban",
      "localization": "游戏内菜单、玩法说明和主要状态为中文，保留原作署名。",
      "fit": "独立静态运行包，通过 game.json 和 iframe 接入。",
      "highlights": [
        "100 张独立地图",
        "关卡切换与重玩",
        "移动次数记录"
      ],
      "cautions": [
        "单人玩法；本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/sokoban-100/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "chinese-chess",
    "order": 41,
    "discovery": {
      "audiences": [
        "single",
        "duo"
      ]
    },
    "theme": {
      "accent": "#b45840",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "中国象棋",
      "originalTitle": "XiangQi Wizard Light",
      "mark": "象棋",
      "category": "人机对弈",
      "tagline": "楚河汉界之间，用一盘棋检验你的布局。",
      "description": "与象棋小巫师引擎对弈，车马炮配合攻守。可选择三种电脑水平、先后手及让子，支持悔棋和走子记录，也可切换同屏双人对弈。",
      "tags": [
        "棋类",
        "策略",
        "中文"
      ],
      "play": {
        "modes": "人机对弈 / 同屏双人",
        "players": "1–2 人",
        "controls": "点击棋子和目标位置走子；右侧可选电脑水平、悔棋、先后手，修改后点重新开始。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "本地人机对弈",
        "三种电脑水平与让子",
        "悔棋与重新开局"
      ],
      "art": {
        "cover": "/games/chinese-chess/cover.png",
        "hero": "/games/chinese-chess/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 运行包",
      "license": "GPL-2.0-or-later",
      "sourceUrl": "https://github.com/xqbase/xqwlight",
      "localization": "游戏内菜单、玩法说明和主要状态为中文，保留原作署名。",
      "fit": "独立静态运行包，通过 game.json 和 iframe 接入。",
      "highlights": [
        "本地人机对弈",
        "三种电脑水平与让子",
        "悔棋与重新开局"
      ],
      "cautions": [
        "双人模式在同一台设备上对弈，无网络联机。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/chinese-chess/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage",
      "audio"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "othello",
    "order": 42,
    "discovery": {
      "audiences": [
        "duo"
      ]
    },
    "theme": {
      "accent": "#638968",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "黑白棋",
      "originalTitle": "Othello Board",
      "mark": "黑白",
      "category": "同屏双人策略",
      "tagline": "夹住一条棋子，就能让整条战线换成你的颜色。",
      "description": "两人在同一台设备上轮流落子，用横、竖、斜方向夹住对手棋子并翻转。棋盘显示合法落点、双方数量，支持撤销、重做和回合计时。",
      "tags": [
        "棋类",
        "本地双人",
        "策略",
        "中文"
      ],
      "play": {
        "modes": "同屏双人",
        "players": "2 人",
        "controls": "点开始开局，黑白双方轮流点击提示落点；这款是同屏双人玩法。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "同屏双人对弈",
        "合法落点提示",
        "撤销、重做与计时"
      ],
      "art": {
        "cover": "/games/othello/cover.png",
        "hero": "/games/othello/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/NXY666/othello-board",
      "localization": "游戏内菜单、玩法说明和主要状态为中文，保留原作署名。",
      "fit": "独立静态运行包，通过 game.json 和 iframe 接入。",
      "highlights": [
        "同屏双人对弈",
        "合法落点提示",
        "撤销、重做与计时"
      ],
      "cautions": [
        "仅支持同一台设备上的双人对弈，无网络联机。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/othello/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "breaklock",
    "order": 43,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#43b6ab",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "图案解锁",
      "originalTitle": "BreakLock",
      "mark": "解锁",
      "category": "线索推理",
      "tagline": "根据每次尝试的反馈，推理出隐藏的解锁图案。",
      "description": "在九个点之间连线，每次提交都会给出点位与顺序是否正确的反馈。像密码破译一样排除错误答案，可选择练习、限次挑战或一分钟计时。",
      "tags": [
        "解谜",
        "推理",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "选择难度与模式，点开始；按住鼠标或手指连接规定数量的点。",
        "inputs": [
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
        "三种难度",
        "练习、限次与计时模式",
        "每次反馈都能用于排除答案"
      ],
      "art": {
        "cover": "/games/breaklock/cover.png",
        "hero": "/games/breaklock/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/maxwellito/breaklock",
      "localization": "游戏内菜单、玩法说明和主要状态为中文，保留原作署名。",
      "fit": "独立静态运行包，通过 game.json 和 iframe 接入。",
      "highlights": [
        "三种难度",
        "练习、限次与计时模式",
        "每次反馈都能用于排除答案"
      ],
      "cautions": [
        "单人玩法；本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/breaklock/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "minesweeper",
    "order": 44,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#4b98c6",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "经典扫雷",
      "originalTitle": "Minesweeper",
      "mark": "扫雷",
      "category": "数字推理",
      "tagline": "把危险藏在哪里看清楚，用数字推理清空棋盘。",
      "description": "数字表示周围八格的地雷数量。用标记排除危险格，翻开全部安全格即可获胜；提供三档难度、自定义棋盘、首击保护、计时和本地最佳成绩。",
      "tags": [
        "益智",
        "推理",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "左键翻开格子，右键插旗，双击已满足标记数量的数字格展开周围；可暂停。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "三档难度与自定义棋盘",
        "首击与邻格保护",
        "暂停和本地最佳成绩"
      ],
      "art": {
        "cover": "/games/minesweeper/cover.png",
        "hero": "/games/minesweeper/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/junjie-xu-lab/minesweeper",
      "localization": "游戏内菜单、玩法说明和主要状态为中文，保留原作署名。",
      "fit": "独立静态运行包，通过 game.json 和 iframe 接入。",
      "highlights": [
        "三档难度与自定义棋盘",
        "首击与邻格保护",
        "暂停和本地最佳成绩"
      ],
      "cautions": [
        "单人玩法；本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/minesweeper/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "asteroids",
    "order": 45,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#637da9",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "陨石突围",
      "originalTitle": "HTML5 Asteroids",
      "mark": "陨石",
      "category": "惯性射击",
      "tagline": "飞船不会立刻停下，转向、推进、开火都要算准。",
      "description": "驾驶有惯性的飞船穿过陨石群，击碎大陨石后还要应付分裂的小碎片与飞碟。清理一轮后迎来更多目标，用有限生命挑战更高分。",
      "tags": [
        "射击",
        "街机",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "空格开始与射击；左右键转向，上键推进，P 暂停，M 切换音效。",
        "inputs": [
          "keyboard"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "惯性飞行与环绕空间",
        "陨石分裂和飞碟敌人",
        "生命与分数挑战"
      ],
      "art": {
        "cover": "/games/asteroids/cover.png",
        "hero": "/games/asteroids/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/dmcinnes/HTML5-Asteroids",
      "localization": "游戏内菜单、玩法说明和主要状态为中文，保留原作署名。",
      "fit": "独立静态运行包，通过 game.json 和 iframe 接入。",
      "highlights": [
        "惯性飞行与环绕空间",
        "陨石分裂和飞碟敌人",
        "生命与分数挑战"
      ],
      "cautions": [
        "单人玩法；本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/asteroids/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage",
      "audio"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "binary-puzzle",
    "order": 46,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#d05a61",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "双色逻辑",
      "originalTitle": "0h h1",
      "mark": "双色",
      "category": "双色推理",
      "tagline": "根据三条规则填满双色棋盘，不靠反应速度。",
      "description": "根据三条规则填满双色棋盘，不靠反应速度。提供四种棋盘大小、逐步教学、撤销和有理由的提示。",
      "tags": [
        "逻辑",
        "解谜",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "点击格子在空白、红色、蓝色之间切换；撤销和提示在棋盘下方。",
        "inputs": [
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
        "根据三条规则填满双色棋盘，不靠反应速度",
        "每行每列红蓝数量相等，不能连续出现三个同色，不能有重复的行或列。"
      ],
      "art": {
        "cover": "/games/binary-puzzle/cover.png",
        "hero": "/games/binary-puzzle/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT; Apache-2.0 launcher",
      "sourceUrl": "https://github.com/florisluiten/0hh1",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "双色推理"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/binary-puzzle/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "visible-dots",
    "order": 47,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#469ab0",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "视线谜阵",
      "originalTitle": "0h n0",
      "mark": "视线",
      "category": "数字视线推理",
      "tagline": "让每个数字看到恰好数量的蓝点，用红点隔断多余视线。",
      "description": "让每个数字看到恰好数量的蓝点，用红点隔断多余视线。四种棋盘大小、互动教学与提示让规则逐步变成层层推理。",
      "tags": [
        "逻辑",
        "解谜",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "点击格子在蓝点、红点、空白之间切换；眼睛按钮提供提示。",
        "inputs": [
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
        "让每个数字看到恰好数量的蓝点，用红点隔断多余视线",
        "数字只计算同行同列能看见的其他蓝点，红点阻挡视线。"
      ],
      "art": {
        "cover": "/games/visible-dots/cover.png",
        "hero": "/games/visible-dots/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT; Apache-2.0 launcher",
      "sourceUrl": "https://github.com/Techdojo/0hn0",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "数字视线推理"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/visible-dots/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "mahjong-solitaire",
    "order": 48,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#5f9478",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "麻将叠叠消",
      "originalTitle": "Mah",
      "mark": "配对",
      "category": "立体配对消除",
      "tagline": "从多层麻将牌阵中寻找可移除的相同牌，逐步拆掉整座牌山。",
      "description": "从多层麻将牌阵中寻找可移除的相同牌，逐步拆掉整座牌山。多种布局、可解牌局、提示与撤销，适合慢慢规划消除顺序。",
      "tags": [
        "消除",
        "策略",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "点击两张相同的自由牌消除；上方可选布局、提示、撤销和重新开始。",
        "inputs": [
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
        "从多层麻将牌阵中寻找可移除的相同牌，逐步拆掉整座牌山",
        "没有牌盖住且左右至少一侧空着，才是可消除的自由牌。"
      ],
      "art": {
        "cover": "/games/mahjong-solitaire/cover.png",
        "hero": "/games/mahjong-solitaire/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT; tile art public domain and CC-BY-SA-4.0",
      "sourceUrl": "https://github.com/ffalt/mah",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "立体配对消除"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/mahjong-solitaire/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage",
      "audio"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "sudoku",
    "order": 49,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#658bb5",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "九宫数独",
      "originalTitle": "Sudoku",
      "mark": "数独",
      "category": "九宫数字推理",
      "tagline": "在九行九列的棋盘里填入数字，检查行、列和宫格的限制。",
      "description": "在九行九列的棋盘里填入数字，检查行、列和宫格的限制。三档题库、冲突提示、计时和自动保存，随时继续未完成的棋盘。",
      "tags": [
        "益智",
        "推理",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "选择难度后点击空格输入 1–9；删除数字可重新填写。",
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
        "在九行九列的棋盘里填入数字，检查行、列和宫格的限制",
        "每行、每列和每个九宫格的 1–9 都不能重复，红色提示表示冲突。"
      ],
      "art": {
        "cover": "/games/sudoku/cover.png",
        "hero": "/games/sudoku/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT; bundled dependencies retain notices",
      "sourceUrl": "https://github.com/andreynering/sudoku",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "九宫数字推理"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/sudoku/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "klondike",
    "order": 50,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#598d78",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "经典纸牌接龙",
      "originalTitle": "JavaScript Solitaire",
      "mark": "接龙",
      "category": "单人纸牌策略",
      "tagline": "七列经典纸牌接龙，用翻牌、挪动整组牌和空列整理隐藏牌。",
      "description": "七列经典纸牌接龙，用翻牌、挪动整组牌和空列整理隐藏牌。四个收牌区都按花色收齐才算通关，保留原作完整发牌与拖动玩法。",
      "tags": [
        "纸牌",
        "策略",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "点击牌堆翻三张牌；拖动一张牌或整组牌，点击正面牌可自动寻找收牌区。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "七列经典纸牌接龙，用翻牌、挪动整组牌和空列整理隐藏牌",
        "下方按红黑交替递减排列，上方收牌区按同花色从 A 到 K 收齐。"
      ],
      "art": {
        "cover": "/games/klondike/cover.png",
        "hero": "/games/klondike/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/rjanjic/js-solitaire",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "单人纸牌策略"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/klondike/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "nonograms",
    "order": 51,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#7189b5",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "数织画谜",
      "originalTitle": "Nonograms",
      "mark": "数织",
      "category": "数字绘图推理",
      "tagline": "用行列旁的数字线索推理出隐藏图画，兼顾横纵两套限制。",
      "description": "用行列旁的数字线索推理出隐藏图画，兼顾横纵两套限制。提供不同大小的关卡、错误检查、计时，以及导入导出关卡。",
      "tags": [
        "解谜",
        "绘图",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "选择关卡，左键填格、右键标记空格；可检查答案与重玩。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "用行列旁的数字线索推理出隐藏图画，兼顾横纵两套限制",
        "行列数字表示连续色块的长度，不同色块之间至少留一格。"
      ],
      "art": {
        "cover": "/games/nonograms/cover.png",
        "hero": "/games/nonograms/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT; dependencies see licenses",
      "sourceUrl": "https://github.com/jodua/nonograms",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "数字绘图推理"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/nonograms/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "connect-four",
    "order": 52,
    "discovery": {
      "audiences": [
        "duo"
      ]
    },
    "theme": {
      "accent": "#bf6f4d",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "四子连线",
      "originalTitle": "Connect Four",
      "mark": "四连",
      "category": "同屏双人策略",
      "tagline": "棋子落下后无法收回，两个人在同一台设备上争取先连成四子。",
      "description": "棋子落下后无法收回，两个人在同一台设备上争取先连成四子。需要同时进攻和封堵，完整胜负判定与重开，支持键盘操作。",
      "tags": [
        "棋类",
        "本地双人",
        "策略",
        "中文"
      ],
      "play": {
        "modes": "同屏双人",
        "players": "2 人",
        "controls": "两人轮流点击棋盘的一列投下棋子；也可以使用方向键和回车。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "棋子落下后无法收回，两个人在同一台设备上争取先连成四子",
        "横、竖、斜连成四子就获胜，留意对手同时制造两条威胁。"
      ],
      "art": {
        "cover": "/games/connect-four/cover.png",
        "hero": "/games/connect-four/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/bryanbraun/connect-four",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "同屏双人策略"
      ],
      "cautions": [
        "双人在同一设备上轮流操作，无网络联机。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/connect-four/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "international-chess",
    "order": 53,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#aa8d62",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "国际象棋",
      "originalTitle": "JavaScript Chess",
      "mark": "象棋",
      "category": "人机棋类对弈",
      "tagline": "与本地电脑对手下国际象棋，支持王车易位、吃过路兵和升变。",
      "description": "与本地电脑对手下国际象棋，支持王车易位、吃过路兵和升变。合法走法提示、悔棋与电脑代走便于练习布局和攻防。",
      "tags": [
        "棋类",
        "策略",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "拖动棋子走子，也可点击右侧合法走法；右侧可以悔棋和让电脑代走。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "与本地电脑对手下国际象棋，支持王车易位、吃过路兵和升变",
        "你执白先走；保护国王，悬停棋子可查看允许的目标格。"
      ],
      "art": {
        "cover": "/games/international-chess/cover.png",
        "hero": "/games/international-chess/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT; jQuery and jQuery UI MIT",
      "sourceUrl": "https://github.com/kbjorklu/chess",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "人机棋类对弈"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/international-chess/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "battleship",
    "order": 54,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#577f9b",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "舰队猎手",
      "originalTitle": "Battleship",
      "mark": "海战",
      "category": "人机海战推理",
      "tagline": "把五艘船藏进海图，再与电脑轮流射击寻找对方舰队。",
      "description": "把五艘船藏进海图，再与电脑轮流射击寻找对方舰队。船位隐藏、命中追踪与击沉胜负，让每次开火都需要排除和推理。",
      "tags": [
        "策略",
        "推理",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "先在自己的棋盘摆放五艘舰船，可点旋转；随后点击敌方格子开火。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "把五艘船藏进海图，再与电脑轮流射击寻找对方舰队",
        "击中后沿横竖方向追击；电脑同样会利用命中信息寻找你的舰船。"
      ],
      "art": {
        "cover": "/games/battleship/cover.png",
        "hero": "/games/battleship/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT; normalize.css MIT",
      "sourceUrl": "https://github.com/Shahir-47/Battleship",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "人机海战推理"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/battleship/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "snake-classic",
    "order": 55,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#7b9853",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "贪吃蛇挑战",
      "originalTitle": "JavaScript Snake",
      "mark": "贪吃蛇",
      "category": "路线与反应",
      "tagline": "吃食物增长蛇身，在越来越挤的棋盘里维持安全路线。",
      "description": "吃食物增长蛇身，在越来越挤的棋盘里维持安全路线。五档速度、加速挑战与多种外观，挑战持续增长的得分。",
      "tags": [
        "街机",
        "反应",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "方向键控制移动，空格暂停；开始前可切换速度与外观。",
        "inputs": [
          "keyboard",
          "touch"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "吃食物增长蛇身，在越来越挤的棋盘里维持安全路线",
        "随着蛇身变长，提前规划回转路线，别把自己围进死路。"
      ],
      "art": {
        "cover": "/games/snake-classic/cover.png",
        "hero": "/games/snake-classic/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/patorjk/JavaScript-Snake",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "路线与反应"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/snake-classic/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "color-lines",
    "order": 56,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#8d75b0",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "五彩连珠",
      "originalTitle": "Color Lines",
      "mark": "连珠",
      "category": "路线消除策略",
      "tagline": "在九乘九棋盘中移动彩球，把同色球连成横、竖或斜线消除。",
      "description": "在九乘九棋盘中移动彩球，把同色球连成横、竖或斜线消除。路线必须畅通，新球预告、连珠得分和本地纪录让整理空间成为核心挑战。",
      "tags": [
        "消除",
        "策略",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "点击彩球，再点击能通过空格抵达的位置；同色连成五个或更多即可消除。",
        "inputs": [
          "mouse"
        ],
        "devices": [
          "desktop"
        ],
        "vision": false
      },
      "highlights": [
        "在九乘九棋盘中移动彩球，把同色球连成横、竖或斜线消除",
        "没有消除时会增加三颗球，先用上方预告规划空间。"
      ],
      "art": {
        "cover": "/games/color-lines/cover.png",
        "hero": "/games/color-lines/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT",
      "sourceUrl": "https://github.com/arnisritins/Color-Lines",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "路线消除策略"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/color-lines/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage"
    ],
    "permissions": [
      "fullscreen"
    ]
  },
  {
    "schemaVersion": 2,
    "id": "tower-building",
    "order": 57,
    "discovery": {
      "audiences": [
        "single"
      ]
    },
    "theme": {
      "accent": "#d17c58",
      "dark": "#20292e"
    },
    "presentation": {
      "title": "摩天楼建造",
      "originalTitle": "Tower Building",
      "mark": "叠塔",
      "category": "时机叠塔",
      "tagline": "从摇晃的吊钩上放下楼层，把高楼一层层垒起来。",
      "description": "从摇晃的吊钩上放下楼层，把高楼一层层垒起来。落点越整齐得分越高，三次失误机会与连续完美奖励，越高越考验时机。",
      "tags": [
        "街机",
        "反应",
        "中文"
      ],
      "play": {
        "modes": "单人挑战",
        "players": "1 人",
        "controls": "点击开始，再点击屏幕放下摆动的楼层；掉落三次后结束，可重新挑战。",
        "inputs": [
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
        "从摇晃的吊钩上放下楼层，把高楼一层层垒起来",
        "等待楼层对齐再松手，连续完美落点会增加连击得分。"
      ],
      "art": {
        "cover": "/games/tower-building/cover.png",
        "hero": "/games/tower-building/cover.png"
      },
      "availability": {
        "state": "playable",
        "label": "可直接游玩"
      },
      "actionLabel": "进入游戏"
    },
    "platform": {
      "hosting": "static",
      "technology": "独立 HTML / CSS / JavaScript 静态运行包",
      "license": "MIT; Zepto MIT",
      "sourceUrl": "https://github.com/iamkun/tower_game",
      "localization": "中文游戏菜单、操作说明和主要反馈；保留原作署名。",
      "fit": "通过 game.json 与 iframe 接入，无需新增服务器进程。",
      "highlights": [
        "时机叠塔"
      ],
      "cautions": [
        "单人玩法，本地成绩不跨设备同步。"
      ],
      "launch": {
        "kind": "iframe",
        "entry": "/games/tower-building/index.html"
      }
    },
    "capabilities": [
      "fullscreen",
      "storage",
      "audio"
    ],
    "permissions": [
      "fullscreen",
      "autoplay"
    ]
  }
] as const satisfies readonly GameManifest[];
