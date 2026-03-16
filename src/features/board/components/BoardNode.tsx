import { memo } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { CARD_BORDER_HEIGHT, CAPTION_HEIGHT, WORLD_ORIGIN } from '../constants'
import type { BoardImage, MediaTimeline } from '../model'
import MediaBody from './MediaBody'
import NodeFooter from './NodeFooter'
import NodeSelectionFx from './NodeSelectionFx'
import NoteBody from './NoteBody'
import SeekPanel from './SeekPanel'

type BoardNodeProps = {
  image: BoardImage
  selected: boolean
  displayX: number
  displayY: number
  displayWidth: number
  broken: boolean
  mediaTransformCss: string
  mediaTransformOrigin: string
  enableSelectionShader: boolean
  seekPanelOpen: boolean
  videoTimeline?: MediaTimeline
  gifFrameCount: number
  gifSeekFrame: number
  onPointerDown: (event: ReactPointerEvent, id: number) => void
  onContextMenu: (event: ReactMouseEvent, id: number) => void
  onResizePointerDown: (event: ReactPointerEvent, id: number) => void
  onDisableSelectionShader: () => void
  onNoteFocusChange: (focused: boolean) => void
  onNoteMarkdownChange: (id: number, markdown: string) => void
  onToggleNoteMode: (id: number) => void
  setVideoRef: (id: number, element: HTMLVideoElement | null) => void
  onVideoLoadedMetadata: (id: number, event: React.SyntheticEvent<HTMLVideoElement>) => void
  onVideoTimeUpdate: (id: number, event: React.SyntheticEvent<HTMLVideoElement>) => void
  onMediaError: (id: number) => void
  onImageLoad: (id: number, event: React.SyntheticEvent<HTMLImageElement>) => void
  onSeekVideo: (id: number, time: number) => void
  onSeekGif: (image: BoardImage, nextFrame: number) => void
}

function BoardNode({
  image,
  selected,
  displayX,
  displayY,
  displayWidth,
  broken,
  mediaTransformCss,
  mediaTransformOrigin,
  enableSelectionShader,
  seekPanelOpen,
  videoTimeline,
  gifFrameCount,
  gifSeekFrame,
  onPointerDown,
  onContextMenu,
  onResizePointerDown,
  onDisableSelectionShader,
  onNoteFocusChange,
  onNoteMarkdownChange,
  onToggleNoteMode,
  setVideoRef,
  onVideoLoadedMetadata,
  onVideoTimeUpdate,
  onMediaError,
  onImageLoad,
  onSeekVideo,
  onSeekGif,
}: BoardNodeProps) {
  const isMediaStack = image.mediaKind !== 'note' && (image.mediaItems?.length ?? 0) > 1
  const displayImageSrc = image.isGif && image.paused && image.gifFreezeSrc ? image.gifFreezeSrc : image.src
  const shouldUseBlurBg = isMediaStack && image.mediaKind === 'image' && !image.isGif
  const className = [
    'board-image',
    'node-shell',
    selected ? 'selected is-selected' : '',
    image.mediaKind === 'note' ? 'note-node' : '',
    isMediaStack ? 'media-stack-node' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <figure
      className={className}
      style={{
        transform: `translate(${displayX + WORLD_ORIGIN}px, ${displayY + WORLD_ORIGIN}px)`,
        width: `${displayWidth}px`,
        height: image.mediaKind === 'note' ? `${displayWidth * image.aspect + CAPTION_HEIGHT + CARD_BORDER_HEIGHT}px` : undefined,
        zIndex: image.z,
      }}
      onPointerDown={(event) => onPointerDown(event, image.id)}
      onContextMenu={(event) => onContextMenu(event, image.id)}
    >
      {image.mediaKind === 'note' ? (
        <NoteBody
          noteMarkdown={image.noteMarkdown ?? ''}
          noteMode={image.noteMode ?? 'editing'}
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onFocusChange={onNoteFocusChange}
          onChange={(markdown) => {
            onNoteMarkdownChange(image.id, markdown)
          }}
        />
      ) : (
        <MediaBody
          image={image}
          displayWidth={displayWidth}
          broken={broken}
          mediaTransformCss={mediaTransformCss}
          mediaTransformOrigin={mediaTransformOrigin}
          displayImageSrc={displayImageSrc}
          shouldUseBlurBg={shouldUseBlurBg}
          setVideoRef={(element) => {
            setVideoRef(image.id, element)
          }}
          onVideoLoadedMetadata={(event) => {
            onVideoLoadedMetadata(image.id, event)
          }}
          onVideoTimeUpdate={(event) => {
            onVideoTimeUpdate(image.id, event)
          }}
          onVideoError={() => {
            onMediaError(image.id)
          }}
          onImageLoad={(event) => {
            onImageLoad(image.id, event)
          }}
          onImageError={() => {
            onMediaError(image.id)
          }}
        />
      )}

      {selected && <NodeSelectionFx enabled={enableSelectionShader} onDisable={onDisableSelectionShader} />}

      <NodeFooter
        image={image}
        isMediaStack={isMediaStack}
        onToggleNoteMode={() => {
          onToggleNoteMode(image.id)
        }}
      />

      <button
        type="button"
        className="resize-handle"
        onPointerDown={(event) => onResizePointerDown(event, image.id)}
        aria-label={`Resize ${image.name}`}
      />

      {seekPanelOpen && (
        <SeekPanel
          image={image}
          videoTimeline={videoTimeline}
          gifFrameCount={Math.max(gifFrameCount, 1)}
          gifSeekFrame={Math.min(gifSeekFrame, Math.max(gifFrameCount - 1, 0))}
          onSeekVideo={(time) => {
            onSeekVideo(image.id, time)
          }}
          onSeekGif={(nextFrame) => {
            void onSeekGif(image, nextFrame)
          }}
        />
      )}
    </figure>
  )
}

