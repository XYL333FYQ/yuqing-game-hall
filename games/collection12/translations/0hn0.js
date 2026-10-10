// Original tutorial, localized; Q42 MIT license is retained in this game directory.
const tutorialZh=['蓝点能看见同行同列的其他蓝点。','数字表示它能看见的蓝点数量。','红点会阻挡视线。','这个 2 只能看见右侧。','把右边两个点变成蓝色。','点击两次，把末尾变成红点，隔断视线。','这个 1 已经看见了下方的一个蓝点。','封住它的另一条视线。','这个 3 只能看见上下；上方已有一个蓝点。','再补两个蓝点，让它看见三个。','试着填好剩余格子。',''];
TutorialMessages.forEach((m,i)=>m.msg=tutorialZh[i]+(m.next?'<span id="nextdot"></span>':''));
Object.assign(HintType,{OneDirectionLeft:'这个数字只剩一个可延伸的方向。',ValueReached:'这个数字已看见足够的蓝点。',WouldExceed:'继续延伸会超过这个数字。',OneDirectionRequired:'所有合法答案都包含这个蓝点。',MustBeWall:'这里必须用红点阻挡视线。',ErrorClosedTooEarly:'这个数字看见的蓝点不足。',ErrorClosedTooLate:'这个数字看见的蓝点过多。',Error:'这个格子似乎不对。',Errors:'这些格子似乎不对。',LockedIn:'每个蓝点至少要看见另一个蓝点。',GameContinued:'可以继续上次未完成的棋盘。'});
