function AppHeader({ currentView, onNavigate, theme, setTheme }) {
  return (
    <header className="top-nav">
      <p className="brand serif">Resume Intelligence</p>
      <nav>
        <button type="button" className={currentView === 'analysis' ? 'active' : ''} onClick={() => onNavigate('analysis')}>Analysis</button>
        <button type="button" className={currentView === 'editor' ? 'active' : ''} onClick={() => onNavigate('editor')}>Editor</button>
        <button type="button" className={currentView === 'history' ? 'active' : ''} onClick={() => onNavigate('history')}>History</button>
      </nav>
      <button type="button" className="theme-toggle" onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}>
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>
    </header>
  )
}

export default AppHeader
