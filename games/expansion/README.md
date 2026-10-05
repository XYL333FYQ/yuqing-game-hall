# 20 款静态游戏的维护

用户玩法和来源清单见项目根目录 `NEW_GAMES.md`。日常构建使用已经提交的运行包，不会自动下载上游，也不需要额外服务。

- `SOURCES.json`：固定上游仓库、提交、许可和中文资料。
- `ADAPTATIONS.json`：每款实际接入改动。
- `runtime-assets.json`：完整运行资源清单；根目录资源检查器会拒绝缺失地图、音频、脚本和封面。
- `overrides/`：三份修改后的 TypeScript；纸牌远征的重复 super 修复写在重建脚本中。
- `vendor/`：积木城堡原依赖 natlib 0.1.13，MIT，供对应源码包保留完整来源。
- `browser-smoke.js`：正式 Pages 安全策略下的桌面浏览器入门操作检查。
- `VERIFICATION.json`：实际验证结果与范围。

更新时先准备固定版本的上游 checkout，按 `SOURCES.json` 的 folder 放在 `game-sources/upstream/expansion/`。普通构建不依赖这些本地 checkout。

四款需要重新编译的游戏可使用：

```powershell
node games/expansion/build-adapted.mjs casual-crusade
node games/expansion/build-adapted.mjs norman-necromancer
node games/expansion/build-adapted.mjs backcountry
node games/expansion/build-adapted.mjs thirteenth-floor
```

其他游戏的修改后可读运行脚本就在 `public/games/<id>`，上游偏好的源码同时保存在每款 `source.zip`。保持共享中文层和相对资源路径。不要将原作开发入口覆盖到正式入口。

修改运行包后，检查实际游玩，再更新清单和对应源码：

```powershell
node games/expansion/record-assets.mjs
python games/expansion/package_sources.py
npm run build
npm run test:expansion
```

源码打包脚本保留固定提交的程序源码、原构建文件、改动后的运行包及相关许可。去掉大型开发演示图、编译器二进制及重复的未修改音频；运行所需音频仍在包内。源码 ZIP 随游戏发布，不能当成开发垃圾删除。

浏览器验证先运行 `npx wrangler pages dev dist --port 5292`，再使用 Playwright CLI 已打开的浏览器会话运行 `run-code --filename=games/expansion/browser-smoke.js`。它会实际进入游戏并操作，记录脚本错误、资源失败与外站请求；仍需人工看截图，不能代替完整通关验证。
