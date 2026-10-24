import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Board from './components/Board.jsx'
import CustomDialog from './components/CustomDialog.jsx'
import { Icon } from './components/Icons.jsx'
import { cloneBoard, createBoard, DIFFICULTIES, isWon, neighbors, openArea, placeMines } from './game/engine.js'
import { getInitialLanguage, messages } from './i18n.js'

function formatTime(seconds) {
  const safe = Math.min(seconds, 5999)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function loadBest(key) {
  try {
    const stored = localStorage.getItem(`minesweeper-best-${key}`)
    if (stored === null || stored.trim() === '') return null
    const value = Number(stored)
    return Number.isFinite(value) && value >= 0 ? value : null
  } catch { return null }
}

export default function App() {
  const [language, setLanguage] = useState(getInitialLanguage)
  const t = messages[language]
  const [difficulty, setDifficulty] = useState('beginner')
  const [config, setConfig] = useState(DIFFICULTIES.beginner)
  const [board, setBoard] = useState(() => createBoard(config.rows, config.cols))
  const [status, setStatus] = useState('ready')
  const [seconds, setSeconds] = useState(0)
  const [firstMove, setFirstMove] = useState(true)
  const [customOpen, setCustomOpen] = useState(false)
  const [custom, setCustom] = useState({ rows: 16, cols: 20, mines: 50 })
  const [helpOpen, setHelpOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installMessageKey, setInstallMessageKey] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('minesweeper-theme') || 'dark')
  const previousStatus = useRef('ready')

  const best = useMemo(() => loadBest(difficulty), [difficulty, status])
  const flags = board.flat().filter((cell) => cell.isFlagged).length
  const remaining = Math.max(0, config.mines - flags)

  const newGame = useCallback((nextConfig = config, nextDifficulty = difficulty) => {
    setConfig(nextConfig)
    setDifficulty(nextDifficulty)
    setBoard(createBoard(nextConfig.rows, nextConfig.cols))
    setStatus('ready')
    setSeconds(0)
    setFirstMove(true)
  }, [config, difficulty])

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    document.title = t.pageTitle
    localStorage.setItem('minesweeper-language', language)
  }, [language, t.pageTitle])

  useEffect(() => {
    if (status !== 'playing') return undefined
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [status])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('minesweeper-theme', theme)
  }, [theme])

  useEffect(() => {
    function captureInstall(event) { event.preventDefault(); setInstallPrompt(event) }
    function installed() { setInstallPrompt(null); setInstallMessageKey('installed') }
    function updateReady() { setInstallMessageKey('updateReady') }
    window.addEventListener('beforeinstallprompt', captureInstall)
    window.addEventListener('appinstalled', installed)
    window.addEventListener('minesweeper-update-ready', updateReady)
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstall)
      window.removeEventListener('appinstalled', installed)
      window.removeEventListener('minesweeper-update-ready', updateReady)
    }
  }, [])

  useEffect(() => {
    function onKey(event) {
      if (customOpen || helpOpen || event.target.matches('input, textarea, select') || event.target.isContentEditable) return
      if (event.code === 'Space' && event.target.closest('button')) return
      if (event.key.toLowerCase() === 'r') newGame()
      if (event.key.toLowerCase() === 'p' || event.code === 'Space') {
        event.preventDefault()
        setStatus((current) => current === 'playing' ? 'paused' : current === 'paused' ? 'playing' : current)
      }
      if (event.key === '?') setHelpOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newGame, customOpen, helpOpen])

  function finish(nextBoard, nextStatus) {
    if (nextStatus === 'lost') nextBoard.flat().forEach((cell) => { if (cell.isMine) cell.isOpen = true })
    if (nextStatus === 'won') {
      nextBoard.flat().forEach((cell) => { if (cell.isMine) cell.isFlagged = true })
      const oldBest = loadBest(difficulty)
      if (oldBest === null || seconds < oldBest) {
        try { localStorage.setItem(`minesweeper-best-${difficulty}`, String(seconds)) }
        catch { setInstallMessageKey('bestSaveFailed') }
      }
    }
    setBoard(nextBoard)
    setStatus(nextStatus)
  }

  function handleOpen(row, col) {
    if (status === 'paused' || status === 'lost' || status === 'won') return
    let next = cloneBoard(board)
    if (next[row][col].isFlagged) return
    if (firstMove) {
      next = placeMines(next, config.mines, row, col)
      setFirstMove(false)
      setStatus('playing')
    }
    if (next[row][col].isMine) return finish(next, 'lost')
    openArea(next, row, col)
    finish(next, isWon(next) ? 'won' : 'playing')
  }

  function handleFlag(row, col) {
    if (status === 'paused' || status === 'lost' || status === 'won' || board[row][col].isOpen) return
    const next = cloneBoard(board)
    next[row][col].isFlagged = !next[row][col].isFlagged
    setBoard(next)
  }

  function handleChord(row, col) {
    if (status !== 'playing' || !board[row][col].isOpen || board[row][col].adjacent === 0) return
    const next = cloneBoard(board)
    const around = neighbors(next, row, col)
    if (around.filter((cell) => cell.isFlagged).length !== next[row][col].adjacent) return
    for (const cell of around.filter((item) => !item.isFlagged && !item.isOpen)) {
      if (cell.isMine) return finish(next, 'lost')
      openArea(next, cell.row, cell.col)
    }
    finish(next, isWon(next) ? 'won' : 'playing')
  }

  function selectDifficulty(key) {
    if (key === 'custom') return setCustomOpen(true)
    newGame(DIFFICULTIES[key], key)
  }

  function togglePause() {
    setStatus((current) => {
      if (current === 'playing') { previousStatus.current = current; return 'paused' }
      return current === 'paused' ? previousStatus.current : current
    })
  }

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') setInstallPrompt(null)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="." aria-label={t.home}><span className="brand-mark"><Icon name="flag" size={23}/></span><strong>{t.appName}</strong><small>MINESWEEPER</small></a>
        <nav className="difficulty-tabs" aria-label={t.difficulty}>
          {[...Object.keys(DIFFICULTIES), 'custom'].map((key) => <button key={key} className={difficulty === key ? 'active' : ''} onClick={() => selectDifficulty(key)}>{t[key]}</button>)}
        </nav>
        <div className="header-actions">
          <button className="language-button" onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} aria-label={t.switchLanguage} title={t.switchLanguage}>{t.languageCode}</button>
          {installPrompt ? <button className="install-button" onClick={installApp}><Icon name="install"/><span>{t.installApp}</span></button> : null}
          <button className="new-button" onClick={() => newGame()}><Icon name="refresh"/><span>{t.newGame}</span></button>
          <button className="icon-button" onClick={togglePause} disabled={!['playing', 'paused'].includes(status)} aria-label={status === 'paused' ? t.resumeGame : t.pauseGame}><Icon name={status === 'paused' ? 'play' : 'pause'}/></button>
          <button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t.switchTheme}><Icon name={theme === 'dark' ? 'sun' : 'moon'}/></button>
        </div>
      </header>

      <section className="game-area">
        <div className="hud" aria-label={t.gameStatus}>
          <div><Icon name="flag"/><span><small>{t.minesLeft}</small><strong>{String(remaining).padStart(3, '0')}</strong></span></div>
          <div><Icon name="clock"/><span><small>{t.time}</small><strong>{formatTime(seconds)}</strong></span></div>
          <div><Icon name="trophy"/><span><small>{t.best}</small><strong>{best === null ? '--:--' : formatTime(best)}</strong></span></div>
          <div className={`status status-${status}`}><span className="status-dot"/><span><small>{t.status}</small><strong>{t[status]}</strong></span></div>
        </div>

        <Board board={board} status={status} onOpen={handleOpen} onFlag={handleFlag} onChord={handleChord} t={t}/>

        <footer className="game-footer"><span>{t.leftClick}</span><span>{t.rightClick}</span><span>{t.doubleClick}</span><span><kbd>P</kbd> {t.pause}</span><span><kbd>R</kbd> {t.newGame}</span><button onClick={() => setHelpOpen(true)}><Icon name="help" size={18}/>{t.help}</button></footer>
      </section>

      {(status === 'won' || status === 'lost') ? <div className={`result-toast ${status}`} role="status"><div className="result-icon">{status === 'won' ? '✓' : '!'}</div><div><strong>{status === 'won' ? t.boardCleared : t.hitMine}</strong><span>{status === 'won' ? t.gameTime(formatTime(seconds)) : t.tryAgain}</span></div><button onClick={() => newGame()}>{t.playAgain}</button></div> : null}
      {installMessageKey ? <div className="app-notice" role="status"><span>{t[installMessageKey]}</span><button onClick={() => setInstallMessageKey('')} aria-label={t.closeNotice}><Icon name="close" size={17}/></button></div> : null}

      {customOpen ? <CustomDialog values={custom} onChange={setCustom} onClose={() => setCustomOpen(false)} onStart={() => { setCustomOpen(false); newGame(custom, 'custom') }} t={t}/>: null}
      {helpOpen ? <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setHelpOpen(false)}><section className="dialog help-dialog" role="dialog" aria-modal="true"><div className="dialog-title"><div><span>{t.quickStart}</span><h2>{t.help}</h2></div><button className="icon-button" onClick={() => setHelpOpen(false)} aria-label={t.close}><Icon name="close"/></button></div><ol><li><b>{t.revealCells}</b><span>{t.revealDescription}</span></li><li><b>{t.markMines}</b><span>{t.markDescription}</span></li><li><b>{t.clearBoard}</b><span>{t.clearDescription}</span></li></ol><button className="primary-button" onClick={() => setHelpOpen(false)}>{t.gotIt}</button></section></div> : null}
    </main>
  )
}
