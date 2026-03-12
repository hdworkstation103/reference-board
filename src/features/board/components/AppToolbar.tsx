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
      <label className="add-button" htmlFor="image-picker">
        Add Images
      </label>
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
      <button type="button" onClick={onSaveVersion}>
        Save Version
      </button>
      <button type="button" onClick={onAddNote}>
        Add Note
      </button>
      <label className="add-button" htmlFor="version-picker">
        Load Version
      </label>
      <input
        id="version-picker"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          onLoadVersion(event.target.files)
          event.currentTarget.value = ''
        }}
      />
      <button type="button" onClick={onCenterView}>
        Reset View
      </button>
      <button type="button" className="danger" onClick={onClearBoard}>
        Clear Board
      </button>
      <button type="button" onClick={onToggleDarkMode}>
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      <span className="meta">{imageCount} image(s)</span>
      <span className="meta">Selection FX: {enableSelectionShader ? 'Shader' : 'Fallback'}</span>
    </header>
  )
}

export default AppToolbar
