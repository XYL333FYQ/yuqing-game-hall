// Original tutorial, localized; Q42 MIT license is retained in this game directory.
const tutorialZh=['点击格子，把它变成红色。','再点一次，格子会变成蓝色。','同一行不能连续出现三个红格。','同一行也不能连续出现三个蓝格。','同一列同样不能连续出现三个同色格。','填满的一行必须红蓝数量相等。','每列的两种颜色也必须各占一半。','试着根据已有颜色推理这两个格子。','不能有两行完全相同。','遇到困难，点击眼睛获取提示。'];
Object.keys(TutorialMessages).forEach((k,i)=>TutorialMessages[k].msg=tutorialZh[i]);
Object.assign(HintType,{RowsMustBeUnique:'不能有两行完全相同。',ColsMustBeUnique:'不能有两列完全相同。',RowMustBeBalanced:'每行红蓝数量必须相等。',ColMustBeBalanced:'每列红蓝数量必须相等。',MaxTwoRed:'不能连续出现三个红格。',MaxTwoBlue:'不能连续出现三个蓝格。',SinglePossibleRowCombo:'这里仅有一种合法组合。',SinglePossibleColCombo:'这里仅有一种合法组合。',Error:'这个格子似乎不对。',Errors:'这些格子似乎不对。'});
