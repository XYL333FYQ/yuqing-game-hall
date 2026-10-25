# 新增一款游戏

先用一条命令生成清单，再准备实际运行文件并填写清单。清单通过校验后会进入大厅目录，不需要手改首页、通用详情页、播放器或 `src/generated/gameCatalog.ts`。

清单只能注册游戏，不能代替 HTML、素材、构建过程或专用后端。目录职责见 [架构中的新增游戏决策](../ARCHITECTURE.md#11-新增游戏决策)，后端接入的原因见 [新游戏为什么不总是只加 JSON](games/board-games.md#新游戏为什么不总是只加-json)。

## 生成待填写的清单

在仓库根目录运行，`star-map` 换成新游戏 id：

```powershell
npm run game:new -- star-map
# 等价于 node scripts/new-game.mjs star-map

npm run game:new -- star-map --external
# 等价于 node scripts/new-game.mjs star-map --external
```

普通模式只生成 `public/games/<id>/game.json`；`--external` 只生成 `external-games/<id>/game.json`。不会生成占位 HTML、封面、后端或修改游戏目录成品。

- id 与现有校验器一致：`^[a-z0-9]+(?:-[a-z0-9]+)*$`，只能使用小写字母、数字和单个连字符，首尾不能是连字符。
- 会检查三个清单根目录 `public/games/`、`external-games/`、`game-sources/rejected/`。跨目录重复 id、已有同名目录都拒绝，不覆盖已有文件。
- `schemaVersion` 固定为 `3`；`order` 自动取全部现有清单（包括不可运行项目）的最大值加 1。现有清单无效时先修正它，再创建下一款；命令不会跳过坏清单猜测排序。
- `TODO:字段名`、空字符串 `""`、数组里的空字符串和布尔字段中的 `null` 都是待填写占位值。替换整个占位数组，不要只往后追加合法值。`tags`、`highlights`、`cautions`、`capabilities`、`permissions` 没有适用项时可以填 `[]`。
- `genres` 必须选 1～2 项。`audiences`、`inputs`、`devices` 按实际支持情况填写，不能根据“网页一般都支持”推断；`vision` 必须明确改成 `true` 或 `false`。

未完成的模板故意不能通过现有校验器。例如 `theme.accent 与 theme.dark 必须是十六进制颜色`、`discovery.genres 含词表外的 id` 都会指出具体配置项；每次修正后再运行 `npm run games:catalog`，直到通过。不要把空文案替换成无实际含义的“待填写”：校验器能检查结构与已知一致性，不能证明介绍、许可或支持设备的事实正确。

## 三种接入情况

### 静态游戏

1. 运行 `npm run game:new -- <id>`。
2. 将真实 HTML / JS / CSS / 图片 / 音频和许可文件放入 `public/games/<id>/`。自维护游戏如需构建，源码放在 `games/<id>/`，沿用项目构建约定，确保成品进入该公开目录。`public/` 下禁止放后端源码、密钥和开发资料。
3. 填好 `game.json`。通常保留 `platform.hosting: "static"`、`platform.launch.kind: "iframe"` 和 `presentation.availability.state: "playable"`；`launch.entry` 指向真实的 `/games/<id>/index.html`，入口不同就改成自己的 HTML 文件。
4. 选择玩法分类、人数和联机方式。纯单机或同屏双人使用 `online: "none"`；浏览器静态客户端也可能依赖房间、信令或 TURN，须按真实联机方式标注。
5. 加入实际封面等可选资源路径，维护来源与许可说明，运行本文的提交前命令；实际打开介绍页和 iframe，验证启动、输入、声音及声明支持的设备。

### 需要自维护后端的游戏

1. 同样运行 `npm run game:new -- <id>`，保留浏览器运行包和 iframe 入口；将 `platform.hosting` 改成 `"hybrid"`。共享或游戏源码按需要放 `games/<id>/`，专用联机数据服务放 `server-games/<id>/`。
2. 填写房间、匹配、人数和能力声明。需要联网对局时，选择 `"friend-room"` 或 `"public"`，并在 `capabilities` 加入 `"multiplayer"`。后端仅提供存档等辅助能力时，按真实玩法判断，不能只因存在后端就标成多人游戏。
3. 浏览器与服务端共用、且需要保留发布副本的 JavaScript，登记到根目录 [shared-sync.json](../shared-sync.json)，只编辑源文件，执行 `node scripts/sync-shared.mjs`，源文件和副本一起提交。果切直接相对路径 import `games/fruit-party/src/shared/`，是已有的另一种共享方式，详见 [共享代码规则](../ARCHITECTURE.md#浏览器与服务端共用代码)。
4. 沿用 [后端维护说明](../server-games/README.md) 接入服务的包配置、测试、Dockerfile、Compose、健康检查、HTTPS/WSS 反向代理和允许来源。新增独立服务还需核对 `.github/workflows/deploy-vps.yml` 的镜像构建、推送和部署步骤；仅放入一个新目录不会自动获得完整部署支持。
5. 新增公开服务地址时，按已有方式维护 `functions/api/runtime-config.js`、`server-games/scripts/generate-env.mjs`、`server-games/scripts/sync-pages-config.mjs` 及相关部署配置；地址从运行时配置读取，凭据不写进公开文件。接入相关检查命令后，单独验证后端健康检查、真实双客户端建房/加入/同步/重连；WebRTC 还要验证跨网络与 TURN。

这些是按需要增加的实现工作，脚手架不会安装或部署任意后端。已有服务是否可复用，也应先看其协议和权威状态模型。

### 第三方服务器游戏

1. 运行 `npm run game:new -- <id> --external`。
2. 填写 `external-games/<id>/game.json`，保留 `platform.hosting: "server"`、`platform.launch.kind: "external"`、`presentation.availability.state: "external"`，把 `platform.launch.url` 换成实际 HTTPS 游玩地址。
3. 选择 `online: "friend-room"` 或 `"public"`，并添加 `capabilities: ["multiplayer"]` 或其他真实支持的能力。当前校验器不接受 `hosting: "server"` 与 `online: "none"` 的组合。
4. `platform.sourceUrl` 填 HTTPS 来源地址；许可、技术、可用性与风险写在 `platform`，玩家介绍只描述玩法。需要自有封面时，将资源放入可公开的 `public/games/<id>/` 并引用站内绝对路径；第三方服务器源码不放 `public/`。
5. 运行提交前命令，实际打开外部入口并验证地址与玩法。第三方网站是否可用仍需人工确认，清单校验不能验证它的在线状态。

许可或运行条件不允许发布的项目走 `game-sources/rejected/`、`hosting: "restricted"`、`availability.state: "unavailable"`、`launch.kind: "none"`，不使用脚手架假装生成可玩的游戏。

## game.json 字段

类型定义以 [game-manifest.ts](../src/platform/game-manifest.ts) 为准，结构与一致性检查以 [目录生成器](../scripts/generate-game-catalog.mjs) 为准。下表标注“可选”的字段可以省略；脚手架已给出其他字段的骨架。

| 字段 | 含义与可选值 |
| --- | --- |
| `schemaVersion` | 当前只能是数字 `3`。 |
| `id` | 全目录唯一标识；格式见上文，和启动路径对应。 |
| `order` | 全目录唯一、正整数排序值；生成器按它排序，脚手架自动分配。 |
| `featured`（可选） | 旧清单兼容布尔值；当前首页推荐不按它筛选，不需要为新游戏添加。 |
| `theme.accent`、`theme.dark` | 强调色和深色，均为六位十六进制颜色，例如 `#123456`。 |
| `discovery.genres` | 1～2 个分类 id；唯一词表为 [game-taxonomy.json](../src/platform/game-taxonomy.json) 的 `genres`。 |
| `discovery.online` | 唯一词表同文件的 `onlineModes`：`none`、`friend-room`、`public`；按下节判定。 |
| `discovery.audiences` | 人数筛选数组：`single`（单人）、`duo`（双人）、`multi`（多人）。可按真实模式组合；`multi` 受联机一致性规则约束。 |
| `discovery.popularRank`（可选） | 旧目录中的热门排序数据，填写时须为正整数；当前首页热门按会话兴趣和轮换选择，不必新增手工排名。 |
| `discovery.featuredRank`（可选） | 旧清单兼容精选排名，填写时须为正整数；当前首页精选轮换不使用它。 |
| `presentation.title` | 玩家看到的游戏名称，非空字符串。 |
| `presentation.originalTitle`（可选） | 非空原名称，便于识别上游作品。 |
| `presentation.mark` | 卡片短标记，非空字符串。 |
| `presentation.category` | 展示副标题，非空字符串；不参与分类筛选，筛选使用 `discovery.genres`。 |
| `presentation.tagline`、`presentation.description` | 一句话介绍和详细玩法介绍，均须非空。 |
| `presentation.tags` | 简短玩法标签字符串数组；不重复人数和联机字段，允许 `[]`。 |
| `presentation.play.modes`、`players`、`controls` | 分别描述模式、实际人数/座位和操作方式，均为非空字符串。人数范围写这里，不写进 tags。 |
| `presentation.play.inputs` | 输入方式数组：`keyboard`、`mouse`、`touch`、`gamepad`、`vision`。 |
| `presentation.play.devices` | 支持设备数组：`desktop`、`mobile`。 |
| `presentation.play.vision` | 是否支持体感的明确布尔值，`true` 或 `false`。 |
| `presentation.highlights` | 玩家关心的玩法亮点字符串数组，允许 `[]`。 |
| `presentation.art` | 图片配置对象，必须保留对象本身，暂时没有图片时可以是 `{}`。 |
| `presentation.art.icon`、`cover`、`hero`（可选） | 图标、封面、大图；站内绝对资源路径，必须以 `/` 开头且不含 `..`。 |
| `presentation.art.screenshots`（可选） | 截图路径数组，每项同样是安全的站内绝对路径。 |
| `presentation.availability.state` | `playable`（站内可玩）、`external`（外部体验）、`unavailable`（不可运行）；须与 launch 一致。 |
| `presentation.availability.label` | 非空可用性展示文案。 |
| `presentation.actionLabel` | 非空入口按钮文案。 |
| `platform.hosting` | `static`（静态运行包）、`hybrid`（静态客户端＋自维护后端）、`server`（当前用于第三方服务器入口）、`restricted`（受限不可运行）。 |
| `platform.technology` | 非空技术实现说明。 |
| `platform.license` | 非空许可说明；按实际来源确认，不使用脚手架猜测值。 |
| `platform.sourceUrl` | HTTPS 来源地址，不能保留 TODO。 |
| `platform.localization` | 非空本地化说明。 |
| `platform.fit` | 非空接入适用性/维护判断。 |
| `platform.highlights`、`platform.cautions` | 技术优点与维护风险字符串数组，允许 `[]`。 |
| `platform.launch.kind` | `iframe`、`external` 或 `none`；`native` 已移除。对应字段见下表。 |
| `capabilities`（可选） | 能力数组：`audio`、`multiplayer`、`vision`、`fullscreen`、`gamepad`、`storage`。联机时不能省略 `multiplayer`。 |
| `permissions`（可选） | iframe 权限声明数组：`camera`、`microphone`、`fullscreen`、`autoplay`、`gamepad`；只声明实际需要的权限。 |

| 启动方式的字段 | 规则 |
| --- | --- |
| `kind: "iframe"` 的 `entry` | 必填，该游戏目录下的明确 HTML：以 `/games/<id>/` 开头、以 `.html` 结尾、不含 `..`。资源检查还会确认文件存在。 |
| `kind: "iframe"` 的 `startUrl`（可选） | 站内启动地址，可加查询参数；以 `/` 开头、不含 `..`，解析后必须同源且仍指向 `entry` 的 HTML。 |
| `kind: "iframe"` 的 `upstreamUrl`（可选） | HTTP(S) 上游地址。 |
| `kind: "external"` 的 `url` | 必填 HTTPS 游玩地址，同时要求 `platform.hosting: "server"`。 |
| `kind: "none"` | 不带入口，只用于 `platform.hosting: "restricted"`。 |

## 怎么选分类

分类 id、展示名称和每一类的定义都只写在 [game-taxonomy.json](../src/platform/game-taxonomy.json)：`genres` 是 id 与名称，`genreGuide` 是定义和边界。这里不重复抄一份，避免两处不一致。新增分类先改词表和定义，不要自行创造近义 id。

判断原则：**按核心玩法归类，不按题材或载体归类。** 例如用了扑克牌元素、但玩家主要在地牢里探索和构筑卡组的游戏，不属于“棋牌”，应选“策略塔防”或“动作冒险”。选 1~2 项，拿不准时选最能描述玩家主要在做什么的那项。

校验器只能检查分类 id 合法，检查不出归得对不对，所以填完分类后请对照 `genreGuide` 再看一遍。

## 联机三档怎么判定

| `discovery.online` | 判定标准 |
| --- | --- |
| `none` | 没有跨设备联网对局；单人、同屏双人都可属于此档。不能因为有排行榜、下载资源或辅助 HTTP 请求就标成联机。 |
| `friend-room` | 主要通过房间号、邀请、私人房间组织同一局；可以有 AI 补位、观众或可见的房间列表。能公开一个房间，不等于主玩法属于公开大房间匹配。 |
| `public` | 主要通过公开匹配或公共大房间与陌生玩家参与同一局。支持私人邀请也不妨碍主入口归此档。 |

同时支持两档联机时，按主要游玩入口选择一档，其他模式在 `presentation.play.modes` 中说明；这是维护判定，校验器不能从游戏实现中自动推断。词表中的标签为“单机”“房间码/私人房间”“公开匹配/大房间”。

目录生成器已经强制执行以下一致性规则：

- `online` 不是 `none` 时，`capabilities` 必须含 `multiplayer`；反过来，含 `multiplayer` 时，`online` 不能是 `none`。
- `audiences` 含 `multi` 时，`online` 必须是 `friend-room` 或 `public`；`hosting: "server"` 同样不能使用 `online: "none"`。
- `presentation.tags` 禁止完整标签 `单人`、`双人`、`多人`、`联机`、`好友联机`、`本地双人`，以及形如 `2人`、`2-4人`、`2–4人` 的人数标签。人数放 `audiences`，联机放 `online`，具体座位范围放 `play.players`。
- `availability.state: "playable"` 不能使用 `launch.kind: "none"`；`external` 状态必须使用 `external` 启动方式；`unavailable` 状态必须使用 `none`。
- `presentation` 中标题、原名、标记、分类文案、短介绍、描述、按钮文案、tags 和 highlights 不得包含平台实现、部署或许可说明。相关检查词包括“静态版、部署、架构、技术栈、技术结构、WebSocket、Cloudflare、服务器、许可证、源码、中文化、适配、接入”；这些维护信息写入 `platform`。

这些是当前检查实际覆盖的约束，不代表所有事实都能自动验证；实际人数、输入方式、许可和在线可用性仍需人工核实。

## 提交前必须运行

先完成清单和真实入口。若改动了共享代码，先生成发布副本，再运行检查：

```powershell
node scripts/sync-shared.mjs
npm run games:catalog
node scripts/sync-shared.mjs --check
npm run check:platform
npm run check:games
npm test
npm run build
git diff --check
git status
```

`games:catalog` 检查清单并更新 `src/generated/gameCatalog.ts`；`check:platform` 还检查共享副本、架构边界、编码和平台类型；`check:games` 检查实际静态入口和资源；`build` 再执行完整静态构建与部署产物检查。`prebuild` 会先检查共享副本，不会在构建时默默修复未同步内容。

若增加后端，还必须运行该服务自己的检查与测试；例如棋牌服务使用 `pnpm --dir server-games/card-room check` 和 `pnpm --dir server-games/card-room test`。改了运行时配置或环境生成流程还要运行 `npm run server:config:test`。将新服务的检查/测试接入相应根命令，并完成前述真实联机验收。

检查生成器的差异，连同新清单、真实运行资源及必要的共享副本一起审阅。构建成功只能证明通过这些检查，不等于游戏交互或线上部署已经正确；提交和部署仍按当前任务的授权执行。
