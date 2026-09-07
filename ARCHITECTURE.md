# 雨晴游戏厅架构说明

本文说明当前项目的实际边界、这次重构解决的问题，以及以后怎样在不修改大厅核心页面的情况下加入游戏。它面向正在开始阅读项目代码的人，因此先说明结论：**雨晴游戏厅是一个 Vite 单页门户；它发现并展示游戏，但不负责运行每款游戏的玩法。** 每款游戏通过自己的 `game.json` 声明资料和启动方式。

## 1. 本次诊断与改动

### 修改前的主要问题

项目原本已经有 `game.json` 和生成目录的脚本，但大厅同时保留了一份手写的 `src/data/gameLibrary.ts`。同一款游戏的名称、简介、标签、启动地址等资料要在两个地方维护：

```text
各游戏的 game.json ──> 生成的 gameCatalog.ts
                         
手写 gameLibrary.ts ────> 首页、卡片、详情页、试玩页
```

这会产生两个风险：新增游戏时容易漏改大厅；两个来源的资料也会慢慢不一致。另外，`src/app/` 是空目录，部分页面和路由却仍引用了不存在的 `app/layout`、`app/device` 或错误相对路径，因此构建链路不清楚。

果切的源码位于 `public/games/fruit-party/source/`，最终游戏包位于 `public/games/fruit-party/`。它通过自己的 Vite 配置生成发布包，平台只把发布目录中的 HTML 当作普通 iframe 游戏加载。

### 本次完成的整理

1. 修正平台页面、游戏目录生成和独立游戏入口的真实引用路径。
2. 将 `src/data/gameLibrary.ts` 改为 **从 `GAME_CATALOG` 派生的展示模型**，不再手写任何游戏资料。
3. 首页的游戏数量、果切名称和简介、游戏库数量也从 Manifest 读取；通用详情页支持 Manifest 中可选的封面和截图。
4. `scripts/check-game-assets.mjs` 改为读取所有 Manifest，并验证每一个 iframe 的 `entry` 文件确实存在。
5. 为原生、静态 iframe、外部服务器三种入口补充了清楚的项目内说明和测试。

没有做大规模物理移动：`public/games/`、`server-games/` 和 `game-sources/upstream/` 分别承担发布游戏、独立后端和上游追溯职责。果切完整目录现在与其他静态游戏一样位于 `public/games/fruit-party/`。

## 2. 现在的总体结构

```text
雨晴游戏厅
|
|-- src/main.ts
|    `-- 启动门户路由
|
|-- src/portal/                 门户的路由协调
|-- src/pages/                  首页、通用游戏详情、iframe 启动页、视觉实验室
|-- src/platform/               门户可共享的小能力
|    |-- game-manifest.ts       Manifest 的 TypeScript 形状
|    |-- game-catalog.ts        读取构建时生成的游戏目录
|    |-- shell/navigation/device
|    `-- 公共页面壳、站内导航、设备门槛
|
|-- public/games/fruit-party/source/  果切开发源码与构建入口
|-- public/games/fruit-party/  果切唯一运行包
|    |-- game.json              平台读取的资料与启动声明
|    |-- index.html/standalone.ts  独立网页入口
|    |-- FruitNinjaEngine.ts    游戏规则与主循环
|    |-- systems/renderers/effects/data
|    `-- pages                 果切介绍、单人、街机、联机房间
|
|-- public/games/fruit-party/source/network/  果切联机客户端与 HTTP 请求
|-- src/vision/                 独立的摄像头与 MediaPipe 输入实验室
|
|-- public/games/               随静态站点原样发布的第三方运行包
|    |-- der-koloss/
|    |-- sanctuarys-end/
|    |-- littlejs-arcade/
|    |-- pvp-arena/
|    `-- hexgl/
|
|-- public/models/ + public/wasm/   浏览器直接请求的视觉模型与 WASM
|-- server-games/               需要独立部署的联机游戏的 Manifest、说明和配置边界
|-- game-sources/upstream/      上游源码副本，只用于追溯、审查和将来同步
|-- game-sources/rejected/      不进入发布包的受限或淘汰项目记录
|
|-- scripts/                    生成目录、复制资源、检查资源与部署限制
|-- worker/                     Cloudflare Worker 与果切 Durable Object 房间服务
`-- dist/                       Vite 每次构建生成的发布产物，不手工编辑
```

`src` 是会被 Vite 编译的 TypeScript 源码；`public` 是不经 Vite 打包、按原路径复制到 `dist` 的浏览器资源；`dist` 是可删除并重新生成的最终发布目录。不要把源代码、密钥或服务器私钥放进 `public`，因为访问网站的人都能下载其中的文件。

## 3. 修改前与修改后的数据流

```text
修改前

