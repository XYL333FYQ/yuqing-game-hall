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

Suroi（GPL-3.0）、Scribble.rs（BSD-3-Clause，部分美术保留权利）、TOSIOS（MIT）和 OpenFront（AGPL-3.0；素材 CC BY-SA 4.0）当前不打包进静态站点。游戏厅只提供中文说明和上游在线入口，Manifest 位于 `external-games/`；本项目 VPS 不运行这些第三方整站。

Kaetram Open 的自定义 OPL 明确限制 AI 相关用途，因此本项目不复制、不修改也不发布其运行代码，只保留产品观察与上游源码链接。

## 新增棋牌运行包

- 斗地主：[DavidWang1231/doudizhu-online](https://github.com/DavidWang1231/doudizhu-online)，Copyright (c) 2026 Jiacheng Wang，MIT；完整许可 `public/games/doudizhu/LICENSE`。修改信令 / TURN 配置、错误提示和静态部署路径，保留原规则与合成音效。
- 掼蛋 / 麻将：[TypeThe0ry/CardRoomPro](https://github.com/TypeThe0ry/CardRoomPro)，Copyright (c) 2026 TypeThe0ry，MIT；完整许可 `public/games/_shared/card-room/LICENSE` 与 `server-games/card-room/LICENSE`。拆分前端 / 后端、启用访客内存模式；封面、扑克图案及地主标识为本项目绘制。未分发上游 demo 图片。
- CardRoomPro 的原始斗地主底座来自 [laivv/doudizhu](https://github.com/laivv/doudizhu)，原作者 laivv，其 README 声明代码 MIT、网络图片不在许可范围内。本运行包保留代码来源署名，并使用自绘扑克牌替换这些图片。
- 五子棋：[HullQin/gobang](https://github.com/HullQin/gobang)，Copyright (c) 2020 Hull，MIT；完整许可 `public/games/gobang/LICENSE` 与 `server-games/gobang/LICENSE`。保留前端 SVG 棋盘，Node 实现原房间消息协议并增加回合及胜负校验。

棋牌页面随附的第三方运行组件均保留许可，运行时不从 CDN 下载：

| 组件 | 来源 | 许可文本 |
| --- | --- | --- |
| Vue 2.5.17 | https://github.com/vuejs/vue | `licenses/VUE-2.5.17-MIT.txt` |
| jQuery 2.2.4 | https://github.com/jquery/jquery | `licenses/JQUERY-2.2.4-MIT.txt` |
| Layer 3.5.1（替换上游旧版） | https://github.com/layui/layer | `licenses/LAYER-3.5.1-MIT.txt` |
| Socket.IO client 4.8.1 | https://github.com/socketio/socket.io | `licenses/SOCKET.IO-CLIENT-4.8.1-MIT.txt` |
| PeerJS（复用现有 vendored 运行包） | https://github.com/peers/peerjs | `licenses/PEERJS-MIT.txt` |

固定源版本与改动清单见 `BOARD_GAMES.md`。浏览器可访问 `/legal/THIRD_PARTY_NOTICES.md` 和 `/legal/licenses/` 中的对应文本。


## 新增 20 款中文静态游戏（2026-10-05）

固定来源与改动见 `NEW_GAMES.md`、`games/expansion/SOURCES.json`。以下各款保留上游完整许可证，并随站点提供 `/games/<id>/source.zip` 对应源码。共享中文适配与玩法说明使用本项目 MIT 许可，第三方游戏按各自许可分发。

| 游戏 / 路径 | 上游 | 代码许可 |
| --- | --- | --- |
| 小黑屋 (`a-dark-room`) | https://github.com/doublespeakgames/adarkroom | MPL-2.0 |
| 格子大陆 (`gridland`) | https://github.com/doublespeakgames/gridland | MPL-2.0 |
| 小小牧场 (`tiny-yurts`) | https://github.com/js13kGames/tiny-yurts | MIT |
| 纸牌远征 (`casual-crusade`) | https://github.com/js13kGames/casual-crusade | MIT |
| 夺回地狱王座 (`infernal-throne`) | https://github.com/arikwex/infernal-sigil | MIT |
| 深层突围 (`underrun`) | https://github.com/phoboslab/underrun | MIT |
| 十三秒回溯 (`xx142-b2`) | https://github.com/js13kGames/xx142-b2.exe | MIT |
| 星际打包救援 (`packabunchas`) | https://github.com/js13kGames/packabunchas | MIT |
| 回旋镖勇者 (`bounce-back`) | https://github.com/js13kGames/bounce-back | GPL-2.0-or-later |
| 积木城堡 (`super-castle`) | https://github.com/js13kGames/super-castle-game | GPL-3.0-only |
| 亡灵法师诺曼 (`norman-necromancer`) | https://github.com/danprince/js13k-2022 | Unlicense |
| 线索迷境 (`the-neatness`) | https://github.com/mvasilkov/neatness2022 | GPL-3.0-only |
| 荒野赏金 (`backcountry`) | https://github.com/js13kGames/backcountry | ISC |
| 霓虹突袭 (`radius-raid`) | https://github.com/jackrugile/radius-raid-js13k | MIT |
| 元素防线 (`elematter`) | https://github.com/jackrugile/elematter-js13k | MIT |
| 守护蜜蜂 (`bee-kind`) | https://github.com/picosonic/js13k-2022 | MIT |
| 鼠疫小镇 (`rat-plague`) | https://github.com/picosonic/js13k-2023 | MIT |
| 六边形消除 (`hextris`) | https://github.com/Hextris/hextris | GPL-3.0-or-later |
| 第十三层 (`thirteenth-floor`) | https://github.com/js13kGames/13th-floor | MIT |
| 可汗卡牌地牢 (`khan`) | https://github.com/BenjaminWFox/KHAN-js13k-2023 | MIT |

第三方运行组件：jQuery（MIT）、RequireJS（MIT）、Hammer 1.1.2（MIT）、Keypress 1.0.8（Apache-2.0，David Mauro）、jsfxr（Apache-2.0，Markus Neubrand）、Kontra.js 9（MIT，Steven Lambert）、SweetAlert（MIT）、JSONfn（MIT）、RRSSB（MIT）、jQuery Cookie（MIT，Klaus Hartl）、ZzFX（MIT，Frank Force）、natlib 0.1.13（MIT，Mark Vasilkov）。完整文本在 `licenses/` 和 `/legal/licenses/`；Sonant-X 的 zlib 声明直接保留于 Underrun 源文件。

Hextris 的 Exo 2 字体使用 SIL OFL 1.1；Font Awesome 4.1 字体使用 SIL OFL 1.1，CSS 使用 MIT。Picosonic 两款游戏的 Kenney 素材为 CC0；Bee Kind 的《蓝色多瑙河》片段为程序合成的公共领域作曲素材，未复制现代录音。原作 README 署名见每款源码包。

## 第二批 10 款中文经典静态游戏（2026-10-10）

每款完整许可在 `/games/<id>/LICENSE`，固定提交在 `games/classics/SOURCES.json` 与各款 `SOURCE.md`；对应源码随同 `/games/<id>/source.zip` 分发。运行截图作为本项目封面，仍遵循游戏素材的原许可。

| 游戏 / 路径 | 上游 | 代码许可 |
| --- | --- | --- |
| 自由布阵塔防 (`classic-tower-defense`) | https://github.com/oldj/html5-tower-defense | MIT，oldj |
| 2048 合成 (`classic-2048`) | https://github.com/gabrielecirulli/2048 | MIT，Gabriele Cirulli |
| 俄罗斯方块 (`classic-tetris`) | https://github.com/jakesgordon/javascript-tetris | MIT，Jake Gordon |
| 弹球打砖块 (`classic-breakout`) | https://github.com/jakesgordon/javascript-breakout | MIT，Jake Gordon and contributors |
| 百关推箱子 (`sokoban-100`) | https://github.com/shunyue1320/sokoban | MIT，舜岳 |
| 中国象棋 (`chinese-chess`) | https://github.com/xqbase/xqwlight | GPL-2.0-or-later，Morning Yellow / www.xqbase.com |
| 黑白棋 (`othello`) | https://github.com/NXY666/othello-board | MIT，NXY666 |
| 图案解锁 (`breaklock`) | https://github.com/maxwellito/breaklock | MIT，maxwellito |
| 经典扫雷 (`minesweeper`) | https://github.com/junjie-xu-lab/minesweeper | MIT，junjie-xu-lab |
| 陨石突围 (`asteroids`) | https://github.com/dmcinnes/HTML5-Asteroids | MIT，Doug McInnes |

打砖块音频保持原样，依据上游 `LICENSE` 中的 CC BY-ND 2.0 声明分发，来源为 Freesound Project，原作者列表由上游链接 [Freesound attribution](http://www.freesound.org/usersAttribution.php?id=2227288) 提供；未修改录音。已用原生 Audio API 替换旧 Flash 音频加载，不使用 SoundManager2，但源码包保留原许可。

象棋采用原作 JavaScript 引擎，保留 GPL 声明；GBK 转 UTF-8、入口适配和新增合成音效的可编辑源码随包提供。象棋与陨石射击的原 WAV 录音均未分发，陨石射击原自定义字体也未分发。黑白棋的外站字体、背景，2048 的 Clear Sans 字体以及图案解锁的 Roboto Mono 字体均未分发，改用系统字体或 CSS 背景。

陨石射击的 jQuery 1.4.1 保留文件内 MIT / GPL 许可头与 `JQUERY-LICENSE.txt`；扫雷的 React/ReactDOM、Workbox 均为 MIT，完整许可位于该运行包 `licenses/`，并保留生成代码的第三方许可注释。其它中文入口和资源路径改动按原作许可提供，共享 `game-help.js` 的 MIT 文本为 `public/games/_shared/expansion-LICENSE`。
