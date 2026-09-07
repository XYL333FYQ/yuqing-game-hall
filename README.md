# 雨晴游戏厅

一个统一管理浏览器小游戏、第三方开源移植和联机服务入口的平台。所有可运行游戏都以独立目录和 `game.json` 接入；果切派对也作为独立静态 iframe 游戏随站点发布。

## 一键运行

- 双击根目录唯一的 `启动雨晴游戏厅.cmd`：启动游戏厅、自动选择可用端口并打开浏览器。
- 这个入口同时提供果切派对、十款开源游戏的中文详情页，以及五款静态移植；不需要再打开其他目录或第二个脚本。
- 如果默认端口已被占用，脚本会自动选择相邻可用端口，并在窗口中显示和自动打开实际地址。
- 首次运行需要联网安装 Node 依赖。模型、WASM 和页面运行资源安装后全部从本地提供，不使用第三方运行时 CDN。
- 当前统一启动入口使用 Vite，本地房间后端暂不自动启动。需要单独验收 Cloudflare 联机时，在命令行运行 `corepack pnpm dev:cloudflare`。

命令行方式：

```text
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm dev:cloudflare
```

## 页面

- `/`：雨晴游戏厅首页。
- `/games/fruit-party`：果切派对介绍。
- `/games/fruit-party/arcade`：90 秒动态街机模式。
- `/games/fruit-party/play`：单人无尽模式。
- `/games/fruit-party/online`：创建或加入好友房间。
- `/games/:slug`：开源游戏的中文介绍、许可证、运行边界与统一入口。
- `/games/:slug/play`：随主站部署的静态游戏运行框架。
- `/room/:code`：1v1 房间和比赛。
- `/vision-lab`：完整手部／全身视觉识别实验室。

## 游戏目录

- `games/`：雨晴游戏厅原生维护的游戏；当前为 `fruit-party/`。
- `public/games/`：五款清理后、接入中文层并随主站构建的第三方静态游戏。
- `server-games/`：Suroi、Scribble.rs、TOSIOS 与 OpenFront 的独立服务器部署边界和示例配置。
- `game-sources/upstream/`：十个保持原样的上游仓库，只用于追溯和后续同步，不进入 `dist`。
- `game-sources/rejected/`：以后保存淘汰项目或淘汰记录。
- 每款游戏的 `game.json`：游戏的唯一资料来源，包含名称、分类、简介、操作方式、许可、截图和启动方式；构建时自动生成大厅目录。
- `src/platform/`：大厅共用的路由、页面壳、设备门槛和 Manifest 类型；不包含任何具体游戏玩法。

第三方项目不会从上游仓库直接运行。静态作品必须先生成独立运行包；需要 WebSocket 或权威房间的作品必须部署专用服务器。汉化进度与许可风险会在每款游戏详情页如实显示。

## 加入一个游戏

浏览器不能在运行时扫描服务器目录，所以游戏厅在构建前扫描约定目录中的 `game.json`，生成 `src/generated/gameCatalog.ts`。这个生成文件是构建产物，不手工编辑。

1. 纯静态第三方游戏：将它完整、可独立打开的运行包放到 `public/games/<id>/`，并在同一目录添加 `game.json`，把 `launch.kind` 设为 `iframe`、`entry` 指向该目录里的明确 HTML 文件。
2. 自维护静态游戏：完整游戏目录放在 `public/games/<id>/`，其中可包含独立源码、资源、`game.json` 和 HTML 入口；大厅只读取该目录中的 Manifest 和入口。
3. 需要常驻后端的游戏：在 `server-games/<id>/` 放置 `game.json` 与部署说明，把 `launch.kind` 设为 `external`；客户端和服务器按上游要求独立部署。
4. 运行 `corepack pnpm check` 和 `corepack pnpm check:games`。前者会生成目录并做类型检查，后者会按 Manifest 确认每个 iframe 入口确实存在。

普通静态游戏不需要编辑首页、详情页、试玩页或手写注册表。封面和截图是可选的站内绝对路径；没有它们时大厅沿用通用海报样式。

手机可以浏览首页和介绍页，但不会启动游戏、联机比赛或摄像头。实际游玩要求精细指针、至少约 960×600 的浏览空间和电脑浏览器。

## 游戏与联机

鼠标按住左键后才形成有效刀刃。输入控制器始终监听标准 Pointer Events，并读取浏览器提供的合并高频采样；碰撞按原始线段计算，`perfect-freehand` 只负责绘制平滑刀光，不反向滤波刀尖。

街机模式固定 90 秒：12 秒无炸弹热身、三个不重复的随机挑战、两段换气时间，以及最后十秒需要八次独立切割的巨型水果。完美切、三连斩和普通命中会填充狂热槽；满值后 6 秒双倍得分并暂停生成新炸弹。评级、街机最高分和按本地日期生成的每日挑战只保存在浏览器。

