/**
 * 像素竞技场专属中文语言表（zh-CN）。
 *
 * 与公共的 `public/games/_shared/yuqing-bridge.js` 的分工：
 *   像素竞技场专属翻译  →  公共 bridge 翻译  →  原文
 *
 * 本文件做两件事：
 *   1. 把专属词表注册成公共 bridge 的**优先层**（`window.yuqingTranslateOverride`），
 *      于是 DOM 文本和 Canvas 文本走的是同一份表、同一套优先级。
 *   2. 暴露 `window.YuqingPvpI18n.translate()`，供独立打开游戏（没有 bridge）时直接使用。
 *
 * 为什么 Canvas 也覆盖得到：`client/js/engine.js` 的 `CANVAS.print` / `printCenter`
 * 在真正绘制**之前**调用 `window.yuqingTranslateText()`，而该函数内部会先问本文件的
 * 优先层。绘制完成后再去抓 DOM 是抓不到 Canvas 文字的。
 *
 * 不改动任何玩法、素材或渲染逻辑；这里只有字符串映射。
 */
(() => {
  "use strict";

  if (window.YuqingPvpI18n) return;

  const dictionary = {
    // ---------------------------------------------------------------- 通用
    "Play": "开始游戏",
    "Start": "开始",
    "Setup": "游戏设置",
    "Settings": "设置",
    "Back": "返回",
    "Create": "创建",
    "Continue": "继续",
    "Credits": "制作名单",
    "Controls": "操作方式",
    "Graphics": "画面",
    "Audio": "声音",
    "Gameplay": "玩法",
    "Multiplayer": "多人游戏",
    "Enabled": "开启",
    "Disabled": "关闭",
    "None": "无",
    "Normal": "普通",
    "Full": "已满",
    "Loading": "正在加载",
    "Initializing...": "正在初始化…",
    "Reset to default": "恢复默认",
    "Okay, thanks!": "好的，谢谢！",
    "Got it!": "设置完成！",
    "New settings saved": "新设置已保存",
    "Controls configuration saved": "操作设置已保存",
    "Error loading resource": "资源加载失败",

    // ------------------------------------------------------------ 主菜单
    "Single Player": "单人游戏",
    "SELECT NETPLAY": "在线联机",
    "QUIT": "退出",

    // ---------------------------------------------------------------- 设置
    "Settings - Graphics": "设置 - 画面",
    "Settings - Audio": "设置 - 声音",
    "Settings - Gameplay": "设置 - 玩法",
    "Settings - Controls": "设置 - 操作",
    "Graphics...": "画面…",
    "Audio...": "声音…",
    "Gameplay...": "玩法…",
    "Controls...": "操作…",
    "Screen controls": "操作设备",
    "Rendering mode": "渲染模式",
    "On-screen": "主线程渲染",
    "Off-screen sync": "离屏同步渲染",
    "Off-screen": "离屏渲染",
    "Math": "数学计算",
    "Browser": "浏览器原生",
    "Approximations": "近似算法",
    "Table": "查表算法",
    "Load audio": "加载音频",
    "Low resolution": "低分辨率",
    "Benchmark": "性能测试",
    "Keyboard": "键盘",
    "Mouse + Keyboard": "键盘 + 鼠标",
    "Mouse": "鼠标",
    "Touch": "触摸屏",
    "Touch screen": "触摸屏",
    "Multiple gamepads": "多个手柄",
    "Left half": "左半屏",
    "Right half": "右半屏",
    "Pointer": "指针",
    "Analogs": "摇杆",
    "Buttons": "按键",
    "Vibration": "震动",
    "Strong": "强",
    "Very strong": "非常强",
    "Sound effects": "音效",
    "Music": "音乐",
    "Announcer": "播报语音",
    "Full mode": "完整模式",
    "Match": "对局播报",
    "Match, start/end only": "仅播报开局 / 结束",
    "Only on damage/die": "仅受伤 / 阵亡时",
    "Flashes": "闪光效果",
    "Gibs": "碎片效果",
    "GUI Particles": "菜单粒子",
    "Reticle": "准星",
    "Reticle on": "显示准星",
    "Camera shake": "镜头震动",
    "Weapon drift": "武器摆动",
    "Game speed": "游戏速度",
    "Weapon specific": "随武器变化",
    "All weapons": "全部武器",
    "Full, No pickups": "完整，无拾取",
    "Configure controls...": "配置操作…",
    "Select control": "选择操作设备",
    "Select key": "选择按键",
    "L1": "L1",
    "L2": "L2",
    "R1": "R1",
    "R2": "R2",
    "Caps lock": "大写锁定",
    "Num lock": "数字锁定",
    "Scroll lock": "滚动锁定",
    "Decimal point": "小数点",
    "Left arrow": "左方向键",
    "Right arrow": "右方向键",
    "Up arrow": "上方向键",
    "Down arrow": "下方向键",
    "Page up": "Page Up",
    "Page down": "Page Down",
    "Numpad 0": "小键盘 0",
    "Numpad 1": "小键盘 1",
    "Numpad 2": "小键盘 2",
    "Numpad 3": "小键盘 3",
    "Numpad 4": "小键盘 4",
    "Numpad 5": "小键盘 5",
    "Numpad 6": "小键盘 6",
    "Numpad 7": "小键盘 7",
    "Numpad 8": "小键盘 8",
    "Numpad 9": "小键盘 9",
    "Move forward": "前进",
    "Move backward": "后退",
    "Move left": "左移",
    "Move right": "右移",
    "Strafe left": "左横移",
    "Strafe right": "右横移",
    "Turn left": "左转",
    "Turn right": "右转",
    "Analog move": "摇杆移动",
    "Analog rotate": "摇杆转向",
    "Fast move": "快速移动",
    "Slow move": "缓慢移动",
    "Aim button": "瞄准按键",
    "Menu up": "菜单上移",
    "Menu down": "菜单下移",
    "Menu left": "菜单左移",
    "Menu right": "菜单右移",
    "Menu confirm": "菜单确认",
    "Menu cancel": "菜单取消",
    "Left area - swipe up": "左区域 - 上滑",
    "Left area - swipe down": "左区域 - 下滑",
    "Left area - swipe left": "左区域 - 左滑",
    "Left area - swipe right": "左区域 - 右滑",
    "Right area - swipe up": "右区域 - 上滑",
    "Right area - swipe down": "右区域 - 下滑",
    "Right area - swipe left": "右区域 - 左滑",
    "Right area - swipe right": "右区域 - 右滑",

    // ------------------------------------------------------------ 武器
    "Knife": "匕首",
    "Pistol": "手枪",
    "Machine Gun": "机枪",
    "Shotgun": "霰弹枪",
    "Sniper": "狙击枪",
    "Rocket": "火箭筒",
    "Grenade": "手雷",

    // ------------------------------------------------------ 模式与规则
    "Mode": "模式",
    "Variant": "对战形式",
    "Map": "地图",
    "Map specific": "随地图变化",
    "Random": "随机",
    "Random weapon": "随机武器",
    "Time": "时间",
    "Limit": "分数上限",
    "Lives": "生命",
    "Speed": "速度",
    "Health": "生命值",
    "Weapons": "武器",
    "Frags": "击杀目标",
    "Points": "积分目标",
    "Perk 1": "强化 1",
    "Perk 2": "强化 2",
    "Perk 3": "强化 3",
    "Radar": "雷达",
    "Trails": "拖尾",
    "Add to radar": "加入雷达",
    "Drones": "无人机",
    "Targets": "仅目标",
    "Targets, drones": "目标与无人机",
    "Targets, drones, players": "目标、无人机与玩家",
    "Respawn at": "重生位置",
    "Player base": "玩家基地",
    "Random base": "随机基地",
    "Flag weight": "旗帜重量",
    "Light": "轻",
    "Heavy": "重",
    "Very heavy": "非常重",
    "No limit": "无限制",
    "No time limit": "不限时间",
    "No points limit": "不限积分",
    "Deathmatch": "死亡竞赛",
    "Bloodlust": "嗜血",
    "Instagib": "一击必杀",
    "Invasion": "入侵",
    "Panic!": "危急时刻！",
    "The One": "天选者",
    "King of the hill": "山丘之王",
    "Capture the flag": "夺旗战",
    "Last man standing": "最后生还者",
    "Horde Versus": "尸潮对抗",
    "Horde Co-op": "尸潮合作",
    "Arcade Co-op": "街机合作",
    "All vs. all": "自由混战",
    "Team vs.": "团队对抗",
    "Vs. Champion": "挑战冠军",
    "Red vs. Blue/Green/Yellow": "红队 vs. 蓝 / 绿 / 黄队",
    "Red/Blue vs. Green/Yellow": "红 / 蓝队 vs. 绿 / 黄队",
    "Unlimited ammo": "无限弹药",
    "Restore health": "恢复生命",
    "Max health x2": "生命上限 ×2",
    "Max health x3": "生命上限 ×3",
    "Damage x2": "伤害 ×2",
    "Damage x3": "伤害 ×3",
    "Damage x4": "伤害 ×4",
    "Half damage": "伤害减半",
    "No damage": "无伤害",
    "Only 1HP": "仅 1 点生命",
    "No aiming": "禁止瞄准",
    "Slow aiming": "瞄准变慢",
    "Fast reload": "快速装填",
    "Slow reload": "装填变慢",
    "No stop moving": "无法停下",
    "No doors": "没有门",
    "No weapons": "没有武器",
    "No radar": "没有雷达",
    "Broken radar": "雷达损坏",
    "Super radar": "超级雷达",
    "Slippery floor": "地面湿滑",
    "Pitch black": "一片漆黑",
    "Very hot": "酷热",
    "Fog": "浓雾",
    "Shrink": "缩小",
    "Distract": "干扰",
    "Door stuck": "门被卡住",
    "Invisibility": "隐形",
    "Fire & Random": "开火与随机",
    "Invert buttons": "反转按键",

    // -------------------------------------------------- 模式说明（长文本）
    "Earn 1 point for every frag, lose 1 point for suicide!": "每击杀一次得 1 分，自杀一次扣 1 分！",
    "Earn 1 point for every second you stand on the hotspot!": "站在热区上每秒得 1 分！",
    "Earn 1pts/sec.": "每秒得 1 分。",
    "Lose 1HP/sec.": "每秒失去 1 点生命。",
    "When a Player dies he gets x4 damage and loses 1HP/sec!": "玩家阵亡后会获得 4 倍伤害，但每秒失去 1 点生命！",
    "He has perks and frags for points. Kill him and be The One!": "他带着强化与击杀数，击杀他就能成为天选者！",
    "Bring the flag at the hotspot to your home for 1 point!": "把热区上的旗帜带回自己基地可得 1 分！",
    "Lose all lives and you're out! The last man standing wins!": "用完所有生命即被淘汰！最后存活者获胜！",
    "The map fills up with drones. Kill anything to earn points!": "地图会不断出现无人机。击杀任何目标都能得分！",
    "Share lives, kill drones and go for the highest score!": "共享生命，击杀无人机，冲击最高分！",
    "Clear missions. Fight as a team. Fail as a team.": "完成一个个任务。团队一起战斗，也一起失败。",
    "Let the PvP Leaders choose your next training.": "让 PvP 教官为你挑选下一场训练。",
    "You vs. the other Players!": "你与其他玩家对抗！",
    "Not filed in PvP central database.": "PvP 中央数据库中没有这份记录。",

    // ------------------------------------------------------- HUD 与结算
    "GAME OVER": "游戏结束",
    "NEW MISSION": "新任务",
    "NEW HIGH SCORE": "新的最高分",
    "YOU WON": "你赢了",
    "YOU LOSE": "你输了",
    "YOU ARE THE ONE": "你成为了天选者",
    "YOU RANKED #": "你的排名 #",
    "YOU'RE OUT": "你被淘汰了",
    "Well done!": "干得漂亮！",
    "Get ready!": "准备！",
    "Life lost!": "失去一条命！",
    "LIFE LOST": "失去生命",
    "Point scored!": "得分！",
    "Flag is back!": "旗帜已归位！",
    "Flag is lost!": "旗帜已丢失！",
    "You got the flag!": "你拿到了旗帜！",
    "Get combo x": "达成连击 ×",
    "Go to hotspot": "前往热区",
    "You": "你",

    // ------------------------------------------------------- 大厅 / 联机
    "Room": "房间",
    "Nickname": "昵称",
    "Your ID": "你的联机 ID",
    "NET Server": "雨晴联机 · 房主",
    "NET Client": "雨晴联机 · 加入",
    "NET Server ID": "房主 ID",
    "Input your Player nickname.": "输入你的玩家昵称。",
    "Input the Server ID to connect.": "输入要加入的房主 ID。",
    "Players connected to the same server will play together.": "连接到同一房主的玩家会进入同一局游戏。",
    "Copy configuration URL to clipboard...": "复制联机配置链接…",
    "Generate new ID...": "生成新 ID…",
    "URL Copied!": "链接已复制！",
    "Share this link to play together": "把链接发给好友即可一起游玩",
    "Share this link to other Players to automatically configure their clients:":
      "把这条链接发给其他玩家，他们的客户端会自动完成配置：",
    "Insert a NET Server ID to connect and play together. If you don't want to":
      "输入房主 ID 即可一起游玩。如果不想手动输入，",
    "type it in ask the server player the link displayed on its Netplay settings.":
      "可以请房主把联机设置里显示的链接发给你。",
    "Server not available!": "房主不可用！",
    "Disconnected (error)": "连接已断开（错误）",
    "Disconnected": "未连接",
    "Preparing...": "正在准备…",
    "Ready.": "已就绪。",
    "Connecting...": "正在连接…",
    "Wait for connection...": "等待连接…",
    "Connected.": "已连接。",
    "Joining game...": "正在加入游戏…",
    "Waiting to join the game...": "等待加入游戏…",
    "Playing...": "对局中…",
    "Waiting for players...": "等待玩家…",
    "Waiting other players confirm...": "等待其他玩家确认…",
    "All joined players hold fire to start!": "所有已加入的玩家按住开火键即可开始！",
    "All Players hold fire to quit.": "所有玩家按住开火键即可退出。",
    "PRESS FIRE": "按住开火键",
    "JOIN IN!": "加入！",
    "Hold down the fire button to start!": "按住开火键开始！",

    // ------------------------------------------------------------ 制作名单
    "Player Versus Player": "玩家对玩家",
    "JS code, gfx, game design, maps, test": "程序、美术、玩法设计、地图与测试",
    "Game design, maps, test": "玩法设计、地图与测试",
    "Fonts": "字体",
    "Sfx, voice, music": "音效、配音、音乐",
    "Software libraries/techs": "使用的软件库与技术",
    "Thanks to": "特别感谢",
    "PvP is MIT/GPLv3 licensed": "PvP 采用 MIT / GPLv3 许可",
    "PvP theme: Her Kiss by Drozerix": "PvP 主题曲：Her Kiss - Drozerix",
    "Sound effects: CC0 sounds - opengameart.org": "音效：CC0 素材 - opengameart.org",
    "Voice: SamJs.js - github.com/discordier/sam": "配音：SamJs.js - github.com/discordier/sam",
    "Modplayer: jsxm - github.com/a1k0n/jsxm": "模块音乐播放器：jsxm - github.com/a1k0n/jsxm",
    "Netplay addon uses: socket.io / node.js / peerjs": "联机模块使用：socket.io / node.js / peerjs",
    "Music: Browse Settings/Audio/Music for more": "音乐：在 设置 / 声音 / 音乐 中可切换更多曲目",
    "Tom Thumb Tiny ASCII font / NFO Font 6x8": "Tom Thumb Tiny ASCII 字体 / NFO Font 6x8",

    // ------------------------------------------------------- 错误与提示
    "Socket.io client": "Socket.io 客户端",
  };

  const normalize = (value) => String(value).replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const exact = new Map(Object.entries(dictionary));
  const normalized = new Map([...exact].map(([source, target]) => [normalize(source), target]));
  const cache = new Map();

  // 动态文本：数值、目标、倒计时等由代码拼出来的句子。
  // 放在专属层里，保证不依赖公共 bridge 也完整。
  const STAT_WORDS = {
    health: "生命",
    damage: "伤害",
    speed: "速度",
    distance: "距离",
    intensity: "强度",
    sight: "视野",
    "horde difficulty": "尸潮难度",
  };
  const CONTROL_WORDS = {
    sensitivity: "灵敏度",
    "rotation speed": "转向速度",
    "analog sensitivity": "摇杆灵敏度",
    "swipe sensitivity": "滑动灵敏度",
    "hud opacity": "界面透明度",
    "dead zone": "死区",
    range: "范围",
  };
  const UNIT_WORDS = {
    minutes: "分钟",
    minute: "分钟",
    frags: "次击杀",
    frag: "次击杀",
    points: "分",
    point: "分",
  };

  function dynamic(core) {
    let value = core
      .replace(/^(\d+) HP$/i, "$1 点生命")
      .replace(/^(\d+)% volume$/i, "$1% 音量")
      .replace(/^(\d+)% (health|damage|speed|distance|intensity|sight|horde difficulty)$/i,
        (_, amount, stat) => `${amount}% ${STAT_WORDS[stat.toLocaleLowerCase()]}`)
      .replace(/^(\d+)% (sensitivity|rotation speed|analog sensitivity|swipe sensitivity|hud opacity|dead zone|range)$/i,
        (_, amount, stat) => `${amount}% ${CONTROL_WORDS[stat.toLocaleLowerCase()]}`)
      .replace(/^(\d+)% move\/aim speed$/i, "$1% 移动 / 瞄准速度")
      .replace(/^(\d+) (minutes?|frags?|points?)$/i,
        (_, amount, unit) => `${amount} ${UNIT_WORDS[unit.toLocaleLowerCase()]}`)
      .replace(/^Starting the game in\s*(\d+)sec\.\.\.$/i, "游戏将在 $1 秒后开始…")
      .replace(/^Quitting game in\s*(\d+)sec\.\.\.$/i, "退出游戏倒计时 $1 秒…")
      .replace(/^Starting in (\d+)s$/i, "$1 秒后开始")
      .replace(/^Watch\s+(.+)$/i, "观战：$1")
      .replace(/^COMBO x(\d+)$/i, "连击 ×$1")
      .replace(/^DMG x(.+)$/i, "伤害 ×$1")
      .replace(/^Go\s+(.+)\s+base$/i, "前往$1基地")
      .replace(/^Get combo x(\d+)$/i, "达成 $1 连击")
      .replace(/^YOU RANKED #(\d+)$/i, "你的排名 #$1")
      .replace(/^(.+) LEFT THE GAME$/i, "$1 已离开游戏");
    return value === core ? "" : value;
  }

  /**
   * 只查专属表。命中返回中文，未命中返回空字符串，
   * 由调用方（公共 bridge 或本文件的 translate）继续往下兜底。
   */
  function own(text) {
    if (text == null) return "";
    const core = String(text).replace(/^(\s*)(.*?)(\s*)$/s, "$2");
    if (!core) return "";
    if (cache.has(core)) return cache.get(core);
    let result = exact.get(core) ?? normalized.get(normalize(core)) ?? "";
    if (!result) result = dynamic(core);
    if (cache.size > 4096) cache.clear();
    cache.set(core, result);
    return result;
  }

  /** 专属 → 公共 bridge → 原文。独立打开游戏（没有 bridge）时也能用。 */
  function translate(text) {
    if (text == null) return text;
    const match = String(text).match(/^(\s*)(.*?)(\s*)$/s);
    if (!match) return text;
    const [, leading, core, trailing] = match;
    const localized = own(core);
    if (localized) return `${leading}${localized}${trailing}`;
    const bridge = window.yuqingTranslateText;
    if (typeof bridge === "function") return bridge(text);
    return text;
  }

  window.YuqingPvpI18n = {
    dictionary: exact,
    translate,
    own,
  };

  // 公共 bridge 的优先层：命中就返回中文，未命中返回空串让它继续用自己的词表。
  window.yuqingTranslateOverride = (core) => own(core);
})();
