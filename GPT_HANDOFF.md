# 给 GPT 的雨晴游戏厅项目资料包说明

这是雨晴游戏厅项目的交接说明。建议先阅读以下文件，再查看源码：

1. `CHAT_TRANSCRIPT.md`：本次对话原文，包括用户需求、架构讨论、果切是否使用 iframe 的说明，以及当前打包请求。
2. `ARCHITECTURE.md`：当前架构、目录职责、运行链路、Manifest 机制、构建流程和未来风险。
3. `README.md`：运行命令、页面地址、游戏接入步骤、联机和视觉功能说明。
4. `SOURCE_AUDIT.md`、`THIRD_PARTY_NOTICES.md`：第三方来源、许可证和发布审查。
5. `src/platform/`、`src/portal/`、`src/pages/`：大厅核心。
6. `games/fruit-party/`：果切派对独立静态游戏源码与构建入口。
7. `public/games/`：第三方静态 iframe 运行包。
8. `server-games/`：需要独立服务器的游戏边界。
9. `game-sources/upstream/`：上游源码副本，只用于追溯和同步，不是大厅运行目录。

## 当前结论

大厅通过构建时扫描 `game.json` 生成 `src/generated/gameCatalog.ts`。普通静态游戏放入 `public/games/<id>/` 并添加 Manifest 后，不需要修改首页、通用详情页、通用播放器或手写注册表。

果切没有使用 iframe。它是 `games/fruit-party/` 中的原生 Vite 模块，拥有自己的 `game.json`、`routes.ts`、引擎、输入、渲染、音频、页面和测试。大厅只发现它的路由，不进入它的玩法实现。这是已经完成的第一阶段低耦合；它仍与主项目共用 Vite、页面壳、共享比赛协议和 Cloudflare Durable Object，因此还不是完全独立构建的子项目。

第三方静态游戏使用 iframe；Suroi、Scribble、TOSIOS、OpenFront 使用外部服务器入口；Kaetram 因许可证限制只保留说明。

## 验证状态

最近一次验证通过：

- `corepack pnpm check`
- `corepack pnpm test`：11 个测试文件、65 项测试通过
- `corepack pnpm check:games`
- `corepack pnpm build`：Vite、Cloudflare 静态资源限制、Worker dry-run 和 Worker 体积检查通过

## 归档范围

完整归档保留项目源码、第三方静态资源、生产构建目录 `dist/`、测试截图 `output/playwright/`、上游源码副本、Manifest、脚本、测试、配置、文档和对话记录。为了避免把无法用于理解项目的本机缓存混进资料包，两个归档都排除 `node_modules/`、`.git/`、`.wrangler/`、`.playwright-cli/`、临时 Wrangler 输出和日志；这些内容可以通过 `pnpm install` 或构建重新生成。完整归档会保留 `game-sources/upstream/`，所以体积较大；GPT 精简归档只保留上游仓库的说明、许可证、Manifest 和目录索引，不复制约 1.9 GB 的原始上游文件。
