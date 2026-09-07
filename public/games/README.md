# 正式游戏运行包

这里的目录会随雨晴游戏厅一起进入 Cloudflare Static Assets 构建，与
`game-sources/upstream/` 中保持原样的上游仓库分开。

- `der-koloss/`：孤堡尸潮；已移除上游明确无授权的商业歌曲。
- `sanctuarys-end/`：庇护所终章。
- `littlejs-arcade/`：迷你街机合集；只保留本地游戏，不加载第三方嵌入页。
- `pvp-arena/`：像素竞技场；静态版支持单人和本地同屏，公网房间需要独立服务。
- `hexgl/`：极速光轨。
- `_shared/`：游戏厅中文化、直达返回入口和加载就绪桥接。

每个运行包保留其上游许可证和署名。主项目的构建脚本会继续检查单文件
25 MiB 和静态文件总数限制。

## 接入约定

每个可启动的静态游戏目录必须放一份 `game.json`。其中 `launch.kind` 为
`iframe`，`launch.entry` 指向它自己的 HTML 入口；大厅根据该文件生成卡片、
详情页和统一试玩框，不导入或改写游戏内部的 JavaScript。`_shared/yuqing-bridge.js`
只用于已有第三方运行包的中文化、返回入口和 `YUQING_GAME_READY` 加载通知，
不是游戏平台 SDK，也不承载游戏逻辑。
