# 追加十二款中文静态游戏

这批沿用完整开源游戏的原引擎与玩法；菜单、操作说明和主要反馈中文化，运行资源本地提供。全部从 game.json 接入首页和播放器，也自动进入精选与热门候选池。

| 游戏 | 玩法 | 上游 |
| --- | --- | --- |
| 双色逻辑 | 四种棋盘大小的红蓝逻辑谜题，生成器、教学、撤销与提示 | [florisluiten/0hh1](https://github.com/florisluiten/0hh1) |
| 视线谜阵 | 数字视线推理、四种大小、教学与提示 | [Techdojo/0hn0](https://github.com/Techdojo/0hn0) |
| 麻将叠叠消 | 单人立体配对，84 种布局、可解牌局、提示与撤销 | [ffalt/mah](https://github.com/ffalt/mah) |
| 九宫数独 | 三档题库、冲突提示与自动保存 | [andreynering/sudoku](https://github.com/andreynering/sudoku) |
| 经典纸牌接龙 | 七列纸牌、翻三张、整组拖动与自动收牌 | [rjanjic/js-solitaire](https://github.com/rjanjic/js-solitaire) |
| 数织画谜 | 三张不同大小的内置画谜及关卡导入导出 | [jodua/nonograms](https://github.com/jodua/nonograms) |
| 四子连线 | 同屏双人落子，横竖斜四连获胜 | [bryanbraun/connect-four](https://github.com/bryanbraun/connect-four) |
| 国际象棋 | 本地电脑对弈、升变、易位、吃过路兵与悔棋 | [kbjorklu/chess](https://github.com/kbjorklu/chess) |
| 舰队猎手 | 摆放五艘舰船，与电脑轮流射击、追踪命中 | [Shahir-47/Battleship](https://github.com/Shahir-47/Battleship) |
| 贪吃蛇挑战 | 五档速度、加速挑战、十四种外观和纪录 | [patorjk/JavaScript-Snake](https://github.com/patorjk/JavaScript-Snake) |
| 五彩连珠 | 九乘九路线消除、新球预告、连珠得分和纪录 | [arnisritins/Color-Lines](https://github.com/arnisritins/Color-Lines) |
| 摩天楼建造 | 点击放下摇摆楼层、完美落点奖励和三次失误机会 | [iamkun/tower_game](https://github.com/iamkun/tower_game) |

桌面浏览器检查覆盖逻辑填格与撤销、数独输入及刷新恢复、接龙发牌与重开、数织完整解题、四子连线胜负、国际象棋走子与电脑回复及悔棋、海战部署舰船与双方射击、贪吃蛇暂停继续、连珠移动和新增彩球、叠塔落层、麻将消除和撤销。资源检查覆盖十二款启动、运行时错误、缺失资源与外站资源请求。测试不代表已完成每一局或所有长期平衡验证。

全部通过现有 Cloudflare Pages 发布，不需要给马来 VPS 新增进程。大厅现有 56 款可用游戏，57 份清单中有一款原有条目不可用。维护方法见 games/collection12/README.md；每款的固定来源、完整许可与源码包见自身目录。
