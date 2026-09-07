export type GameHosting = "static" | "hybrid" | "server" | "restricted";
export type GameInput = "keyboard" | "mouse" | "touch" | "gamepad" | "vision";
export type GameDevice = "desktop" | "mobile";
export type GameCapability = "audio" | "multiplayer" | "vision" | "fullscreen" | "gamepad" | "storage";
export type GamePermission = "camera" | "microphone" | "fullscreen" | "autoplay" | "gamepad";

export type GameLaunch =
  | { kind: "iframe"; entry: string; upstreamUrl?: string }
  | { kind: "external"; url: string }
  | { kind: "none" };

export interface GameManifest {
  schemaVersion: 1;
  id: string;
  order: number;
  name: string;
  originalName: string;
  mark: string;
  category: string;
  description: string;
  hosting: GameHosting;
  hostingLabel: string;
  featured?: boolean;
  theme: {
    accent: string;
    dark: string;
  };
  tags: readonly string[];
  play: {
    modes: string;
    players: string;
    controls: string;
    inputs: readonly GameInput[];
    devices: readonly GameDevice[];
    vision: boolean;
  };
  technology: string;
  license: string;
  sourceUrl: string;
  localization: string;
  fit: string;
  highlights: readonly string[];
  cautions: readonly string[];
  capabilities?: readonly GameCapability[];
  permissions?: readonly GamePermission[];
  cover?: string;
  screenshots?: readonly string[];
  launch: GameLaunch;
}
