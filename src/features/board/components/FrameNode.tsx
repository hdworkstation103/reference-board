import { WORLD_ORIGIN } from '../constants'
import type { BoardFrame, BoardImage, GroupBounds } from '../types'

type FrameNodeProps = {
  frame: BoardFrame
  bounds: GroupBounds
  selected: boolean
  displayZIndex: number
  activeItem: BoardImage | null
  hiddenCount: number
  onMovePointerDown: (event: React.PointerEvent, frameId: number) => void
  onSelect: (frameId: number) => void
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
  displayZIndex,
  activeItem,
  hiddenCount,
  onMovePointerDown,
  onSelect,
  onToggleCollapsed,
  onToggleSlideshow,
  onStepSlideshow,
}: FrameNodeProps) {
  if (frame.collapsed) {
    return (
      <section
        className={`frame-node frame-node-collapsed ${selected ? 'is-selected' : ''}`}
        style={{
          left: `${bounds.left + WORLD_ORIGIN}px`,
          top: `${bounds.top + WORLD_ORIGIN}px`,
          width: `${Math.max(240, Math.min(bounds.width, 420))}px`,
          zIndex: displayZIndex,
        }}
        onPointerDown={() => onSelect(frame.id)}
      >
        <header className="frame-node-toolbar" onPointerDown={(event) => onMovePointerDown(event, frame.id)}>
          <span className="frame-node-title">{frame.name}</span>
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
    >
      <header className="frame-node-toolbar" onPointerDown={(event) => onMovePointerDown(event, frame.id)}>
        <span className="frame-node-title">{frame.name}</span>
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
