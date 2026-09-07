# 上游源码副本索引

`game-sources/upstream/` 保存第三方原始仓库的本地副本，不直接进入 Vite 的 `dist`。完整项目归档保留该目录；GPT 精简归档只携带本索引、上游仓库中的说明/许可证/Manifest/包配置文件，省略大型依赖和构建缓存。

| 上游目录 | 在大厅中的对应项目 | 当前运行位置 | 备注 |
| --- | --- | --- | --- |
| `der-koloss-ce/` | Der Koloss CE | `public/games/der-koloss/` | 静态 iframe 运行包，发布前仍需继续审查素材许可 |
| `Sanctuarys_End/` | Sanctuary's End | `public/games/sanctuarys-end/` | 静态 iframe 运行包 |
| `LittleJSArcade/` | LittleJS Arcade | `public/games/littlejs-arcade/` | 静态 iframe 运行包 |
| `pvp/` | PVP Arena | `public/games/pvp-arena/` | 静态 iframe 运行包 |
| `HexGL/` | HexGL | `public/games/hexgl/` | 静态 iframe 运行包 |
| `suroi/` | Suroi | `server-games/suroi/` | 需要独立 Bun/WebSocket 服务 |
| `scribble-rs/` | Scribble.rs | `server-games/scribble/` | 需要独立服务 |
| `tosios/` | TOSIOS | `server-games/tosios/` | 需要独立服务 |
| `OpenFrontIO/` | OpenFront | `server-games/openfront/` | 需要独立服务 |
| `Kaetram-Open/` | Kaetram | `game-sources/rejected/kaetram/` | 许可证限制，不进入发布包 |

更新第三方项目时，应先在上游目录中确认版本和许可证，再生成或整理发布目录中的独立运行包，并重新运行 `corepack pnpm check:games` 与 `corepack pnpm build`。不要让大厅直接从 `game-sources/upstream/` import 或读取运行文件。