game.json ──> 生成目录（存在但未成为唯一入口）

手写 gameLibrary.ts ──> 首页 / 卡片 / 详情 / 试玩页
                         ^
                         └── 新增游戏还要人工同步资料

修改后

每款游戏目录的 game.json
          |
          |  构建前由 scripts/generate-game-catalog.mjs 扫描和校验
          v
src/generated/gameCatalog.ts（自动生成，禁止手工编辑）
          |
          v
src/platform/game-catalog.ts
          |
          +--> 首页的推荐、数量和卡片
          +--> 通用详情页
          +--> 通用 iframe 启动页
          `--> src/data/gameLibrary.ts（只做旧 UI 所需的字段映射）
```

这不是浏览器在运行时扫描磁盘。浏览器没有读取服务器目录的权限；扫描发生在 Node.js 的构建前阶段，生成一个可以被浏览器打包的 TypeScript 文件。因此 Cloudflare 静态托管时仍然可靠，也不会在用户打开首页时进行文件系统查询。

## 4. Manifest：游戏怎样描述自己

每款已接入、服务器或受限游戏都有一个 `game.json`。实际字段由 `src/platform/game-manifest.ts` 定义，生成脚本会验证格式、重复 `id`、重复排序、资源路径和启动方式。

常用字段可以按目的理解：

| 目的 | 字段 |
| --- | --- |
| 身份与展示 | `id`、`order`、`name`、`originalName`、`mark`、`category`、`description`、`theme`、`tags` |
| 玩家需要知道的内容 | `play.modes`、`play.players`、`play.controls`、`play.inputs`、`play.devices`、`play.vision` |
| 维护与合规说明 | `hosting`、`hostingLabel`、`technology`、`license`、`sourceUrl`、`localization`、`fit`、`highlights`、`cautions` |
| 可选媒体 | `cover`、`screenshots`，必须是站内绝对路径 |
| 启动方式 | `launch` |

`launch` 只保留四种足够表达当前需求的情况：

```json
{ "kind": "iframe", "entry": "/games/fruit-party/index.html" }
{ "kind": "iframe", "entry": "/games/hexgl/index.html" }
{ "kind": "external", "url": "https://example-game-server.example" }
{ "kind": "none" }
```

最后一种只用于许可证限制、不能接入运行代码的项目。Manifest 没有提前实现账号、成就、排行榜或复杂插件配置，因为当前并没有可复用的实际需求。

### 真实例子：HexGL

`public/games/hexgl/game.json` 说明它是 `static`，启动方式是 iframe，入口是 `/games/hexgl/index.html`。构建前脚本将该资料收集进目录；首页因此自动得到卡片，`/games/hexgl` 自动得到通用详情页，点击“进入游戏”会到 `/games/hexgl/play`，由统一播放器创建：

```text
用户点击 HexGL
  -> /games/hexgl/play
  -> renderLibraryPlay()
  -> <iframe src="/games/hexgl/index.html">
  -> HexGL 自己加载它自己的 HTML、脚本、纹理、音频和 WebGL Canvas
```

大厅不知道 HexGL 的 Three.js 版本、赛车控制器或赛道文件；它只知道可显示的资料和明确入口地址。

### 以后加入一个普通静态游戏

