(() => {
  'use strict';
  // Old js13k audio generators return data: WAV URLs. The platform permits
  // local blob media, so convert those URLs without loosening its CSP.
  const audioUrls=new Map();
  function localAudioUrl(value){
    if(typeof value!=='string'||!value.startsWith('data:audio/'))return value;
    if(audioUrls.has(value))return audioUrls.get(value);
    const comma=value.indexOf(','),header=value.slice(5,comma),body=value.slice(comma+1);
    const raw=header.endsWith(';base64')?atob(body):decodeURIComponent(body);
    const bytes=Uint8Array.from(raw,char=>char.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:header.split(';')[0]}));
    audioUrls.set(value,url);return url;
  }
  const mediaSrc=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
  Object.defineProperty(HTMLMediaElement.prototype,'src',{...mediaSrc,set(value){mediaSrc.set.call(this,localAudioUrl(value));}});
  const NativeAudio=window.Audio;
  function LocalAudio(src){return src===undefined?new NativeAudio():new NativeAudio(localAudioUrl(src));}
  LocalAudio.prototype=NativeAudio.prototype;Object.setPrototypeOf(LocalAudio,NativeAudio);window.Audio=LocalAudio;
  addEventListener('pagehide',()=>{for(const url of audioUrls.values())URL.revokeObjectURL(url);audioUrls.clear();});
  const phrases = {
    'Put them into !':'把它们装进救援舱！','Put them into!':'把它们装进救援舱！','PLAY':'开始游戏','Play':'开始游戏','Play Now':'开始游戏','START':'开始游戏','Start':'开始游戏','New Game':'新游戏','new game':'新游戏','New Game +':'新周目','Continue':'继续','Continue ...':'继续','Confirm':'确认','Cancel':'取消','Done':'完成','Menu':'菜单','MENU':'菜单','Restart':'重新开始','Retry':'重试','Fullscreen':'全屏','Loading...':'正在加载…','Game Over':'游戏结束','Game Over!':'游戏结束','GAME OVER':'游戏结束','YOU DIED':'你倒下了','You Win!':'你赢了！','You won!':'你赢了！','You lost.':'防线失守','PLAY AGAIN':'再玩一次','RESUME':'继续游戏','PAUSED':'已暂停','-paused-':'已暂停','Music':'音乐','MUSIC OFF':'关闭音乐','SFX':'音效','Sound:':'声音：','Delete:':'删除：','Grid:':'网格：','On':'开','Off':'关','Auto':'自动','Level':'关卡','SCORE':'得分','BEST':'最高分','HEALTH':'生命','PROGRESS':'进度','STATS':'统计','CREDITS':'制作名单','CLEAR DATA':'清空存档','Difficulty':'难度','Normal':'普通','Are you sure?':'确定吗？','Import':'导入','Export':'导出','Delete':'删除','Share':'分享','Donate':'支持原作者','Export code:':'导出存档：','Import code:':'导入存档：','Click to start!':'点击开始游戏','Click to Start':'点击开始游戏','Press any key to continue . . .':'按任意键继续…','Click':'点击','sound on.':'开启声音','sound off.':'关闭声音','language.':'语言','github':'GitHub','Press Escape':'按 Esc 继续','CONGRATULATIONS!':'恭喜通关！','THANKS FOR PLAYING!!!':'感谢游玩！','Thank you for playing!':'感谢游玩！',
    'Gridland':'格子大陆','Deaths':'死亡次数','Nights Survived':'度过的夜晚','Consecutive Nights Survived':'连续存活夜数','Tiles Swapped':'交换图块数','Longest Chain':'最长连击','Resources Gathered':'收集资源数','Monsters Killed':'击败怪物数','Most Monsters at Once':'同时击败怪物','Loot Looted':'获得战利品','Spells Cast':'施法次数','Dragons Slain':'击败巨龙数','Casual Nights':'轻松夜晚','Man, this is taking a long time.':'加载时间有点长。','Play without music?':'关闭音乐开始游戏？','Volume':'音量',
    'Tiny Yurts':'小小牧场','Too few people could tend to this farm in time.':'牧场没有及时得到足够人手。','Overlay On/Off':'显示或隐藏网格','Tip: Left click & drag to connect yurts to':'提示：按住左键拖动，把小家连到','farms, or delete paths with right click.':'牧场；右键删除道路。','Tip: Left click & drag to connect yurts tofarms, or delete paths with right click.':'提示：拖动连接小家与牧场，右键删除道路。','RMB':'右键','Jan':'一月','Feb':'二月','Mar':'三月','Apr':'四月','May':'五月','Jun':'六月','Jul':'七月','Aug':'八月','Sep':'九月','Oct':'十月','Nov':'十一月','Dec':'十二月',
    'CASUAL CRUSADE':'纸牌远征','SIEGE ENDED!':'远征结束！','TRY AGAIN?':'再试一次？','PICK YOUR REWARD!':'选择奖励！','PICK YOUR REWARDS!':'选择奖励！','Press F for full screen':'按 F 全屏','FIBONACCI\'S BOON':'额外抽牌','POPE\'S BLESSING':'生命祝福','KHAN\'S LEGACY':'可汗遗产','MAGNA CARTA':'扩容手牌','Draw extra':'额外抽取',' card when ':'张牌，当','placed':'放下时','Recycle ':'回收','random card when ':'随机卡牌，当','stepping':'踏上',' on':'时','Heal':'治疗',' for one when ':'一点，当','Score earned':'获得分数',' for stepping on is ':'踏上该牌时','tenfold':'增加十倍','Doubles':'加倍',' move scores when ':'移动分数，当','Fill neighbours with ':'在周围放置','blank cards':'空白牌','Increase your ':'增加你的','LIFE':'生命','MAX HAND SIZE':'手牌上限',' by ':'，增加','Increases the presented ':'增加可选','reward options':'奖励数量','Allows you to pick an ':'允许额外选择','extra':'一个',' reward':'奖励','Your ':'你的','empty cards':'空白牌',' can open chests':'可以打开宝箱','Stepping on ':'踏上','RED':'红牌',' also ':'时也会','HEALS':'治疗','Double your step ':'加倍移动','Passing by ':'经过','ORANGE':'橙牌',' activates it':'就会激活','Get increased ':'增加','GEM':'宝石',' chance':'获得概率','Once per level, ':'每关一次，','redraw':'重新抽取',' your hand if ':'手牌，若','stuck':'无路可走','Freely revisit ':'可自由重访',' tiles':'牌格',
    '🔥 INFERNAL THRONE 👑':'🔥 夺回地狱王座 👑','(Press any key to start)':'（按任意键开始）','attack':'攻击','jump':'跳跃','move':'移动','map':'地图','aspect 1':'能力一','aspect 2':'能力二','The Crossroads':'十字路口','Undergrowth':'幽暗丛林','Boneyard Caverns':'白骨洞穴','Fields of Mourning':'哀悼原野','Throne Room':'王座大厅','Checkpoint':'存档点','Twisted Horns - [C] or [K] to dash':'扭曲双角：C / K 冲刺','Iron Claws - Climb walls':'钢铁利爪：攀爬墙壁','Fireball - [V] or [L] to cast':'火球：V / L 施放','Wingspan - Double jump to use':'羽翼：再次跳跃可二段跳',
    'THE MEMORY CORE':'记忆核心','Hello, xx142-b2.exe':'你好，十三秒回溯程序。','This is the year 2413,':'现在是 2413 年，','humanity is enslaved by an alien race for more than two centuries already.':'人类已被外星种族奴役了两个多世纪。','You are an AI weaponized virus built to infiltrate the alien network and deactivate all power generators and weapon systems.':'你是潜入外星网络的智能程序，任务是关闭发电机与武器系统。','The alien antivirus will detect and delete you after 13 seconds.':'外星防御程序会在十三秒后发现并清除你。','But remember: a file is never really deleted.':'但记住：文件从来没有真正被删除。','Use the execution backtrace from your previous attempts to break in and destroy the main memory core.':'利用之前尝试留下的行动回溯，突破防线并摧毁记忆核心。','Controls:':'操作：','WASD / Arrows - movement':'WASD / 方向键：移动','Backspace     - kill -9 xx142-b2.exe':'Backspace：提前结束当前循环',
    'CLASSIC':'经典','PENTA':'五格','MIX':'混合','KIDS':'儿童','EZPZ':'轻松','PACKA':'星际','BUNCHAS':'救援','Game Mode:':'游戏模式：','Blockychums left: ':'待救援生物：','PACKABUNCHAS!':'星际打包救援！','PACKABUNCHAS!!!':'星际打包救援！','PACKABUNCHAS?':'星际打包救援？','Pick a game mode!':'选择游戏模式！','Put them into the ship!':'把它们放进飞船！','Drag and drop them in!':'拖动拼块放入舱内！','Double click to rotate!':'双击拼块旋转！','Click to start!':'点击开始！','This is a fun one!':'这一关真有趣！','That\'s a lovely planet.':'真是可爱的星球。','Look at the stars!':'看看满天星星！','The universe is SO big!':'宇宙真大啊！','I love yellow!':'我喜欢黄色！','Stay hydrated, bro!':'记得喝水哦！','Posture check!':'坐直一些哦！','Are you hungry, too?':'你也饿了吗？','Nice move!':'这步不错！','I love my job.':'我喜欢这份工作。','What a beautiful day!':'多美好的一天！','Hi!':'你好！','Way to go, Spacey!':'加油，小宇航员！','We are in no hurry!':'我们不赶时间！','Take your time, bro!':'慢慢想就好！','More precisely 13.312':'准确来说，是一万三千三百一十二。','but that isn\'t a problem':'不过这难不倒','for the PACKABUNCHAS!':'星际救援队！','We are not in a hurry':'我们不赶时间。','after all, and you know':'毕竟你知道，','what they say:':'大家都说：','puzzles keep our brain young':'拼图让大脑年轻，','and agile!':'也让思维灵活！','Oh, the dev left a note, too:':'作者也留下了纸条：','Did you really finish':'你真的完成了','and many':'还有很多…','      - click to reset the game! - ':'点击这里重置游戏','And you know them,':'你也知道它们，','they love so much staying':'它们特别喜欢','close together that the':'紧紧挨在一起，','only way to rescue them':'要救出它们，','is to have them packed':'就得把它们','perfectly in tiny little':'整齐装进小小的','shuttles.':'救援舱。','Easier said than done!':'说起来容易，做起来难！','OKAY, let\'s roll up':'好，打起精神，','our sleeves and get':'挽起袖子，','those Blockychums back!':'把伙伴们救回来！','Remember:':'记住：','any game mode is fine,':'哪种模式都可以，','as long as you feel comfortable.':'只要你玩得开心。','Look, ehm ...':'那个，嗯…','I don\'t know how to':'我不知道该怎么','tell you this ...':'告诉你…','Remember when I said':'记得我说过','there were \'13 Blockychums\'':'只有十三个伙伴','to be rescued?':'要救援吗？','My ... bad, they are actually':'我弄错了，其实是','13 ... THOUSAND.':'一万三千个…','We did it, Spacey!!!':'我们做到了！！！','WE ACTUALLY RESCUED ALL':'所有伙伴都救出了！','the 13.312 Blockychums!':'一万三千三百一十二个！','Let\'s celebrate!':'庆祝一下！','Hey Spacey, wake up!':'醒醒，小宇航员！','Guess what happened today.':'猜猜今天发生了什么。','Yeah.':'没错。','Those 13 Blockychums':'那些伙伴们','got lost in the galaxy':'在银河里迷路了，','AGAIN!':'又一次！',
    'BOUNCE':'回旋镖','BACK':'勇者','A JS13k 2019 Game':'随机地牢冒险','Speed Run':'竞速挑战','SUPER CASTLE GAME':'积木城堡','ARROWS TO MOVE OR TAP ON SCREEN':'方向键移动，或点击画面','CLICK HERE FOR MORE LEVELS':'点击选择更多关卡',
    'Resurrect':'复活','Rituals':'仪式','Renew':'强化生命','Recharge':'强化施法','Begin the next level':'进入下一关','Streak':'连击','Bouncing':'弹射','Spells bounce':'法术可以弹射','Doubleshot':'双重施法','Cast 2 spells':'一次发射两道法术','Hunter':'追踪','Spells seek targets':'法术追踪敌人','Weightless':'失重','Spells are not affected by gravity':'法术不受重力影响','Knockback':'击退','Spells knock backwards':'法术击退敌人','Ceiling':'屋顶','Adds a ceiling':'增加顶部边界','Rain':'法术雨','Spells split when they drop':'落下时分裂法术','Drunkard':'狂乱','2x damage, wobbly aim':'伤害加倍，瞄准不稳定','Seer':'洞察','Spells pass through the dead':'法术穿过亡灵','Tearstone':'泪石','Impatience':'迅速复活','Resurrection recharges 2x faster':'复活恢复速度加倍','Bleed':'流血','Inflicts bleed on hits':'命中造成流血','Allegiance':'忠诚','Summon your honour guard after resurrections':'复活后召唤卫队','Salvage':'回收','Corpses become souls at the end of levels':'关卡结束时尸体化为灵魂','Studious':'勤学','Rituals are 50% cheaper':'仪式费用减半','Electrodynamics':'闪电','Lightning strikes after hits':'命中后触发闪电','Chilly':'冰冻','10% chance to freeze enemies':'有一成概率冻结敌人','Giants':'巨人','20% chance to resurrect giant skeletons':'有两成概率复活巨型骷髅','Avarice':'贪婪','+1 soul for each corpse you resurrect':'每次复活额外获得一个灵魂','Hardened':'坚韧','Undead have +1 HP*':'亡灵额外获得一点生命','Norman wasn\'t a particularly popular necromancer...':'诺曼不是一位受欢迎的亡灵法师…','         The other villagers hunted him.':'村民们追捕他。','     Sometimes they even finished the job (@)':'有时，他们真的杀死了他。','  But like any self-respecting necromancer...':'但和其他亡灵法师一样…','        Norman just brought himself back.':'诺曼总会让自己复活。','It was over.':'一切结束了。','Norman was able to study peacefully.':'诺曼终于可以安心研究了。','But he knew that eventually, they\'d be back.':'但他知道，他们总有一天会回来。','THE END':'故事结束','                (Click to begin)':'点击开始冒险',
    'The Neatness':'线索迷境','Connect the dots':'连接所有圆点','They move when you move':'你移动时，它们也会移动','Not like this':'这条路线不对','Requires Coil Membership':'需要特殊关卡权限','But our princess is in another castle!':'但冒险还没有结束！','only in death does duty end':'唯有终点，使命方休',
    'BACK':'荒野','COUNTRY':'赏金','Earn as much money as you can in today\'s challenge.':'在今天的挑战中，赚取尽可能多的赏金。','Change Outfit':'更换服装',
    'HEALTH PACK':'生命补给','SLOW ENEMIES':'减速敌人','FAST SHOT':'快速射击','TRIPLE SHOT':'三重射击','PIERCE SHOT':'穿透射击','RADIUS RAID':'霓虹突袭','MOVE':'移动','AIM/FIRE':'瞄准 / 射击','AUTOFIRE':'自动射击','PAUSE':'暂停','MUTE':'静音','WASD/ARROWS':'WASD / 方向键','MOUSE':'鼠标','BEST SCORE':'最高得分','BEST LEVEL':'最高关卡','ROUNDS PLAYED':'游玩次数','ENEMIES KILLED':'击败敌人数','BULLETS FIRED':'发射子弹数','POWERUPS COLLECTED':'获得强化数','TIME ELAPSED':'累计时间','LEVEL':'关卡','KILLS':'击败','BULLETS':'子弹','POWERUPS':'强化','TIME':'时间','Are you sure you want to clear all locally stored game data? This cannot be undone.':'确定清空当前浏览器的所有游戏存档吗？这一步无法撤销。','Are you sure you want to end this game and return to the menu?':'确定结束本局并返回菜单吗？',
    'Earth':'土','Water':'水','Air':'风','Fire':'火','Low':'低','Medium':'中','High':'高','Maxed':'已满级','Reclaim 75%':'回收七成五资源','Next':'下一波','Wave':'波次','▸Play':'开始防守','Damage':'伤害','Range':'范围','Rate':'速度','Upgrade':'升级',
    'Bee Keeper Bunny':'养蜂兔子','Bee Whizz':'蜜蜂飞舞','Bee Amazed':'奇妙蜂群','Bee Afraid, Bee Very Afraid':'当心危险','Plan Bee':'蜜蜂计划','Zombee Apocalypse':'僵尸蜜蜂危机','Bee Kind':'守护蜜蜂','Remove all threats':'消灭所有威胁','Increase colony to ':'壮大蜂群至',' bees':'只蜜蜂','Welcome to JS13K entry\nby picosonic':'欢迎来到\n守护蜜蜂','Shoot enemies\nwith the honey gun':'使用蜂蜜枪\n射击敌人','Grubs turn into Zombees\nwhen they eat toadstools':'幼虫吃到蘑菇后\n会变成僵尸蜜蜂','Zombees chase bees\nsteal pollen and honey\nand break hives':'僵尸蜜蜂追逐蜂群\n偷走花粉和蜂蜜\n并破坏蜂巢','Bees collect pollen from flowers\nto make pollen in their hives':'蜜蜂从花朵收集花粉\n在蜂巢里酿造蜂蜜','Clear away toadstools to prevent\ngrubs turning into ZomBees and\nmake space for flowers to grow':'清除蘑菇以阻止幼虫变异\n也为花朵腾出空间','Watch out for gravity toggles':'留意重力切换开关','Solve the maze\nto find your prize':'穿过迷宫\n寻找奖励','Use gravity toggle\nto get honey gun':'切换重力\n获得蜂蜜枪','Race to the top\nwith care':'小心向上前进','Hop to it before the\ngrubs change to Zombees':'在幼虫变异前\n赶快行动','Take a leap of faith':'勇敢跳过去','The Queen Bee thanks you for helping':'蜂后感谢你的帮助','to save the bees and planet':'你拯救了蜜蜂与家园',' BEE KIND ':'守护蜜蜂','GRUB - eats toadstools, becomes ZOMBEE':'幼虫：吃到蘑菇会变异','ZOMBEE - steals pollen, breaks hives':'僵尸蜜蜂：偷花粉、破坏蜂巢','/CURSORS + ENTER/SPACE/SHIFT':'方向键 + 回车 / 空格 / Shift','or use GAMEPAD':'也可以使用手柄',
    'World':'小镇','Beekeeper\'s house':'养蜂人的家','Wizard\'s shop':'巫师商店','Blacksmith\'s house':'铁匠之家','Wizard\'s attic':'巫师阁楼','Cloisters':'回廊','Spire':'尖塔','Hero\'s house':'勇士之家','Door is locked\nfind a key':'门锁住了\n先寻找钥匙','You don\'t have\nenough money\nto buy this potion':'钱不够\n无法购买药水','Congratulations you have saved the village\nRefresh page to play again':'恭喜，你救下了小镇！\n刷新页面可以重新挑战','Find/buy potions to cure villagers\n\nFind all the treasure and defeat\nall the enemies':'寻找或购买药水治疗村民\n\n收集全部宝物\n击败所有敌人','Church':'教堂','Castle':'城堡','Welcome to the shop\n\n2 - Coloured potion\n5 - White potion':'欢迎光临商店\n\n彩色药水：2 金币\n白色药水：5 金币',
    'Hextris':'六边形消除','HIGH SCORE':'最高得分','GAME OVER':'游戏结束','HIGH SCORES':'最高分榜','Match 3+ blocks to score':'连接至少三个同色块得分','Match 3+ blocks to score!':'连接至少三个同色块得分！','Use the right and left arrow keys':'使用左右方向键','to rotate the hexagon':'旋转六边形','Tap the screen\'s left and right':'点击屏幕左右两侧','sides to rotate the hexagon':'来旋转六边形','Press the right and left arrow keys':'按左右方向键','Tap the left and right sides of the screen':'点击屏幕左右两侧',' to rotate the Hexagon.':'旋转六边形。',' Press the down arrow to speed up the block falling':'按下方向键加速方块下落',
    'Open':'打开','Close':'关闭','Key':'钥匙','Room':'房间','Flashlight':'手电筒','Health':'生命','Exit':'出口',
    'HAND':'手牌','DRAW':'牌库','DONE':'完成','INNATE':'天赋','Help/Info':'玩法说明','Confirm Card':'确认出牌','Ok, got it!':'知道了！','View Deck':'查看牌组','End Turn':'结束回合','end turn':'结束回合','Your hand is full!':'手牌已满！','Not enough stamina!':'体力不足！','Pick a card to add to your deck OR an innate ability!':'选择一张新牌加入牌组，或选择一种天赋！','Thank you for playing, hope you enjoyed this tiny game!':'感谢游玩，希望你喜欢这段冒险！','Remove ENRAGE and WEAKEN from SELF':'移除自身的狂怒与虚弱','Saber Attack':'弯刀攻击','Bambai Shield':'圆盾防御','War Cry':'战争怒吼','Rally Cry':'集结号令','Tactical Retreat':'战术撤退','Surgical Strike':'精准打击','Recharge':'恢复体力','Push Through':'强行突破','Clairvoyance':'洞察先机','Shield Wall':'盾墙','Reluctant Withdrawl':'不甘撤退','Whirling Dervish':'旋风战士','Wrath Of Khan':'可汗之怒','Reckless Assault':'孤注一掷','Overpower':'压制','Cavalry Charge':'骑兵冲锋','Shock and Awe':'震慑','Combat Medics':'战地医疗','Field Hospital':'野战医院','Meditation':'冥想','Strategic Planning':'战略规划','Calisthenics':'体能训练','Tenger Spirit':'长生天庇佑','Fearsome Reputation':'赫赫威名','Scientific Advancement':'技艺进步','Defensive Perimeter':'防御阵地','KHAN':'可汗卡牌地牢'
  };
  Object.assign(phrases,{
    'WANTED':'通缉令','Accept Quest':'接受任务','GENERAL STORE':'杂货铺','Become a Coil subscriber!':'自托管版可以直接换装','Congratulations':'恭喜通关','Defeated':'挑战失败','YOU DIE':'你倒下了','WELL DONE':'挑战成功','Try Again':'重新挑战','Collect Bounty':'领取赏金','Clear away toadstools to prevent':'清除蘑菇可以阻止','grubs turning into ZomBees and':'幼虫变成僵尸蜜蜂，','make space for flowers to grow':'也为花朵腾出空间',
    'Sound Available!':'可以开启声音了！','ears flooded with new sensations.':'声音让这个世界鲜活起来。','perhaps silence is safer?':'也许安静更令人安心？','enable audio':'开启声音','disable audio':'保持静音',
    'PENANCE':'悔悟','INDULGENCE':'赦免','DYNASTY':'王朝','SAINTHOOD':'圣者','SACRAMENT':'仪式','MIRACLE':'奇迹','CAVALRY':'骑兵','FAITH':'信念','PILLAGE':'战利品','LOOT':'宝藏','MANNA':'馈赠','SIN':'重整','WILDCARD':'百搭','HOME':'归途',
    'THE FOURTH CRUSADE':'第四次远征','THE FIFTH CRUSADE':'第五次远征','CRUSADE OF FREDERICK II':'腓特烈远征','THE BARONS\' CRUSADE':'男爵远征','CRUSADE OF LOUIS IX':'路易远征','THE SHEPHERDS\' CRUSADE':'牧羊人远征','THE CRUSADE OF 1267':'一二六七年远征','THE INFANTS OF ARAGON':'阿拉贡远征','THE EIGHTH CRUSADE':'第八次远征','LORD EDWARD\'S CRUSADE':'爱德华远征','THE FALL OF OUTREMER':'海外之地陷落','THE CRUSADES AFTER ACRE':'阿卡之后的远征','THE ARAGONESE CRUSADE':'阿拉贡之征',
    'LAND CONQUERED':'开疆拓土','INFIDELS MASSACRED':'击败敌军','MIGHTY RIGHTEOUS':'英勇无畏','SUCCESS':'远征成功','REPORTING TO POPE':'上报战果','GREAT SUCCESS':'大获全胜','RECONQUISTA':'收复失地','HERETICS LIQUIDATED':'清除敌军','THE CHURCH PREVAILS':'凯旋而归','PAGANS MURDERED':'战斗胜利','SINS FORGIVEN':'洗去罪过','SIGNED BY THE CROSS':'十字之印','CRUX TRANSMARINA':'跨海远征','CRUX CISMARINA':'陆上远征',
    'Hello,':'你好，','Well done':'做得好，','You deactivated the memory core.':'你关闭了记忆核心。','All alien ships are destroyed.':'外星飞船全部被摧毁。','You freed humanity from slavery.':'你让人类重获自由。','How about a nice game of chess?':'接下来，要不要下一盘棋？',
    'But remember: a file is never really deleted. Use the execution backtrace from your previous attempts to break in and destroy the main memory core.':'记住：文件从未真正被删除。利用每次尝试留下的行动回溯，突破防线，摧毁记忆核心。',
    'Heal 1*':'恢复一点生命','+1* max hp':'生命上限加一','+1\u007f max casts':'施法上限加一','(Space)':'（空格）','Send Next':'派出下一波','Send Next +':'下一波奖励 +','Lives':'生命','Fragments':'元素碎片','Dmg':'伤害','Rng':'范围','Rte':'攻速','Cost':'费用','+50% vs Air':'对风系伤害增加五成','+50% vs Fire':'对火系伤害增加五成','+50% vs Water':'对水系伤害增加五成','+50% vs Earth':'对土系伤害增加五成',
    'The Khans favored weapon, designed for use from horseback. These swords with slightly curved blades were 30-40 inches long.':'适合骑马使用的弯刀，是可汗钟爱的武器。',
    'The Khans favored shield, round and domed, originally made of woven reeds covered in leather and later from stronger metal.':'圆形凸面盾牌，能抵挡敌人的攻击。',
    'Enemies could scarcely move to defend themselves on hearing the screams of the Khans\' army.':'战士们的怒吼，让敌人来不及防御。',
    'Such were The Khans regrouping tactics that enemies could find nowhere to strike.':'重新集结，让敌人无从下手。',
    'Better to retreat, and entice the enemy into a trap or your making.':'暂时退却，把敌人引进自己的陷阱。',
    'Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt.':'谋划如黑夜般难以看透，出击如雷霆般迅猛。',
    'The Khan\'s army could rest on the move, allowing them to be where noone thought they could be.':'行军间隙也能休整，让军队出现在意想不到的地方。',
    'Any obstacle may be overcome with enough force.':'集中力量，突破眼前的障碍。',
    'The Khan had a preternatural ability with strategy, to know what to do next.':'洞察战局，提前决定下一步。',
    'The Khan grew more determined, and more angry, with every forced step backwards.':'每一次被迫后退，都让可汗更愤怒、更坚定。',
    'The Persians were a magnificent addition to the Khan\'s army.':'勇猛的波斯战士加入了可汗的军队。',
    'The Khan was merciless, sometimes reckless, in pursuit of his enemies.':'追击敌人时，可汗毫不留情，有时也不顾风险。',
    'Attack where the enemy is unprepared, appear where you are not expected.':'攻其不备，出其不意。',
    'The Khan\'s cavalry were second to none thanks, in no small part, to the invention of the stirrup.':'马镫让骑兵更稳、更强，可汗的骑兵因此所向披靡。',
    'Supreme excellence consists of breaking the enemy\'s resistance without fighting.':'最好的胜利，是不战而屈人之兵。',
    'A little ginsing, some water, a BIG shield and you\'ll be back up in no time.':'药材、清水和可靠的盾牌，让战士迅速恢复。',
    'He will win who knows when to fight and when not to fight.':'懂得何时进攻、何时休整的人，才能取胜。',
    'It is the unemotional, reserved, calm, detached warrior who wins, not the hothead seeking vengeance.':'保持冷静的战士才能取胜，盲目复仇只会冲昏头脑。',
    'Water flows according to the ground as the soldier plots victory in relation to his foe.':'水因地势而流，兵因敌情而动。',
    'The Khan was considered the embodiment of this highest deity.':'可汗被视为长生天的化身。',
    'To fight harder, be stronger, and live longer one must do more than just cross swords.':'技艺与研究，让战士更强，也活得更久。'
  });
  const dynamic = [
    [/^REWARD \$(.+)$/i,(_,n)=>`悬赏 $${n}`],
    [/^You earned \$(.+)\.$/i,(_,n)=>`本次获得赏金 $${n}`],
    [/^Stage (.+)$/i,(_,n)=>`关卡 ${n}`],[/^Turn (\d+)$/i,(_,n)=>`第 ${n} 回合`],
    [/^LIFE:\s*(\d+\s*\/\s*\d+)$/i,(_,n)=>`生命：${n}`],[/^Loading\.\.\.\s*(.*)$/i,(_,n)=>`正在加载 ${n}`],
    [/^»Send Next \+(\d+) ∴$/,(_,n)=>`下一波：奖励 +${n} ∴`],
    [/^Stage:\s*(.+)$/i,(_,n)=>`关卡：${n}`],[/^Round:\s*(.+)$/i,(_,n)=>`回合：${n}`],[/^Draw:\s*(.+)$/i,(_,n)=>`牌库：${n}`],[/^Discard:\s*(.+)$/i,(_,n)=>`弃牌：${n}`],
    [/^DEFEND\/D - block (.+) attack damage, lasts 1 turn\.?$/i,(_,n)=>`防御：抵挡 ${n} 伤害，持续一回合`],
    [/^ENRAGE\/E - boost attack damage 25% for (.+) turns\.?$/i,(_,n)=>`狂怒：伤害增加 25%，持续 ${n} 回合`],
    [/^WEAKEN\/W - reduce attack damage 25% and defense gain 50% for (.+) turns\.?$/i,(_,n)=>`虚弱：伤害降低 25%，防御增量降低 50%，持续 ${n} 回合`],
    [/^(Low|Medium|High) (\+50% vs (Air|Fire|Water|Earth))$/,(_,a,b)=>`${translate(a)} ${translate(b)}`],
    [/^(\d+) more bees needed$/,(_,n)=>`还需要 ${n} 只蜜蜂`],[/^Increase colony to (\d+) bees$/,(_,n)=>`蜂群目标：${n} 只蜜蜂`],
    [/^Level\s+(\d+)$/i, (_,n)=>`第 ${n} 关`], [/^LIFE:\s*(\d+)$/i,(_,n)=>`生命：${n}`], [/^Warp\s+(\d+)$/i,(_,n)=>`第 ${n} 层`],
    [/^Upgrade to Level\s+(\d+)$/i,(_,n)=>`升级至 ${n} 级`], [/^Upgrade to Level\s*$/,()=> '升级至'], [/^ Level\s*$/,()=> '等级'],
    [/^ATTACK ENEMY:\s*(.+)$/i,(_,n)=>`攻击敌人：${n}`],[/^ATTACK ALL:\s*(.+)$/i,(_,n)=>`攻击全体：${n}`],[/^WEAKEN ALL:\s*(.+)$/i,(_,n)=>`削弱全体：${n}`],[/^DEFEND SELF:\s*(.+)$/i,(_,n)=>`增加防御：${n}`],[/^ENRAGE SELF:\s*(.+)$/i,(_,n)=>`自身狂怒：${n}`],[/^WEAKEN ENEMY:\s*(.+)$/i,(_,n)=>`削弱敌人：${n}`],[/^STAMINA:\s*(.+)$/i,(_,n)=>`体力：${n}`],[/^DRAW CARDS:\s*(.+)$/i,(_,n)=>`抽取卡牌：${n}`],
    [/^Start with \+(.+) defend\/TURN$/i,(_,n)=>`每回合增加 ${n} 防御`],[/^Enemies start \+(.+) weak\/ROUND$/i,(_,n)=>`每场战斗敌人虚弱 ${n} 回合`],[/^Gain \+(.+) stamina per TURN$/i,(_,n)=>`每回合恢复 ${n} 体力`],[/^Draw (.+) extra cards? per TURN$/i,(_,n)=>`每回合额外抽 ${n} 张牌`],[/^Gain \+(.+) max life this ONCE$/i,(_,n)=>`生命上限增加 ${n}`],[/^Lose (.+) life$/i,(_,n)=>`失去 ${n} 生命`],[/^Heal (.+) life at the start of each ROUND$/i,(_,n)=>`每场战斗开始恢复 ${n} 生命`],[/^Heal (.+) life$/i,(_,n)=>`恢复 ${n} 生命`],
    [/^Challenging - Enemy Damage & Defense Gain \+50%$/,()=> '挑战：敌人伤害与防御增量增加五成'],[/^Really Hard - Enemy Life, Damage & Defense Gain \+50%$/,()=> '困难：敌人生命、伤害与防御增量增加五成'],[/^Maybe Impossible - Enemy Life, Attack, Defense Gain \+100%$/,()=> '极难：敌人生命、攻击与防御增量加倍'],[/^Probably Impossible - Enemy Life, Attack, Defense Gain \+150%$/,()=> '噩梦：敌人生命、攻击与防御增量增加一点五倍']
  ];
  const dictionary=new Map();
  for(const [en,zh] of Object.entries(phrases)){
    dictionary.set(en.trim(),zh);dictionary.set(en.trim().toLowerCase(),zh);
    const englishLines=en.split('\n'),chineseLines=zh.split('\n');
    if(englishLines.length===chineseLines.length&&englishLines.length>1){
      englishLines.forEach((line,i)=>{if(line.trim()){dictionary.set(line.trim(),chineseLines[i]);dictionary.set(line.trim().toLowerCase(),chineseLines[i]);}});
    }
  }
  const gameId=location.pathname.split('/')[2];
  const overrides={
    'bounce-back':{BACK:'勇者'},
    'norman-necromancer':{Recharge:'强化施法'},
  };
  for(const [en,zh] of Object.entries(overrides[gameId]??{})){dictionary.set(en,zh);dictionary.set(en.toLowerCase(),zh);}
  function translate(value) {
    const text=String(value), trimmed=text.trim();
    const exact=dictionary.get(trimmed)??dictionary.get(trimmed.toLowerCase());
    if(exact!==undefined)return exact;
    for(const [re,replace] of dynamic)if(re.test(text))return text.replace(re,replace);
    if(text.includes('\n'))return text.split('\n').map(translate).join('\n');
    return text;
  }
  // Pixel-font games render at a tiny internal resolution. Keep translated
  // labels on a transparent high-DPI canvas, aligned to their original canvas.
  // This preserves readable CJK strokes without changing gameplay coordinates.
  const layers=new Map();
  function paintBitmap(ctx,text,x,y,options={}) {
    if(!ctx.canvas.isConnected)return;
    let layer=layers.get(ctx.canvas);
    if(!layer){
      const canvas=document.createElement('canvas');
      canvas.setAttribute('aria-hidden','true');
      canvas.style.cssText='position:fixed;pointer-events:none;z-index:20;image-rendering:auto';
      document.body.appendChild(canvas);
      layer={canvas,jobs:[]};layers.set(ctx.canvas,layer);
    }
    const job={text:translate(text),x,y,matrix:ctx.getTransform(),alpha:ctx.globalAlpha,...options};
    const index=layer.jobs.findIndex(old=>old.x===x&&old.y===y&&old.matrix.e===job.matrix.e&&old.matrix.f===job.matrix.f);
    if(index>=0)layer.jobs[index]=job;else layer.jobs.push(job);
  }
  function flushBitmap(){
    for(const [source,layer] of layers){
      const r=source.getBoundingClientRect(),dpr=devicePixelRatio||1,c=layer.canvas;
      c.style.left=r.left+'px';c.style.top=r.top+'px';c.style.width=r.width+'px';c.style.height=r.height+'px';
      const w=Math.ceil(r.width*dpr),h=Math.ceil(r.height*dpr);
      if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
      const ctx=c.getContext('2d');ctx.clearRect(0,0,w,h);
      for(const job of layer.jobs){
        ctx.save();ctx.scale(dpr*r.width/source.width,dpr*r.height/source.height);
        const m=job.matrix;ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);
        ctx.font=(job.size??8)+'px "Microsoft YaHei",sans-serif';
        ctx.fillStyle=job.color??'#e5efd3';ctx.globalAlpha=job.alpha;
        ctx.textAlign=job.align??'left';ctx.textBaseline=job.baseline??'top';
        ctx.fillText(job.text,job.x,job.y,job.maxWidth??source.width);
        ctx.restore();
      }
    }
    if(layers.size)requestAnimationFrame(flushBitmap);
  }
  let bitmapStarted=false;
  window.YuqingChinese={translate,paintBitmap(...args){paintBitmap(...args);if(!bitmapStarted){bitmapStarted=true;requestAnimationFrame(flushBitmap);}}};
  const proto=CanvasRenderingContext2D.prototype;
  const originalClear=proto.clearRect;
  proto.clearRect=function(x,y,w,h){
    if(x<=0&&y<=0&&w>=this.canvas.width&&h>=this.canvas.height){const layer=layers.get(this.canvas);if(layer)layer.jobs.length=0;}
    return originalClear.call(this,x,y,w,h);
  };
  const originalFill=proto.fillRect;
  proto.fillRect=function(x,y,w,h){
    if(x<=0&&y<=0&&w>=this.canvas.width&&h>=this.canvas.height){const layer=layers.get(this.canvas);if(layer)layer.jobs.length=0;}
    return originalFill.call(this,x,y,w,h);
  };
  for(const method of ['fillText','strokeText']){
    const original=proto[method];
    proto[method]=function(text,x,y,maxWidth){
      const chinese=translate(text);
      if(chinese===String(text))return maxWidth===undefined?original.call(this,text,x,y):original.call(this,text,x,y,maxWidth);
      this.save();
      // Existing canvas fonts often include Latin-only bitmap-like faces.
      this.font=this.font.replace(/(\d+(?:\.\d+)?px).*/, '$1 "Microsoft YaHei", sans-serif');
      const width=maxWidth??Math.max(60,proto.measureText.call(this,String(text)).width*1.35);
      original.call(this,chinese,x,y,width);
      this.restore();
    };
  }
  const originalAlert=window.alert,originalConfirm=window.confirm;
  window.alert=text=>originalAlert(translate(text));
  window.confirm=text=>originalConfirm(translate(text));
  let pending=false;
  function localize(){
    pending=false;
    if(!document.body)return;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(node.parentElement?.closest('script,style,textarea'))continue;
      const translated=translate(node.nodeValue);
      if(translated!==node.nodeValue)node.nodeValue=translated;
    }
    for(const element of document.querySelectorAll('[title],[aria-label],input[type=button],input[type=submit]')){
      for(const attr of ['title','aria-label','value']){if(!element.hasAttribute(attr))continue;const text=element.getAttribute(attr),zh=translate(text);if(zh!==text)element.setAttribute(attr,zh);}
    }
  }
  const observer=new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(localize);}});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',localize,{once:true});else localize();
})();
