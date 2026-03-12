import type { BoardImage, MediaTimeline } from '../types'

type SeekPanelProps = {
  image: BoardImage
  videoTimeline?: MediaTimeline
  gifFrameCount: number
  gifSeekFrame: number
  onSeekVideo: (time: number) => void
  onSeekGif: (nextFrame: number) => void
}

function SeekPanel({ image, videoTimeline, gifFrameCount, gifSeekFrame, onSeekVideo, onSeekGif }: SeekPanelProps) {
  if (image.mediaKind !== 'video' && !image.isGif) {
    return null
  }

  return (
    <div
      className="seek-panel open"
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
    >
      {image.mediaKind === 'video' ? (
        <>
          <div className="seek-panel-title">Video Seek</div>
          <input
            type="range"
            min={0}
            max={Math.max(videoTimeline?.duration ?? 0, 0.01)}
            step={0.01}
            value={Math.min(videoTimeline?.current ?? 0, Math.max(videoTimeline?.duration ?? 0, 0.01))}
            onChange={(event) => {
              onSeekVideo(Number(event.currentTarget.value))
            }}
          />
        </>
      ) : (
        <>
          <div className="seek-panel-title">GIF Seek</div>
          <input
            type="range"
            min={0}
            max={Math.max(gifFrameCount - 1, 0)}
            step={1}
            value={Math.min(gifSeekFrame, Math.max(gifFrameCount - 1, 0))}
            onChange={(event) => {
              onSeekGif(Number(event.currentTarget.value))
            }}
          />
        </>
      )}
    </div>
  )
}

export default SeekPanel
