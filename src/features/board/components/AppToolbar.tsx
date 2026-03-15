import { useEffect, useRef, useState } from 'react'
import type { BackgroundShaderOption } from '../shaders'

type AppToolbarProps = {
  backgroundShaderOptions: readonly BackgroundShaderOption[]
  currentBackgroundShaderId: string
  darkMode: boolean
  imageCount: number
  enableSelectionShader: boolean
  shaderCompositingEnabled: boolean
  shaderSandboxOpen: boolean
  onAddFiles: (files: FileList | null) => void
  onSaveVersion: () => void
  onAddNote: () => void
  onLoadVersion: (files: FileList | null) => void
  onCenterView: () => void
  onClearBoard: () => void
  onSelectBackgroundShader: (id: string) => void
  onToggleDarkMode: () => void
  onToggleShaderCompositing: () => void
  onToggleShaderSandbox: () => void
}

function AppToolbar({
  backgroundShaderOptions,
  currentBackgroundShaderId,
  darkMode,
  imageCount,
  enableSelectionShader,
  shaderCompositingEnabled,
  shaderSandboxOpen,
  onAddFiles,
  onSaveVersion,
  onAddNote,
  onLoadVersion,
  onCenterView,
  onClearBoard,
  onSelectBackgroundShader,
  onToggleDarkMode,
  onToggleShaderCompositing,
  onToggleShaderSandbox,
}: AppToolbarProps) {
  const [openMenu, setOpenMenu] = useState<'file' | 'view' | null>(null)
  const [openSubmenu, setOpenSubmenu] = useState<'bg-shaders' | null>(null)
  const navRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!openMenu) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (navRef.current?.contains(event.target as Node)) {
        return
      }
      setOpenMenu(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenu])

  useEffect(() => {
    if (openMenu !== 'view') {
      setOpenSubmenu(null)
    }
  }, [openMenu])

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
        Reference Board
      </div>

      <nav ref={navRef} className="menu-bar" aria-label="Board menu">
        <div className={`menu-group ${openMenu === 'file' ? 'open' : ''}`}>
          <button
            type="button"
            className="menu-trigger"
            aria-expanded={openMenu === 'file'}
            aria-haspopup="menu"
            onClick={() => {
              setOpenMenu((current) => (current === 'file' ? null : 'file'))
            }}
          >
            File
          </button>
          {openMenu === 'file' && (
            <div className="menu-panel" role="menu" aria-label="File menu">
            <label className="menu-item" htmlFor="image-picker" onClick={() => {
              setOpenMenu(null)
            }}>
              Add Images
            </label>
            <button type="button" className="menu-item" onClick={() => {
              setOpenMenu(null)
              onAddNote()
            }}>
              Add Note
            </button>
            <label className="menu-item" htmlFor="version-picker" onClick={() => {
              setOpenMenu(null)
            }}>
              Load Canvas
            </label>
            <button type="button" className="menu-item" onClick={() => {
              setOpenMenu(null)
              onSaveVersion()
            }}>
              Save Canvas
            </button>
            <button type="button" className="menu-item danger" onClick={() => {
              setOpenMenu(null)
              onClearBoard()
            }}>
              Clear Board
            </button>
            </div>
          )}
        </div>

        <div className={`menu-group ${openMenu === 'view' ? 'open' : ''}`}>
          <button
            type="button"
            className="menu-trigger"
            aria-expanded={openMenu === 'view'}
            aria-haspopup="menu"
            onClick={() => {
              setOpenMenu((current) => (current === 'view' ? null : 'view'))
            }}
          >
            View
          </button>
          {openMenu === 'view' && (
            <div className="menu-panel" role="menu" aria-label="View menu">
            <button type="button" className="menu-item" onClick={() => {
              setOpenMenu(null)
              onCenterView()
            }}>
              Reset View
            </button>
            <button type="button" className="menu-item" onClick={() => {
              setOpenMenu(null)
              onToggleDarkMode()
            }}>
              {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </button>
            <button type="button" className="menu-item" onClick={() => {
              setOpenMenu(null)
              onToggleShaderCompositing()
            }}>
              {shaderCompositingEnabled ? 'Disable Shader Compositing' : 'Enable Shader Compositing'}
            </button>
            <div className={`menu-subgroup ${openSubmenu === 'bg-shaders' ? 'open' : ''}`}>
              <button
                type="button"
                className="menu-item menu-item-submenu-trigger"
                aria-expanded={openSubmenu === 'bg-shaders'}
                aria-haspopup="menu"
                onClick={() => {
                  setOpenSubmenu((current) =>
                    current === 'bg-shaders' ? null : 'bg-shaders',
                  )
                }}
              >
                <span>Shaders (BG)</span>
                <span className="menu-item-hint">
                  {backgroundShaderOptions.find((option) => option.id === currentBackgroundShaderId)?.label ?? 'Unknown'}
                </span>
              </button>
              {openSubmenu === 'bg-shaders' && (
                <div className="menu-panel menu-subpanel" role="menu" aria-label="Background shaders">
                  {backgroundShaderOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        setOpenSubmenu(null)
                        setOpenMenu(null)
                        onSelectBackgroundShader(option.id)
                      }}
                    >
                      {option.id === currentBackgroundShaderId
                        ? `${option.label} [Current]`
                        : option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="menu-item" onClick={() => {
              setOpenMenu(null)
              onToggleShaderSandbox()
            }}>
              {shaderSandboxOpen ? 'Close Shader Sandbox' : 'Open Shader Sandbox'}
            </button>
            </div>
          )}
        </div>
      </nav>

      <div className="toolbar-meta">
        <span className="meta">{imageCount} image(s)</span>
        <span className="meta">
          Background: {backgroundShaderOptions.find((option) => option.id === currentBackgroundShaderId)?.label ?? 'Unknown'}
        </span>
        <span className="meta">Selection FX: {enableSelectionShader ? 'Shader' : 'Fallback'}</span>
      </div>
    </header>
  )
}

export default AppToolbar
