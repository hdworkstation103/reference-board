import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ContextMenuSection, ContextMenuState } from '../model'

type ContextMenuProps = {
  menu: ContextMenuState | null
  sections: ContextMenuSection[]
  onClose: () => void
  onAction: (actionId: string) => void
}

const MENU_GUTTER = 12

function getContextLabel(menu: ContextMenuState) {
  switch (menu.target.kind) {
    case 'board':
      return `Board at ${Math.round(menu.target.worldX)}, ${Math.round(menu.target.worldY)}`
    case 'node':
      return menu.target.nodeName
    case 'selection':
      return `${menu.target.selectedIds.length} selected`
    case 'frame':
      return menu.target.frameName
  }
}

function ContextMenu({ menu, sections, onClose, onAction }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) {
      return
    }

    const rect = menuRef.current.getBoundingClientRect()
    setPosition({
      left: Math.max(MENU_GUTTER, Math.min(menu.x, window.innerWidth - rect.width - MENU_GUTTER)),
      top: Math.max(MENU_GUTTER, Math.min(menu.y, window.innerHeight - rect.height - MENU_GUTTER)),
    })
  }, [menu, sections])

  useEffect(() => {
    if (!menu) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return
      }
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const handleViewportChange = () => {
      onClose()
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [menu, onClose])

  if (!menu || sections.length === 0) {
    return null
  }

  return (
    <div className="context-menu-layer" aria-hidden="true">
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: `${position.left}px`, top: `${position.top}px` }}
        role="menu"
        aria-label={`${menu.target.kind} context menu`}
      >
        <div className="context-menu-label">{getContextLabel(menu)}</div>
        {sections.map((section) => (
          <section
            key={section.title ?? section.items.map((item) => item.id).join('-')}
            className="context-menu-section"
          >
            {section.title ? <div className="context-menu-section-title">{section.title}</div> : null}
            {section.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="context-menu-item"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  onAction(item.id)
                  onClose()
                }}
              >
                <span>{item.label}</span>
                {item.shortcut ? <span className="context-menu-shortcut">{item.shortcut}</span> : null}
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

export default ContextMenu
