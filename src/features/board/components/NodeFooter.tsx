import type { BoardImage } from '../types'

type NodeFooterProps = {
  image: BoardImage
  isMediaStack: boolean
  onToggleSlideshow: () => void
  onToggleNoteMode: () => void
}

function NodeFooter({ image, isMediaStack, onToggleSlideshow, onToggleNoteMode }: NodeFooterProps) {
  return (
    <figcaption className="node-footer">
      <span className="caption-name">{image.name}</span>
      {isMediaStack && (
        <span className="stack-count">
          {Math.max(0, Math.min(image.activeMediaIndex ?? 0, (image.mediaItems?.length ?? 1) - 1)) + 1}/
          {image.mediaItems?.length}
        </span>
      )}
      {isMediaStack && (
        <button
          type="button"
          className="slideshow-toggle"
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            onToggleSlideshow()
          }}
          aria-label={`${image.slideshowPlaying ? 'Pause' : 'Play'} slideshow for ${image.name}`}
        >
          {image.slideshowPlaying ? 'Pause' : 'Play'}
        </button>
      )}
      {image.mediaKind === 'note' && (
        <button
          type="button"
          className="note-mode-toggle"
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            onToggleNoteMode()
          }}
          aria-label={`${image.noteMode === 'editing' ? 'View' : 'Edit'} ${image.name}`}
        >
          {image.noteMode === 'editing' ? 'View' : 'Edit'}
        </button>
      )}
      <button
        type="button"
        className="source-link"
        disabled={!image.sourceUrl}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.stopPropagation()
          if (!image.sourceUrl) {
            return
          }
          window.open(image.sourceUrl, '_blank', 'noopener,noreferrer')
        }}
        title={image.sourceUrl ?? 'No source available'}
        aria-label={`Open source for ${image.name}`}
      >
        Source
      </button>
    </figcaption>
  )
}

export default NodeFooter
