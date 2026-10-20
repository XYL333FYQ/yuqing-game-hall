# 项目文档

## 日常维护

- [项目说明与运行命令](../README.md)
- [架构、目录职责与部署边界](../ARCHITECTURE.md)
- [许可声明](../THIRD_PARTY_NOTICES.md)
- [来源审计](../SOURCE_AUDIT.md)与[上游源码索引](../UPSTREAM_SOURCE_INDEX.md)

## 游戏接入与运行资料

- [棋牌、联机配置与更换 VPS](games/board-games.md)
- [首批 20 款游戏](games/new-games.md)
- [经典 10 款游戏](games/classic-games.md)
- [追加 12 款游戏](games/collection12-games.md)

后三份是接入批次记录，其中数量和验收时间只描述对应批次；当前目录以 `game.json` 和生成的游戏库为准。

## 设计与验收记录

`superpowers/specs/` 和 `superpowers/plans/` 保存历史需求、设计与阶段验收，供追溯使用。实际实现和当前命令以源码、根目录文档及 `package.json` 为准。

`maintenance/` 保存跨模块维护和清理结论。截图、录屏等本地验证材料位于被 Git 忽略的 `output/`，不进入构建或部署；确认被记录引用的证据和独有辅助源码应保留。
