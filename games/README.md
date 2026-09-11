# 游戏开发资料与运行包边界

`games/` 保存本项目维护的游戏源码，以及不能发布给浏览器的开发资料；`public/games/` 只保存可直接运行的 HTML、JavaScript、CSS、模型、图片、音频、字体、许可和每款游戏的 `game.json`。

当前开发目录：

- `fruit-party/`：完整 TypeScript/Canvas 游戏源码，构建后写入 `public/games/fruit-party/`；
- `sanctuarys-end/`：指向静态运行包的类型、格式化配置和维护文档；
- `littlejs-arcade/`：运行时不需要的 TypeScript 类型声明；
- `hexgl/`：运行时不需要的 CoffeeScript 原始源码。

完整上游仓库统一保存在 `game-sources/upstream/`，不参与构建，也不上传 Cloudflare。第三方服务器游戏的简介和跳转地址则位于 `external-games/`。

每个可启动的静态运行包必须在 `public/games/<id>/game.json` 声明 iframe 入口。大厅只读取 Manifest 并创建 iframe，不 import 或改写游戏内部逻辑。
