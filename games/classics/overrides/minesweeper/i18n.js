export const LANGUAGES = ['en', 'zh']

export const messages = {
  en: {
    appName: 'Minesweeper', home: 'Minesweeper home', difficulty: 'Difficulty selection',
    beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert', custom: 'Custom',
    installApp: 'Install app', newGame: 'New game', pauseGame: 'Pause game', resumeGame: 'Resume game',
    switchTheme: 'Switch theme', switchLanguage: '切换到中文', gameStatus: 'Game status',
    minesLeft: 'Mines left', time: 'Time', best: 'Best', status: 'Status',
    ready: 'Ready', playing: 'Playing', paused: 'Paused', won: 'Victory', lost: 'Game over',
    leftClick: 'Left click to reveal', rightClick: 'Right click to flag', doubleClick: 'Double-click a number to chord',
    pause: 'Pause', help: 'How to play', boardRegion: 'Minesweeper board',
    cellLabel: ({ row, col, flagged }) => `Row ${row}, column ${col}${flagged ? ', flagged' : ''}`,
    gamePaused: 'Game paused', resumeHint: 'Use the button above to return to the board',
    boardCleared: 'Excellent! Board cleared', hitMine: 'You hit a mine',
    gameTime: (time) => `Finished in ${time}`, tryAgain: 'Adjust your strategy and try again.', playAgain: 'Play again',
    closeNotice: 'Dismiss notification', installed: 'Installed. Open it from your desktop or Start menu.',
    updateReady: 'A new version is ready and will be applied next time you open the game.',
    bestSaveFailed: 'Best time could not be saved. Check browser storage settings; this game is complete.',
    createBoard: 'Create board', customDifficulty: 'Custom difficulty',
    customDescription: 'Choose the board size and mine count. Your first cell is always safe.',
    rows: 'Rows', cols: 'Columns', mines: 'Mines', decrease: 'Decrease', increase: 'Increase', startGame: 'Start game', close: 'Close',
    quickStart: 'Three quick steps', revealCells: 'Reveal cells',
    revealDescription: 'A number shows how many mines touch that cell. Your first click and its neighbors are safe.',
    markMines: 'Mark mines', markDescription: 'Right-click an unrevealed cell to place or remove a flag.',
    clearBoard: 'Clear the board', clearDescription: 'Reveal every safe cell to win. Double-click a number to chord nearby cells.',
    gotIt: 'Got it', customLabel: 'Custom', languageCode: '中', pageTitle: 'Minesweeper',
  },
  zh: {
    appName: '扫雷', home: '扫雷首页', difficulty: '难度选择',
    beginner: '初级', intermediate: '中级', expert: '高级', custom: '自定义',
    installApp: '安装应用', newGame: '新游戏', pauseGame: '暂停游戏', resumeGame: '继续游戏',
    switchTheme: '切换主题', switchLanguage: 'Switch to English', gameStatus: '游戏状态',
    minesLeft: '剩余雷数', time: '用时', best: '最佳', status: '状态',
    ready: '等待开始', playing: '进行中', paused: '已暂停', won: '挑战成功', lost: '游戏结束',
    leftClick: '左键翻开', rightClick: '右键标记', doubleClick: '双击数字快速展开',
    pause: '暂停', help: '玩法说明', boardRegion: '扫雷棋盘区域',
    cellLabel: ({ row, col, flagged }) => `第 ${row} 行第 ${col} 列${flagged ? '，已插旗' : ''}`,
    gamePaused: '游戏已暂停', resumeHint: '点击上方继续按钮返回棋盘',
    boardCleared: '漂亮！棋盘已清空', hitMine: '踩到地雷了',
    gameTime: (time) => `本局用时 ${time}`, tryAgain: '调整策略，再试一次。', playAgain: '再来一局',
    closeNotice: '关闭提示', installed: '安装完成，可从桌面或开始菜单打开。',
    updateReady: '新版本已准备好，下次打开时自动更新。',
    bestSaveFailed: '无法保存最佳成绩，请检查浏览器存储设置；本局已正常完成。',
    createBoard: '创建棋盘', customDifficulty: '自定义难度',
    customDescription: '自由设置棋盘尺寸和雷数，首个格子始终安全。',
    rows: '行数', cols: '列数', mines: '雷数', decrease: '减少', increase: '增加', startGame: '开始游戏', close: '关闭',
    quickStart: '三步上手', revealCells: '翻开格子',
    revealDescription: '数字代表周围八格中的地雷数量；首击及周围格子安全。',
    markMines: '标记地雷', markDescription: '在未翻开的格子上点击鼠标右键，可插旗或取消。',
    clearBoard: '清空棋盘', clearDescription: '翻开全部安全格即获胜。双击数字可快速展开周围格。',
    gotIt: '知道了', customLabel: '自定义', languageCode: 'EN', pageTitle: '扫雷 · Minesweeper',
  },
}

export function getInitialLanguage() {
  const saved = localStorage.getItem('minesweeper-language')
  if (LANGUAGES.includes(saved)) return saved
  return 'zh'
}
