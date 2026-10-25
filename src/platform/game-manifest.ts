import taxonomy from "./game-taxonomy.json";

export type GameHosting = "static" | "hybrid" | "server" | "restricted";
export type GameInput = "keyboard" | "mouse" | "touch" | "gamepad" | "vision";
export type GameDevice = "desktop" | "mobile";
/** 游戏分类 id；唯一词表在 src/platform/game-taxonomy.json，新增分类先改词表。 */
export type GameGenreId = keyof typeof taxonomy.genres;
/** 联机方式 id；唯一词表在 src/platform/game-taxonomy.json，新增方式先改词表。 */
export type GameOnlineMode = keyof typeof taxonomy.onlineModes;
export type GameCapability = "audio" | "multiplayer" | "vision" | "fullscreen" | "gamepad" | "storage";
export type GamePermission = "camera" | "microphone" | "fullscreen" | "autoplay" | "gamepad";
export type GameAudience = "single" | "duo" | "multi";
export type GameAvailability = "playable" | "external" | "unavailable";

export type GameLaunch =
  | {
    kind: "iframe";
    /** 实际发布的 HTML 文件，用于静态资源校验。 */
    entry: string;
    /** 可选的玩家启动地址，例如游戏自己的模式选择页；必须仍指向 entry。 */
    startUrl?: string;
    upstreamUrl?: string;
  }
  | { kind: "external"; url: string }
  | { kind: "none" };

export interface GameManifest {
  schemaVersion: 3;
  id: string;
  order: number;
  /** 兼容旧清单；首页推荐自动包含全部可玩的游戏，不再以此字段筛选。 */
  featured?: boolean;
  discovery: {
    /** 分类词表 id，1~2 个；由目录生成脚本校验。 */
    genres: readonly GameGenreId[];
    /** 联机方式；与 capabilities 是否含 multiplayer 必须一致，含义校见生成脚本。 */
    online: GameOnlineMode;
    audiences: readonly GameAudience[];
    popularRank?: number;
    /** 兼容旧清单；首页精选轮播不再使用手工排名。 */
    featuredRank?: number;
  };
  theme: {
    accent: string;
    dark: string;
  };
  presentation: {
    title: string;
    originalTitle?: string;
    mark: string;
    /** 展示用副标题，只出现在卡片文案里，不参与筛选；分类请使用 discovery.genres。 */
    category: string;
    tagline: string;
    description: string;
    tags: readonly string[];
    play: {
      modes: string;
      players: string;
      controls: string;
      inputs: readonly GameInput[];
      devices: readonly GameDevice[];
      vision: boolean;
    };
    highlights: readonly string[];
    art: {
      icon?: string;
      cover?: string;
      hero?: string;
      screenshots?: readonly string[];
    };
    availability: {
      state: GameAvailability;
      label: string;
    };
    actionLabel: string;
  };
  platform: {
    hosting: GameHosting;
    technology: string;
    license: string;
    sourceUrl: string;
    localization: string;
    fit: string;
    highlights: readonly string[];
    cautions: readonly string[];
    launch: GameLaunch;
  };
  capabilities?: readonly GameCapability[];
  permissions?: readonly GamePermission[];
}
