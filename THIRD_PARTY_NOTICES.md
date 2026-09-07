# Third-party notices

## Noto Emoji fruit artwork

- Source: https://github.com/googlefonts/noto-emoji
- Copyright 2013 Google, Inc.
- License: Apache License 2.0
- Usage: Local SVG bases for fruit/bomb silhouettes and color structure. The game adds its own Canvas lighting, cutting faces, juice, motion, fuse sparks and hit feedback.
- Upstream copyright/license notice: `licenses/NOTO-EMOJI-APACHE-2.0.txt`
- Full Apache 2.0 text: `licenses/GOOGLE-MEDIAPIPE-APACHE-2.0.txt`

## Canvas Game Arcade / Fruit Ninja module

- Source: https://github.com/forinda/canvas-games
- License: MIT
- Usage: Fruit physics, game-loop organization, segment collision, split-half and particle concepts were adapted and extended.
- Full license: `licenses/FORINDA-CANVAS-GAMES-MIT.txt`

## MediaPipe Samples Web

- Source: https://github.com/google-ai-edge/mediapipe-samples-web
- Copyright 2026 The MediaPipe Authors
- License: Apache License 2.0
- Usage: Worker-based MediaPipe initialization, Hand Landmarker and Holistic Landmarker task structure were adapted.
- Modified files retain their upstream copyright header.
- Full license: `licenses/GOOGLE-MEDIAPIPE-APACHE-2.0.txt`

## MediaPipe models and Tasks Vision runtime

- Source: https://developers.google.com/edge/mediapipe/solutions/vision/
- Package: `@mediapipe/tasks-vision`
- Models: official float16 Hand Landmarker and Holistic Landmarker task bundles.
- Redistribution and use remain subject to the upstream Google/MediaPipe terms included with the software and model distribution.

## perfect-freehand

- Source: https://github.com/steveruizok/perfect-freehand
- Package: `perfect-freehand` 1.2.3
- Copyright 2021 Stephen Ruiz Ltd
- License: MIT
- Usage: Generates the live tapered, smoothed blade-stroke outline from high-frequency mouse pointer samples.
- Full license: `licenses/PERFECT-FREEHAND-MIT.txt`

## One Euro Filter

- Source: https://github.com/casiez/OneEuroFilter
- Copyright 2019 Inria
- License: BSD-3-Clause
- Usage: The reference TypeScript implementation was adapted to filter timestamped hand landmarks.
- Full license: `licenses/ONE-EURO-FILTER-BSD-3-CLAUSE.txt`

## Dynamic-Random InkSplatter

- Source: https://github.com/NDevTK/Dynamic-Random/blob/main/js/ink_splatter_effects.js
- Copyright 2026 NDevTK
- License: MIT
- Usage: Seeded irregular outline, directional satellite-droplet, gravity trajectory and bounded-pool ideas were adapted into the local Canvas juice-effect module. The upstream drawing library itself is not bundled.
- Full license: `licenses/DYNAMIC-RANDOM-MIT.txt`

## ray.js

- Source: https://github.com/oleksnd/ray.js
- Copyright 2026 Oleksandr K
- License: MIT
- Usage: Noise-deformed wet-blob and curved Bézier drip concepts were adapted into the local wall-splatter renderer. The upstream library itself is not bundled.
- Full license: `licenses/RAY-JS-MIT.txt`

## 得意黑 / Smiley Sans

- Source: https://github.com/atelier-anchor/smiley-sans
- Copyright: atelierAnchor
- License: SIL Open Font License 1.1
- Usage: Local WOFF2 display font for game titles, large scores and short arcade labels. Body copy continues to use the system Chinese UI font.
- Full license: `licenses/SMILEY-SANS-OFL-1.1.txt`

## 5 Chiptunes (Action)

