export type GameHosting = "static" | "hybrid" | "server" | "restricted";
export type GameInput = "keyboard" | "mouse" | "touch" | "gamepad" | "vision";
export type GameDevice = "desktop" | "mobile";
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
  schemaVersion: 2;
  id: string;
  order: number;
  featured?: boolean;
  discovery: {
    audiences: readonly GameAudience[];
    popularRank?: number;
    /** 首页精选轮播的顺序；标记 featured 的游戏可按此字段自行排位。 */
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
