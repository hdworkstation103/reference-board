import type { PointerEvent as ReactPointerEvent } from 'react'
import type { BoardImage } from '../model'
import { CAPTION_HEIGHT, CARD_BORDER_HEIGHT, WORLD_ORIGIN } from '../constants'
import TexturePreviewSurface from './TexturePreviewSurface'

type PreviewNodeProps = {
  x: number
  y: number
  width: number
  aspect: number
  zIndex: number
  sourceImage: BoardImage | null
  sourceCanvas: HTMLCanvasElement | null
  isDropTarget: boolean
  onPointerDown: (event: ReactPointerEvent) => void
}

function PreviewNode({
  x,
  y,
  width,
  aspect,
  zIndex,
  sourceImage,
  sourceCanvas,
  isDropTarget,
  onPointerDown,
}: PreviewNodeProps) {
  return (
    <figure
      className={[
        'board-image',
        'node-shell',
        'preview-node-shell',
        isDropTarget ? 'is-wire-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        transform: `translate(${x + WORLD_ORIGIN}px, ${y + WORLD_ORIGIN}px)`,
        width: `${width}px`,
        height: `${width * aspect + CAPTION_HEIGHT + CARD_BORDER_HEIGHT}px`,
        zIndex,
      }}
      onPointerDown={onPointerDown}
    >
      <div className="preview-node-input" aria-hidden="true" />
      {sourceImage && sourceCanvas ? (
        <div className="media-frame node-body" style={{ height: `${width * aspect}px` }}>
          <TexturePreviewSurface className="media-content" source={sourceCanvas} />
        </div>
      ) : (
        <div className="preview-node-placeholder" style={{ height: `${width * aspect}px` }}>
          <span className="preview-node-eyebrow">Preview</span>
          <strong className="preview-node-title">
            {sourceImage ? 'Rendering output' : 'Awaiting input'}
          </strong>
          <span className="preview-node-copy">
            {sourceImage
              ? 'Connected node output is warming up.'
              : 'Drag a media output socket here to stream a node surface.'}
          </span>
        </div>
      )}
      <figcaption className="node-footer preview-node-footer">
        <span className="caption-name">Preview</span>
        <span className="preview-node-source">
          {sourceImage ? sourceImage.name : 'No source connected'}
        </span>
      </figcaption>
    </figure>
  )
}

export default PreviewNode
