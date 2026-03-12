type AppToolbarProps = {
  darkMode: boolean
  imageCount: number
  enableSelectionShader: boolean
  onAddFiles: (files: FileList | null) => void
  onSaveVersion: () => void
  onAddNote: () => void
  onLoadVersion: (files: FileList | null) => void
  onCenterView: () => void
  onClearBoard: () => void
  onToggleDarkMode: () => void
}

function AppToolbar({
  darkMode,
  imageCount,
  enableSelectionShader,
  onAddFiles,
  onSaveVersion,
  onAddNote,
  onLoadVersion,
  onCenterView,
  onClearBoard,
  onToggleDarkMode,
}: AppToolbarProps) {
  return (
    <header className="toolbar">
      <input
        id="image-picker"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(event) => {
          onAddFiles(event.target.files)
          event.currentTarget.value = ''
        }}
      />
      <input
        id="version-picker"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          onLoadVersion(event.target.files)
          event.currentTarget.value = ''
        }}
      />

      <div className="toolbar-logo" aria-label="App logo">
        PureRef Lite
      </div>

      <nav className="menu-bar" aria-label="Board menu">
        <details className="menu-group">
          <summary className="menu-trigger">File</summary>
          <div className="menu-panel" role="menu" aria-label="File menu">
            <label className="menu-item" htmlFor="image-picker">
              Add Images
            </label>
            <button type="button" className="menu-item" onClick={onAddNote}>
              Add Note
            </button>
            <label className="menu-item" htmlFor="version-picker">
              Load Canvas
            </label>
            <button type="button" className="menu-item" onClick={onSaveVersion}>
              Save Canvas
            </button>
            <button type="button" className="menu-item danger" onClick={onClearBoard}>
              Clear Board
            </button>
          </div>
        </details>

        <details className="menu-group">
          <summary className="menu-trigger">View</summary>
          <div className="menu-panel" role="menu" aria-label="View menu">
            <button type="button" className="menu-item" onClick={onCenterView}>
              Reset View
            </button>
            <button type="button" className="menu-item" onClick={onToggleDarkMode}>
              {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </button>
          </div>
        </details>
      </nav>

      <div className="toolbar-meta">
        <span className="meta">{imageCount} image(s)</span>
        <span className="meta">Selection FX: {enableSelectionShader ? 'Shader' : 'Fallback'}</span>
      </div>
    </header>
  )
}

export default AppToolbar
