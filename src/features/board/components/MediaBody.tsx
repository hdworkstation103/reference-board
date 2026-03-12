import type { BoardImage } from '../types'

type MediaBodyProps = {
  image: BoardImage
  displayWidth: number
  broken: boolean
  displayImageSrc: string
  shouldUseBlurBg: boolean
  setVideoRef: (element: HTMLVideoElement | null) => void
  onVideoLoadedMetadata: React.ReactEventHandler<HTMLVideoElement>
  onVideoTimeUpdate: React.ReactEventHandler<HTMLVideoElement>
  onVideoError: () => void
  onImageLoad: React.ReactEventHandler<HTMLImageElement>
  onImageError: () => void
}

function MediaBody({
  image,
  displayWidth,
  broken,
  displayImageSrc,
  shouldUseBlurBg,
  setVideoRef,
  onVideoLoadedMetadata,
  onVideoTimeUpdate,
  onVideoError,
  onImageLoad,
  onImageError,
}: MediaBodyProps) {
  if (broken || !image.src) {
    return (
      <div
        className="broken-media"
        style={{ height: `${displayWidth * image.aspect}px` }}
        aria-label={`${image.name} failed to load`}
      >
        <div className="broken-media-icon">!</div>
        <div className="broken-media-label">Media unavailable</div>
      </div>
    )
  }

  if (image.mediaKind === 'video') {
    return (
      <div className="media-frame node-body" style={{ height: `${displayWidth * image.aspect}px` }}>
        <video
          className="media-content"
          src={image.src}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          draggable={false}
          ref={setVideoRef}
          onLoadedMetadata={onVideoLoadedMetadata}
          onTimeUpdate={onVideoTimeUpdate}
          onError={onVideoError}
        />
      </div>
    )
  }

  return (
    <div className="media-frame node-body" style={{ height: `${displayWidth * image.aspect}px` }}>
      {shouldUseBlurBg && (
        <img className="media-bg-blur" src={displayImageSrc} alt="" draggable={false} aria-hidden="true" />
      )}
      <img
        className="media-content"
        src={displayImageSrc}
        alt={image.name}
        draggable={false}
        onLoad={onImageLoad}
        onError={onImageError}
      />
    </div>
  )
}

export default MediaBody