经典无尽中的炸弹不提供入场提示：首枚炸弹拥有约 5.2–14.0 秒的宽随机窗口，后续会在普通间隔、短促连压和随机空档之间变化。炸弹起点覆盖全屏，并在自由弧线、横穿、中心外抛、边缘内收和近垂直五类路径间轮换。系统仍会校验炸弹与水果的完整相对轨迹；找不到安全路径时只短暂延后，不生成重叠目标。每 25 秒提高一档节奏，水果波次、速度和炸弹频率会随存活时间与分数继续提升。

背景音乐使用本地化的五首同系列 CC0 循环曲目。倒计时、无尽难度层级、街机热身／挑战／过渡／狂热／巨果和结算采用不同曲目、速度与音量，并通过短交叉淡化衔接。音乐只会在玩家点击开始后加载；声音按钮会同时控制音乐和切割音效。

墙面果汁由切割种子一次性生成不规则主体、出刀方向卫星滴和延迟下淌，渲染帧不再重新随机轮廓。墙渍固定在背景层，前景动态液滴受重力影响；同屏上限为 12 个墙渍和 180 个动态液滴。

后期密集波次不会通过减少水果、粒子、墙渍或缩短效果寿命来换取帧率。水果切半及其阴影在开局前预缓存，墙渍轮廓复用固定路径，粒子、切半、刀光和水果列表在原数组内回收；最高分只在结算或离开时持久化，调试状态降为低频同步。

联机固定两人，双方根据 Durable Object 下发的随机种子生成同一套归一化水果时间线：

- 90 秒积分赛：炸弹扣 10 分，平分进入 20 秒加时。
- 三局两胜：每局 60 秒，先赢两局。
- 三命生存：漏切扣命，切中炸弹直接输掉本局，最多五分钟。

自己的切割和画面始终本地响应；切割声明每 100ms 批量发给房间服务。服务端验证水果编号、时间窗、重复命中、刀刃速度和相交位置，再广播权威比分。断线后有 15 秒重连时间，空房间 30 分钟后清理。

## 本地视觉模型

正式视觉后端只使用 `@mediapipe/tasks-vision`：

| 文件 | 大小 | 功能 |
|---|---:|---|
| `public/models/hand_landmarker.task` | 7,819,105 字节 | 最多双手、每手 21 个关键点 |
| `public/models/holistic_landmarker.task` | 13,683,609 字节 | 脸部、姿态和双手统一识别 |

旧 `@mediapipe/hands` Lite 运行时及其模型已经删除。完整模型只在进入体感实验室并点击“开启摄像头”后加载；首页和果切页面不会请求模型或摄像头。

## 构建、测试和 Cloudflare

```text
corepack pnpm test
corepack pnpm build
corepack pnpm deploy
```

`build` 会依次执行前端与 Worker 类型检查、Vite 构建和 Wrangler 本地打包，并自动检查 `dist` 中每个文件是否低于 Cloudflare 的 25 MiB 单文件限制、文件总数是否低于 20,000，以及 Worker 的 gzip 体积是否低于免费版 3 MiB 上限。部署配置位于 `wrangler.jsonc`：静态页面和模型由 Workers Static Assets 提供，只有 `/api/*` 进入 Worker，房间由 SQLite-backed Durable Objects 承载。

自动测试覆盖确定性水果序列、服务端切割校验、三种房规、鼠标按下／合并采样／松开／越界取消、逐线段碰撞、街机时间线、事件抽取、完美切、狂热、巨果八刀、评级、确定性喷溅、效果上限、经典规则和电脑设备门槛。浏览器联调还应在功能修改后复测建房、重连、认输和重赛。

正式部署前需要确认 Wrangler 当前登录的 Cloudflare 账号、项目名和域名。部署脚本收纳在 `scripts/deploy-cloudflare.cmd`，不会和日常启动入口混在一起。

## 开源来源

- 果切玩法结构：`forinda/canvas-games`，MIT。
- MediaPipe Web Worker 结构：`google-ai-edge/mediapipe-samples-web`，Apache-2.0。
- 刀光轮廓：`perfect-freehand`，MIT。
- 喷溅几何思路：`NDevTK/Dynamic-Random` 与 `oleksnd/ray.js`，MIT。
- 手部稳定器参考：One Euro Filter，BSD-3-Clause。
- 展示字体：得意黑（Smiley Sans），SIL OFL 1.1。
- 阶段音乐：Juhani Junkala / SubspaceAudio `5 Chiptunes (Action)`，CC0 1.0。

详细审查见 `SOURCE_AUDIT.md`，完整声明见 `THIRD_PARTY_NOTICES.md` 和 `licenses/`。
构建时这些文件会同步到静态资源的 `/legal/` 目录，Cloudflare 部署后仍可直接查阅，不依赖 GitHub 或第三方站点。
