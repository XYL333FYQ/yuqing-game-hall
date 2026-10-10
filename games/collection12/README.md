# 追加十二款中文静态游戏

来源与固定提交见 SOURCES.json。大厅部署只复制已提交的 public/games 运行包，不下载或编译上游项目。重新生成时，将对应仓库检出到 game-sources/upstream/next12/<folder>，使用 Node.js、npm、Git 和 Python：

```powershell
node games/collection12/prepare-builds.mjs
node games/collection12/import-games.mjs
python games/collection12/package_sources.py
npm.cmd run games:catalog
npm.cmd run check:games
node --test games/collection12/runtime.test.mjs
```

麻将使用上游锁文件构建；数织使用本目录锁文件与固定依赖，通过 esbuild 编译；接龙和海战使用麻将构建环境内锁定的 esbuild/Sass。日常大厅依赖不受影响。数织采用 HashRouter、中文语言资源和独立存储键，修正重复事件绑定和触屏笔记本无法鼠标填格的问题。四子连线允许点击一列的任意位置落子。

两款逻辑谜题保留生成器、教程、提示和撤销，用本目录 translations 替换可见反馈。数独保留原打包版本，并同时提供修改后的首选源文件及 React 0.14 的 BSD 许可和 PATENTS。国际象棋用本地 jQuery，不分发非运行必需的测试网页。麻将仅使用公共领域 Unicode 牌面与 Cangjie6 的 CC BY-SA 4.0 百搭牌，保留署名和完整许可；移除未使用的其他牌面、字体和背景。叠塔移除统计脚本与第三方字体，保留原作完整引擎、音乐和素材。

source.zip 含固定上游可编辑源码、修改后的运行包、编译游戏的修改后首选源码，以及本目录适配和构建脚本。未使用且不随运行包发布的字体、音乐、其他麻将牌面不会进入源码包。封面来自实际游玩截图，资源检查包含全部运行文件、封面、许可和源码包。