1. 确认游戏已能独立运行，并将完整运行包放到 `public/games/<游戏-id>/`。这里应是发布用副本，不是上游源码仓库。
2. 在同一目录写 `game.json`，`id` 使用小写字母、数字和连字符，`launch.kind` 设为 `iframe`，`launch.entry` 写成该目录内明确的 HTML 文件，例如 `/games/my-game/index.html`。
3. 若有封面或截图，一并放入 `public` 下可发布的位置，Manifest 用 `/games/my-game/cover.webp` 一类的站内绝对路径引用；没有媒体也可省略，门户会使用通用样式。
4. 运行 `corepack pnpm check`。它会生成 `src/generated/gameCatalog.ts` 并进行类型检查。
5. 运行 `corepack pnpm check:games`。它会确认 Manifest 指向的 iframe HTML 真实存在。
6. 本地打开首页、详情页和试玩页，检查浏览器控制台、返回链接、全屏和资源路径。只有需要自定义页面、联机后端或原生 TypeScript 模块时，才需要额外代码。

也就是说，普通静态游戏不需要修改首页、通用详情页、通用播放器或手写注册表。

## 5. 四种运行方式

### 果切派对：独立静态网页游戏

```text
用户点击果切
  -> /games/fruit-party/play 通用详情/播放页
  -> library-play.ts 创建 iframe
  -> /games/fruit-party/index.html 加载独立游戏 bundle
  -> 浏览器在 iframe 中运行 Canvas、音频和输入
```

果切源码不参与平台的 TypeScript/Vite 源码构建。平台只消费生成后的 Manifest 和静态 HTML；游戏内部的引擎、资源、输入与页面代码不会被平台 import。需要后端时，游戏可以继续在自己的 `server/` 中维护并独立部署。

它目前不是 iframe 的原因很实际：强行拆成 iframe 会额外处理 Vite 子项目构建、资源路径、同源联机接口、测试边界和重复页面壳，却不会立刻减少果切内部的复杂度。它已经通过目录、`routes.ts` 和 Manifest 与大厅玩法解耦；未来只有在果切需要独立发布或采用不同构建工具时，才值得把它做成独立构建包。

### 第三方静态游戏：iframe

```text
用户点击第三方静态游戏
  -> 通用详情页 /games/:id
  -> 通用启动页 /games/:id/play
  -> 同源 iframe 加载 public/games/:id 中的入口 HTML
  -> iframe 内独立加载它自己的 CSS、JavaScript、Canvas/WebGL、图片、音频
```

目前的 iframe 游戏是 Der Koloss、Sanctuary's End、LittleJS Arcade、PVP Arena 和 HexGL。它们随站点的静态文件一起发布，浏览器并不需要专用游戏服务器才能把页面、Canvas 或 WebGL 跑起来。iframe 的好处是第三方 CSS、全局 JavaScript 和 Canvas 不会污染大厅；更新上游副本时也更容易对照。

通用播放器保留“返回介绍”“重新载入”“全屏游玩”和加载失败提示。`public/games/_shared/yuqing-bridge.js` 可让同源游戏发送极小的 `YUQING_GAME_READY` 消息来提前结束加载遮罩；没有业务需要时，游戏不必与大厅通信，更没有大型游戏平台 SDK。

### 需要服务器的联机游戏：外部导航

Suroi、Scribble、TOSIOS 与 OpenFront 在 `server-games/` 各有 Manifest 和部署边界。它们的 `launch.kind` 是 `external`，所以详情页把用户带到已部署的在线服务，而不是在一个可能永远加载的 iframe 中伪装“正在启动”。

```text
用户点击联机作品
  -> 游戏厅详情页读取 Manifest
  -> “连接在线服务”打开该游戏的 HTTPS 地址
  -> 游戏客户端连接它自己的 HTTP / WebSocket 服务
  -> 该服务负责房间、匹配、状态同步、反作弊或权威结算
```

静态托管只能提供客户端下载文件，不能自动变成常驻 WebSocket 游戏服务器。例如 Suroi 使用 Bun、TypeScript、PixiJS 和 WebSocket，不能把整个 Bun 服务端原样上传成 Cloudflare Static Assets。要自建时，必须依照该项目自己的部署文档分别部署客户端和服务器，并配置客户端使用正确的服务地址。

### 受限项目：不启动

Kaetram 位于 `game-sources/rejected/`，Manifest 使用 `hosting: "restricted"` 与 `launch.kind: "none"`。门户只保留说明和源码链接，不复制或发布其运行代码。这不是功能缺失，而是许可证边界。