- Source: https://opengameart.org/content/5-chiptunes-action
- Composer and producer: Juhani Junkala
- Publisher / contributor: SubspaceAudio
- License: Creative Commons CC0 1.0 Universal
- Usage: Five local, seamlessly looping tracks for countdown, rising endless difficulty, arcade events, boss pressure and result screens.
- Modification: Original WAV files were transcoded to OGG Vorbis for browser delivery; the compositions were not replaced or regenerated.
- Notice: `licenses/JUHANI-JUNKALA-ACTION-CHIPTUNES-CC0.txt`

## 第三方静态游戏移植

以下运行包保存在 `public/games/`，并随站点原样提供各自的许可证、署名和源码链接。雨晴游戏厅的改动主要是路径修复、风险资源清理、统一加载桥和中文界面层。

### Der Koloss CE / 孤堡尸潮

- Source: https://github.com/rishipr/der-koloss-ce
- Code license: MIT；字体为 SIL OFL；部分资源许可单独列在上游 `NOTICE.md`。
- Modification: 修复子目录部署路径，汉化房间、角色、辅助选项、设置和常见战斗 HUD，并移除上游声明未获再发布许可的 `beauty-of-annihilation.mp3` 及其播放入口。
- Local notices: `public/games/der-koloss/LICENSE`, `public/games/der-koloss/NOTICE.md`。

### Sanctuary's End / 庇护所终章

- Source: https://github.com/J3vb/Sanctuarys_End
- Code license: MIT；模型、字体和纹理包含 CC0、CC BY 4.0、SIL OFL 与 Three.js MIT 组件。
- Modification: 修复独立部署入口，并汉化角色创建、帮助、设置、装备属性与部位、技能、符文、怪物区域和主要商店界面。
- Local notices: `public/games/sanctuarys-end/LICENSE`, `public/games/sanctuarys-end/CREDITS.md`, `public/games/sanctuarys-end/assets/CREDITS.md`。

### LittleJS Arcade / 迷你街机合集

- Source: https://github.com/KilledByAPixel/LittleJSArcade
- License: MIT，Copyright 2026 Frank Force；子游戏资源的额外署名继续保留在运行包中。
- Modification: 汉化目录、分类、游戏名与简介，以及 63 款本地子游戏的通用菜单、教程、操作说明和常用 Canvas HUD；移除四个依赖第三方跨站 iframe 的条目，避免永久加载或被站点策略拦截。
- Local license: `public/games/littlejs-arcade/LICENSE`。

### PVP / 像素竞技场

- Source: https://github.com/kesiev/pvp
- License: 上游同时提供 MIT 与 GPL-3.0 文件；本项目完整保留两份，未把其代码并入雨晴游戏厅闭源模块。
- Modification: 公网 Socket.IO 入口在纯静态版中明确禁用；本地/单机入口保留，启动设置、模式规则、操作说明及常见 Canvas HUD/播报已汉化，并为中文补充 Canvas 原生字体回退。
- Local licenses: `public/games/pvp-arena/MIT-LICENSE.txt`, `public/games/pvp-arena/COPYING`。

### HexGL / 极速光轨

- Source: https://github.com/BKcore/HexGL
- Code license: MIT，Copyright 2015 Thibaut Despoulain。
- Audio: 部分 CC BY 3.0，部分公共领域，详细作者和修改记录保存在本地音频许可证。
- Modification: 移除 Google Analytics 和外部 favicon，修复子目录部署并汉化启动设置。
- Local notices: `public/games/hexgl/LICENSE`, `public/games/hexgl/audio/LICENSE`。

## 独立服务器游戏

Suroi（GPL-3.0）、Scribble.rs（BSD-3-Clause，部分美术保留权利）、TOSIOS（MIT）和 OpenFront（AGPL-3.0；素材 CC BY-SA 4.0）当前不打包进静态站点。游戏厅只提供中文说明和上游在线入口；自建部署边界记录在 `server-games/README.md`。

Kaetram Open 的自定义 OPL 明确限制 AI 相关用途，因此本项目不复制、不修改也不发布其运行代码，只保留产品观察与上游源码链接。