const areNodeMediaItemsEqual = (
  left: BoardImage['mediaItems'],
  right: BoardImage['mediaItems'],
) => {
  if (left === right) {
    return true
  }

  const leftItems = left ?? []
  const rightItems = right ?? []
  if (leftItems.length !== rightItems.length) {
    return false
  }

  for (let index = 0; index < leftItems.length; index += 1) {
    const leftItem = leftItems[index]
    const rightItem = rightItems[index]
    if (
      leftItem.src !== rightItem.src ||
      leftItem.sourceDataUrl !== rightItem.sourceDataUrl ||
      leftItem.sourceUrl !== rightItem.sourceUrl ||
      leftItem.name !== rightItem.name ||
      leftItem.mediaKind !== rightItem.mediaKind ||
      leftItem.isGif !== rightItem.isGif
    ) {
      return false
    }
  }

  return true
}

const areBoardNodePropsEqual = (
  prevProps: BoardNodeProps,
  nextProps: BoardNodeProps,
) =>
  prevProps.image.id === nextProps.image.id &&
  prevProps.image.src === nextProps.image.src &&
  prevProps.image.name === nextProps.image.name &&
  prevProps.image.mediaKind === nextProps.image.mediaKind &&
  prevProps.image.isGif === nextProps.image.isGif &&
  prevProps.image.paused === nextProps.image.paused &&
  prevProps.image.gifFreezeSrc === nextProps.image.gifFreezeSrc &&
  prevProps.image.activeMediaIndex === nextProps.image.activeMediaIndex &&
  prevProps.image.slideshowPlaying === nextProps.image.slideshowPlaying &&
  prevProps.image.noteMarkdown === nextProps.image.noteMarkdown &&
  prevProps.image.noteMode === nextProps.image.noteMode &&
  prevProps.image.aspect === nextProps.image.aspect &&
  prevProps.image.z === nextProps.image.z &&
  areNodeMediaItemsEqual(prevProps.image.mediaItems, nextProps.image.mediaItems) &&
  prevProps.selected === nextProps.selected &&
  prevProps.displayX === nextProps.displayX &&
  prevProps.displayY === nextProps.displayY &&
  prevProps.displayWidth === nextProps.displayWidth &&
  prevProps.broken === nextProps.broken &&
  prevProps.mediaTransformCss === nextProps.mediaTransformCss &&
  prevProps.mediaTransformOrigin === nextProps.mediaTransformOrigin &&
  prevProps.enableSelectionShader === nextProps.enableSelectionShader &&
  prevProps.seekPanelOpen === nextProps.seekPanelOpen &&
  prevProps.videoTimeline?.current === nextProps.videoTimeline?.current &&
  prevProps.videoTimeline?.duration === nextProps.videoTimeline?.duration &&
  prevProps.gifFrameCount === nextProps.gifFrameCount &&
  prevProps.gifSeekFrame === nextProps.gifSeekFrame

export default memo(BoardNode, areBoardNodePropsEqual)