## 6. iframe、直接 import 与跳转网站的取舍

| 方式 | 适合的内容 | 当前例子 | 原因 |
| --- | --- | --- | --- |
| 原生模块 | 自己长期维护、需要共享当前 Vite 构建或房间后端的游戏 | 果切 | 能保持现有 TypeScript、测试与联机；门户仍不进入玩法实现 |
| iframe | 完整且能静态运行的第三方网页游戏 | HexGL 等五款 | 最大限度保留原始结构，隔离 CSS 与全局状态，便于更新 |
| 外部跳转 | 依赖常驻服务端、由上游或另一套部署运行的游戏 | Suroi 等四款 | 不把复杂后端问题误当成静态资源问题 |
| 不提供入口 | 许可证不允许纳入的项目 | Kaetram | 保留审查信息，避免错误发布 |

iframe 与外部跳转的区别在于：iframe 内的游戏仍是本站 `public/games/` 发布的一部分，播放器可以提供返回、全屏和加载状态；外部跳转则离开本站，由另一个网站的域名、部署、账号和服务规则负责。把所有游戏直接 import 到大厅会使第三方的全局样式和依赖进入同一个应用，也会令一次上游更新影响大厅；把所有游戏跳转出去又会失去统一入口和本地静态发布的体验。因此按运行性质选择，而不是追求一种形式。

## 7. 视觉识别为什么独立保留

视觉实验室不是果切的隐藏子模块。当前链路是：

```text
用户进入 /vision-lab 并点击开启摄像头
  -> VisionController 请求浏览器摄像头权限
  -> 创建 hand-landmarker 或 holistic 的 Web Worker
  -> Worker 请求 /wasm 的 MediaPipe 运行时和 /models/*.task 模型
  -> Worker 在后台进行关键点识别
  -> VisionController 归一化结果并交给实验室页面绘制
```

首页、普通游戏页和果切页不会加载模型，也不会请求摄像头。果切当前只使用鼠标输入，Manifest 也明确 `vision: false`。这降低了重构风险：视觉能力已经在 `src/vision/` 形成相对独立的输入实验室，但尚未建立一个“所有游戏通用输入层”。等到至少两款游戏确实都需要体感时，再提炼一个很小的统一输入接口会更合适；现在提前做会增加抽象而没有实际收益。

浏览器实际下载的内容按访问时机不同：打开门户时下载主 HTML、Vite 编译的主页 JavaScript/CSS；打开 iframe 游戏时再下载该 iframe 的 HTML 和它自己的资源；进入果切页时按需下载果切代码与音频/美术；只有开启摄像头后才下载 MediaPipe WASM 和 `.task` 模型。Canvas 是浏览器中的绘图表面，游戏逻辑仍由 JavaScript/TypeScript 编译后的代码在用户设备上执行；WASM 是浏览器能执行的紧凑二进制运行时代码，不是服务器程序。

## 8. 本地构建到 Cloudflare 的流程

```text
package.json 的 scripts
  -> corepack pnpm install
     -> node_modules/（本机依赖，既不提交为发布站点，也不直接给浏览器）
  -> corepack pnpm build
     -> prebuild / prepare-assets
        -> 扫描 game.json，生成 src/generated/gameCatalog.ts
        -> 复制 MediaPipe 和法律声明资源，检查 iframe 入口
     -> TypeScript 检查
     -> Vite 编译 src/，并原样复制 public/ 到 dist/
     -> 检查 Cloudflare 静态资源与 Worker 体积限制
     -> Wrangler dry-run 打包 Worker
  -> corepack pnpm deploy
     -> 根据 Manifest 生成 gameCatalog 与 worker/generated-game-registry.ts
     -> Wrangler 发布 dist 静态资源与 worker/index.ts
```

`wrangler.jsonc` 配置 Cloudflare Workers Static Assets：`dist` 是静态资源目录，未知的非 API 路由使用单页应用回退，因此 `/games/hexgl` 刷新后仍能回到 Vite 门户；`/api/*` 先进入 Worker；果切好友房间由 `GameRoom` Durable Object 保存和协调。模型、WASM 和 iframe 资源都作为静态文件从同一站点路径提供。

