# 经典中文游戏运行包

日常大厅构建直接使用 `public/games/` 中已提交的静态包，不联网拉取原作，也不安装原作构建依赖。固定来源在 `SOURCES.json`，完整运行文件在 `runtime-assets.json`。

维护时在 `game-sources/upstream/classics/<folder>` 克隆对应仓库，并检出 `SOURCES.json` 指定的提交。重新生成需要 Node.js、npm、Git、Python：

```powershell
node games/classics/prepare-builds.mjs
node games/classics/import-games.mjs
python games/classics/package_sources.py
npm.cmd run games:catalog
npm.cmd run check:games
node --test games/classics/runtime.test.mjs
```

只有扫雷和图案解锁需要编译。扫雷使用上游锁文件，并将未保存语言偏好时的默认语言设为中文；图案解锁用本目录 `build-inputs/breaklock/` 的 package.json/lock 替换原作的过时 node-sass，使用 Dart Sass。安装与编译都在忽略的上游目录内进行，不改变大厅依赖。

`import-games.mjs` 的替换锚点缺失或提交不匹配时会报错，避免原作更新后悄悄漏掉适配。它不覆盖已捕获的 `cover.png` 和源码压缩包。封面来自实际运行截图；玩法验收记录见根目录 `CLASSIC_GAMES.md`。

象棋只引入 XiangQi Wizard Light 的 JavaScript 版本，将 GBK 文本转为 UTF-8；声音改为程序合成。图案解锁移除原作针对 `/breaklock/` 的跨语言自动跳转和全站 Service Worker；扫雷保留仅在自身游戏目录生效的离线缓存。打砖块改用现代 Audio API，并对本地存储键加游戏前缀。黑白棋移除外站字体和背景；2048 移除字体下载，并使用独立存储键。陨石射击使用系统字体显示中文及合成音效。

各款 `/games/<id>/source.zip` 同时提供固定上游的可编辑源码、确切修改后运行包、构建输入和本目录维护脚本。象棋及其衍生改动按 GPL-2.0-or-later 发布，其余按各自的 MIT 许可；打砖块原音频保持未改动，并保留上游 CC BY-ND 2.0 署名声明。
