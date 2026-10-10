# 第二批 10 款中文静态游戏（2026-10-10）

本批选完整、可反复游玩的经典玩法：关卡、连续波次、计分、推理反馈或对弈。中文覆盖主要菜单、操作说明和结束提示。所有游戏通过各自 `game.json` 与独立 iframe 接入，自动参与首页精选与热门候选池；不需要改首页游戏名单。

| 游戏 | 玩法与选择理由 | 设备 | 上游 |
| --- | --- | --- | --- |
| 自由布阵塔防 | 围墙改变敌人路线，多种火力、升级、连续波次 | 电脑 | [oldj/html5-tower-defense](https://github.com/oldj/html5-tower-defense) |
| 2048 合成 | 经典整盘合成，棋盘与最高分本地保存 | 电脑 / 手机 | [gabrielecirulli/2048](https://github.com/gabrielecirulli/2048) |
| 俄罗斯方块 | 七种方块、下一块预览、消行加速 | 电脑 | [jakesgordon/javascript-tetris](https://github.com/jakesgordon/javascript-tetris) |
| 弹球打砖块 | 多关卡、挡板角度控制、生命和计分 | 电脑 / 手机 | [jakesgordon/javascript-breakout](https://github.com/jakesgordon/javascript-breakout) |
| 百关推箱子 | 100 张地图，规划走位、推箱、重玩 | 电脑 | [shunyue1320/sokoban](https://github.com/shunyue1320/sokoban) |
| 中国象棋 | 小巫师搜索引擎、三种水平、先后手、让子、悔棋 | 电脑，人机 / 同屏双人 | [xqbase/xqwlight](https://github.com/xqbase/xqwlight) |
| 黑白棋 | 夹吃翻子、合法落点、撤销与重做 | 电脑，同屏双人 | [NXY666/othello-board](https://github.com/NXY666/othello-board) |
| 图案解锁 | 依据点位和顺序反馈破译图案，练习 / 限次 / 计时 | 电脑 / 手机 | [maxwellito/breaklock](https://github.com/maxwellito/breaklock) |
| 经典扫雷 | 首击安全，插旗、快速展开、自定义难度、暂停 | 电脑 | [junjie-xu-lab/minesweeper](https://github.com/junjie-xu-lab/minesweeper) |
| 陨石突围 | 转向推进射击、陨石分裂、飞碟、连续关卡 | 电脑 | [dmcinnes/HTML5-Asteroids](https://github.com/dmcinnes/HTML5-Asteroids) |

是否“好玩”仍是个人口味；本批优先用完整规则、反复挑战和实际操作筛选，建议先试塔防、图案解锁、打砖块与百关推箱子。没有把仅能加载的演示作为完成标准。

## 已完成的实际游玩检查

- 塔防：鼠标建塔、扣费、敌人第一波、暂停与重开。
- 2048：键盘合并、计分、重开；中文计分和结果提示。
- 俄罗斯方块：开始、移动、落地、计分、结束与重开。
- 打砖块：选关、开始发球、挡板移动、击砖计分；音效使用本地资源。
- 推箱子：键盘移动、重玩、关卡切换，确认包含 100 张地图。
- 象棋：玩家走子、电脑回复、悔棋、重开；原引擎规则与搜索回退检查。
- 黑白棋：开局、双方落子、夹吃翻子、撤销、重做。
- 图案解锁：开始、鼠标连四点、尝试计数与反馈、放弃。
- 扫雷：首击展开、右键插旗、暂停继续、重开、切换 16×16 难度。
- 陨石：开始、推进转向、射击计分、暂停继续。

上述测试使用真实 Chromium 浏览器；封面取自游戏实测画面。程序测试和构建记录由相关命令输出提供，未声称完成全部 100 关或所有游戏长期平衡测试。

## 部署与来源

本批全部是静态资源，沿用项目的 Cloudflare Pages 发布流程；马来 VPS 上现有房间、棋牌等后端不需要为这些单机游戏更新。大厅现在显示 44 款，项目共 45 份清单，其中一个原有条目不可用。精选轮播和热门换批均从完整可用候选池选取，新接入的 10 款无需额外设置推荐标记。

固定提交、许可证、重新构建方法与适配细节在 `games/classics/`。每款保留 `LICENSE`、`SOURCE.md` 和 `source.zip`；第三方署名见 `THIRD_PARTY_NOTICES.md`。没有依赖运行时 CDN、原站服务器或付费 API。
