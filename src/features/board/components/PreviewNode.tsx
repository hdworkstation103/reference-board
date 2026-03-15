import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { BoardImage } from '../model'
import { CAPTION_HEIGHT, CARD_BORDER_HEIGHT, WORLD_ORIGIN } from '../constants'

type PreviewNodeProps = {
  x: number
  y: number
  width: number
  aspect: number
  zIndex: number
  sourceImage: BoardImage | null
  displaySrc: string
  mediaTransformCss: string
  mediaTransformOrigin: string
  shouldUseBlurBg: boolean
  isDropTarget: boolean
  videoCurrentTime?: number
  onPointerDown: (event: ReactPointerEvent) => void
}

function PreviewNode({
  x,
  y,
  width,
  aspect,
  zIndex,
  sourceImage,
  displaySrc,
  mediaTransformCss,
  mediaTransformOrigin,
  shouldUseBlurBg,
  isDropTarget,
  videoCurrentTime,
  onPointerDown,
}: PreviewNodeProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !sourceImage || sourceImage.mediaKind !== 'video') {
      return
    }

    if (typeof videoCurrentTime === 'number' && Number.isFinite(videoCurrentTime)) {
      const drift = Math.abs(video.currentTime - videoCurrentTime)
      if (drift > 0.2) {
        video.currentTime = videoCurrentTime
      }
    }

    if (sourceImage.paused) {
      video.pause()
      return
    }

    void video.play().catch(() => {
      // Autoplay can be blocked transiently; source node remains the source of truth.
    })
  }, [sourceImage, videoCurrentTime])

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
      {sourceImage ? (
        <div className="media-frame node-body" style={{ height: `${width * aspect}px` }}>
          {shouldUseBlurBg && (
            <img className="media-bg-blur" src={displaySrc} alt="" draggable={false} aria-hidden="true" />
          )}
          {sourceImage.mediaKind === 'video' ? (
            <video
              ref={videoRef}
              className="media-content"
              src={sourceImage.src}
              muted
              loop
              autoPlay={!sourceImage.paused}
              playsInline
              preload="metadata"
              draggable={false}
              style={{
                transform: mediaTransformCss,
                transformOrigin: mediaTransformOrigin,
              }}
            />
          ) : (
            <img
              className="media-content"
              src={displaySrc}
              alt={`${sourceImage.name} preview`}
              draggable={false}
              style={{
                transform: mediaTransformCss,
                transformOrigin: mediaTransformOrigin,
              }}
            />
          )}
        </div>
      ) : (
        <div className="preview-node-placeholder" style={{ height: `${width * aspect}px` }}>
          <span className="preview-node-eyebrow">Preview</span>
          <strong className="preview-node-title">Awaiting input</strong>
          <span className="preview-node-copy">Drag a media output socket here to mirror that node.</span>
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
