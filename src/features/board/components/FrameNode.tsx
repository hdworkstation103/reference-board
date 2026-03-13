import { useEffect, useRef, useState } from 'react'
import { WORLD_ORIGIN } from '../constants'
import type { BoardFrame, BoardImage, GroupBounds } from '../types'

type FrameNodeProps = {
  frame: BoardFrame
  bounds: GroupBounds
  selected: boolean
  renameRequested: boolean
  displayZIndex: number
  activeItem: BoardImage | null
  hiddenCount: number
  onMovePointerDown: (event: React.PointerEvent, frameId: number) => void
  onContextMenu: (event: React.MouseEvent, frameId: number) => void
  onSelect: (frameId: number) => void
  onRename: (frameId: number, name: string) => void
  onRenameStateChange: (frameId: number, active: boolean) => void
  onToggleCollapsed: (frameId: number) => void
  onToggleSlideshow: (frameId: number) => void
  onStepSlideshow: (frameId: number, direction: 1 | -1) => void
}

function FramePreview({ item }: { item: BoardImage | null }) {
  if (!item) {
    return <div className="frame-node-empty">Empty frame</div>
  }

  if (item.mediaKind === 'note') {
    return (
      <div className="frame-node-note-preview">
        {(item.noteMarkdown ?? 'Note').slice(0, 160)}
      </div>
    )
  }

  if (item.mediaKind === 'video') {
    return (
      <video
        className="frame-node-preview-media"
        src={item.src}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
      />
    )
  }

  return <img className="frame-node-preview-media" src={item.src} alt={item.name} draggable={false} />
}

function FrameNode({
  frame,
  bounds,
  selected,
  renameRequested,
  displayZIndex,
  activeItem,
  hiddenCount,
  onMovePointerDown,
  onContextMenu,
  onSelect,
  onRename,
  onRenameStateChange,
  onToggleCollapsed,
  onToggleSlideshow,
  onStepSlideshow,
}: FrameNodeProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(frame.name)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isRenaming) {
      setDraftName(frame.name)
    }
  }, [frame.name, isRenaming])

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [isRenaming])

  useEffect(() => {
    onRenameStateChange(frame.id, isRenaming)
  }, [frame.id, isRenaming, onRenameStateChange])

  useEffect(() => {
    if (renameRequested) {
      setIsRenaming(true)
    }
  }, [renameRequested])

  const commitRename = () => {
    const nextName = draftName.trim()
    if (nextName.length > 0 && nextName !== frame.name) {
      onRename(frame.id, nextName)
    }
    setIsRenaming(false)
  }

  const cancelRename = () => {
    setDraftName(frame.name)
    setIsRenaming(false)
  }

  const titleContent = isRenaming ? (
    <input
      ref={renameInputRef}
      className="frame-node-title-input"
      value={draftName}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.stopPropagation()
      }}
      onChange={(event) => {
        setDraftName(event.currentTarget.value)
      }}
      onBlur={commitRename}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commitRename()
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          cancelRename()
        }
      }}
    />
  ) : (
    <span
      className="frame-node-title"
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        setIsRenaming(true)
      }}
    >
      {frame.name}
    </span>
  )

  if (frame.collapsed) {
    return (
      <section
        className={`frame-node frame-node-collapsed ${selected ? 'is-selected' : ''}`}
        style={{
          left: `${bounds.left + WORLD_ORIGIN}px`,
          top: `${bounds.top + WORLD_ORIGIN}px`,
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
          zIndex: displayZIndex,
        }}
        onPointerDown={(event) => {
          onSelect(frame.id)
          if (event.button === 0) {
            onMovePointerDown(event, frame.id)
          }
        }}
        onContextMenu={(event) => onContextMenu(event, frame.id)}
      >
        <header className="frame-node-toolbar" onPointerDown={(event) => onMovePointerDown(event, frame.id)}>
          {titleContent}
          <button
            type="button"
            className="frame-node-chip"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onToggleCollapsed(frame.id)
            }}
          >
            Untuck
          </button>
        </header>
        <div className="frame-node-preview-shell">
          <FramePreview item={activeItem} />
        </div>
        <footer className="frame-node-footer">
          <span className="frame-node-count">{hiddenCount} tucked</span>
          <div className="frame-node-controls">
            <button
              type="button"
              className="frame-node-chip"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onStepSlideshow(frame.id, -1)
              }}
            >
              Prev
            </button>
            <button
              type="button"
              className="frame-node-chip"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onToggleSlideshow(frame.id)
              }}
            >
              {frame.slideshowPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="frame-node-chip"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onStepSlideshow(frame.id, 1)
              }}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    )
  }

  return (
    <section
      className={`frame-node frame-node-expanded ${selected ? 'is-selected' : ''}`}
      style={{
        left: `${bounds.left + WORLD_ORIGIN}px`,
        top: `${bounds.top + WORLD_ORIGIN}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        zIndex: displayZIndex,
      }}
      onPointerDown={() => onSelect(frame.id)}
      onContextMenu={(event) => onContextMenu(event, frame.id)}
    >
      <header className="frame-node-toolbar" onPointerDown={(event) => onMovePointerDown(event, frame.id)}>
        {titleContent}
        <div className="frame-node-controls">
          <span className="frame-node-count">{frame.memberIds.length} nodes</span>
          <button
            type="button"
            className="frame-node-chip"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onToggleCollapsed(frame.id)
            }}
          >
            Tuck
          </button>
        </div>
      </header>
    </section>
  )
}

export default FrameNode