本地只查看前端和静态游戏时使用 `corepack pnpm dev`；要验收果切的 Cloudflare 房间后端使用 `corepack pnpm dev:cloudflare`。部署前仍需确认 Wrangler 登录的是正确 Cloudflare 账号、Worker 名称和域名，这些是环境配置，不能从前端代码自动推断。

## 9. 耦合现在在哪里，为什么

### 已降低的耦合

* 游戏资料只有 Manifest 一个来源。新增静态游戏不再同时修改 JSON 和大厅 TypeScript 注册表。
* 通用详情页与通用播放器按 `launch.kind` 工作，不包含 HexGL、LittleJS 等游戏内部实现。
* 第三方运行包保留在 `public/games/`，不被 Vite 打散进门户业务模块。
* 上游源码放在 `game-sources/upstream/`，不会意外作为发布资源进入 `dist`。
* 视觉系统与果切输入分离，加载摄像头不会影响普通游戏启动。

### 有意保留的耦合

* 果切与当前 Vite 应用、页面壳以及 Cloudflare 房间协议共用构建和部署。这是现有完整功能的最小稳定边界，不是门户控制玩法。
* 所有 Manifest 由同一个小型校验脚本读取。它统一保证 `id`、入口路径和资源路径安全，避免每款游戏各自写一套模糊规则。
* iframe 游戏和门户同源发布，因此可提供全屏与极小的“已就绪”加载信号。没有引入跨域消息协议或账户系统。

## 10. 未来维护时容易遗漏的事情

下面这些不是本次为了“高级”而新增的系统，而是在公开发布或继续扩展前应知道的真实边界：

1. **CSP 与 iframe 权限策略**：以后加 Content Security Policy 时，要逐一确认第三方游戏的脚本、纹理、音频、WebGL 与 WebRTC 是否被允许；能加 `sandbox` 前也要实测，因为它可能破坏游戏的存储、弹窗、全屏或网络能力。
2. **缓存与版本号**：第三方大资源更新后，浏览器和 Cloudflare 可能缓存旧文件。发布一版游戏时应采用明确版本记录或带内容哈希的资源，避免 HTML 指向新脚本而用户仍拿到旧资源。
3. **静态资源体积**：Cloudflare 可以托管复杂静态游戏，但模型、音频、纹理和地图依然有文件数与单文件大小限制，也直接影响首次加载时间。现有构建会检查限制，但不代表体验一定足够快。
4. **第三方许可和上游更新**：上游源码、副本与发布包必须继续分开。更新时应先核对许可证和素材，记录上游版本、补丁和删改内容，不能只看代码“能不能运行”。
5. **客户端与服务器兼容性**：联机游戏发布客户端和服务端时必须锁定相互兼容的版本；客户端能打开不等于 WebSocket 协议、地图数据或房间规则匹配。
6. **服务器观测和故障处理**：独立服务器需要日志、健康检查、容量、重启策略和滥用防护；这些问题不在 Cloudflare 静态托管的职责内。果切 Worker 也应在正式联机前实际测试建房、重连、认输和重赛。
7. **真实设备视觉验证**：模型路径和 Worker 能通过构建不代表每台电脑都能获得摄像头权限或 GPU 加速。需要在常用浏览器、无 GPU 情况和真实摄像头上测试；系统会回退 CPU，但帧率可能不同。
8. **跨浏览器与输入设备**：现在的游戏门槛偏桌面精细指针。新增触摸、手柄或手机支持时，应由具体游戏在 Manifest 声明并进行真机测试，而不是只改一行“支持手机”。

## 11. 日常检查清单

* 改 Manifest、门户路由或 TypeScript 后：`corepack pnpm check`
* 加入或更新静态游戏运行包后：`corepack pnpm check:games`
* 改果切规则、房间协议或输入后：`corepack pnpm test`
* 发布前：`corepack pnpm build`，并在浏览器实际检查首页、详情、iframe、返回、全屏、果切、房间和视觉实验室。

构建通过只能证明代码和产物在规定范围内正确；实际打开一个 iframe、进入果切并开始一局、允许摄像头后观察模型是否加载，才能验证这次改动真正触及的用户行为。

