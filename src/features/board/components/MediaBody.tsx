import { useState } from "react";
import type { BoardImage } from "../model";
import MediaShineFx from "./MediaShineFx";

type MediaBodyProps = {
  image: BoardImage
  displayWidth: number
  broken: boolean
  mediaTransformCss: string
  mediaTransformOrigin: string
  displayImageSrc: string
  shouldUseBlurBg: boolean
  setImageRef: (element: HTMLImageElement | null) => void
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
  mediaTransformCss,
  mediaTransformOrigin,
  displayImageSrc,
  shouldUseBlurBg,
  setImageRef,
  setVideoRef,
  onVideoLoadedMetadata,
  onVideoTimeUpdate,
  onVideoError,
  onImageLoad,
  onImageError,
}: MediaBodyProps) {
  const [shineActive, setShineActive] = useState(false);

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
      <div
        className="media-frame node-body"
        style={{ height: `${displayWidth * image.aspect}px` }}
        onPointerEnter={() => setShineActive(true)}
        onPointerLeave={() => setShineActive(false)}
      >
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
          style={{
            transform: mediaTransformCss,
            transformOrigin: mediaTransformOrigin,
          }}
          onLoadedMetadata={onVideoLoadedMetadata}
          onTimeUpdate={onVideoTimeUpdate}
          onError={onVideoError}
        />
        <MediaShineFx active={shineActive} />
      </div>
    )
  }

  return (
    <div
      className="media-frame node-body"
      style={{ height: `${displayWidth * image.aspect}px` }}
      onPointerEnter={() => setShineActive(true)}
      onPointerLeave={() => setShineActive(false)}
    >
      {shouldUseBlurBg && (
        <img className="media-bg-blur" src={displayImageSrc} alt="" draggable={false} aria-hidden="true" />
      )}
      <img
        className="media-content"
        src={displayImageSrc}
        alt={image.name}
        draggable={false}
        ref={setImageRef}
        style={{
          transform: mediaTransformCss,
          transformOrigin: mediaTransformOrigin,
        }}
        onLoad={onImageLoad}
        onError={onImageError}
      />
      <MediaShineFx active={shineActive} />
    </div>
  )
}

export default MediaBody
