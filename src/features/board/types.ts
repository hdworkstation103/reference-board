export type BoardImage = {
  id: number
  src: string
  sourceDataUrl?: string
  sourceUrl?: string
  name: string
  mediaKind: 'image' | 'video' | 'note'
  isGif: boolean
  paused: boolean
  gifFreezeSrc?: string
  mediaItems?: NodeMediaItem[]
  activeMediaIndex?: number
  slideshowPlaying?: boolean
  noteMarkdown?: string
  noteMode?: 'editing' | 'viewing'
  x: number
  y: number
  width: number
  aspect: number
  z: number
}

export type PreparedMedia = Pick<
  BoardImage,
  'id' | 'src' | 'sourceDataUrl' | 'name' | 'mediaKind' | 'isGif' | 'paused' | 'z'
>

export type NodeMediaItem = {
  src: string
  sourceDataUrl?: string
  sourceUrl?: string
  name: string
  mediaKind: 'image' | 'video'
  isGif: boolean
}

export type SnapshotMedia = {
  id: string
  name: string
  mediaKind: 'image' | 'video'
  isGif: boolean
  sourceDataUrl?: string
  sourceUrl?: string
}

export type SnapshotMediaNode = Pick<BoardImage, 'id' | 'paused' | 'x' | 'y' | 'width' | 'aspect' | 'z'> & {
  kind: 'media'
  mediaIds: string[]
  activeMediaIndex: number
  slideshowPlaying?: boolean
}

export type SnapshotNoteNode = Pick<BoardImage, 'id' | 'x' | 'y' | 'width' | 'aspect' | 'z'> & {
  kind: 'note'
  name: string
  noteMarkdown: string
  noteMode: 'editing' | 'viewing'
}

export type SnapshotNode = SnapshotMediaNode | SnapshotNoteNode

export type BoardSnapshotV4 = {
  version: 4
  createdAt: string
  media: Record<string, SnapshotMedia>
  nodes: SnapshotNode[]
  groups: PersistedGroup[]
  darkMode: boolean
}

export type MediaTimeline = {
  current: number
  duration: number
}

export type ItemRect = {
  left: number
  top: number
  right: number
  bottom: number
}

export type GroupBounds = {
  left: number
  top: number
  width: number
  height: number
}

export type GroupOverlayState = {
  bounds: GroupBounds
  active: boolean
}

export type PersistedGroup = {
  id: number
  memberIds: number[]
}

export type DragState = {
  kind: 'move'
  id: number
  offsetX: number
  offsetY: number
}

export type ResizeState = {
  kind: 'resize'
  id: number
  startWidth: number
  startPointerX: number
}

export type GroupMoveState = {
  kind: 'move-group'
  ids: number[]
  startPointerX: number
  startPointerY: number
  startPositions: Record<number, { x: number; y: number }>
}

export type GroupResizeState = {
  kind: 'resize-group'
  ids: number[]
  startPointerX: number
  startBounds: GroupBounds
  startItems: Record<number, { x: number; y: number; width: number }>
  minScale: number
}

export type ExtractSlideState = {
  kind: 'extract-slide'
  sourceId: number
  sourceRect: ItemRect
  offsetX: number
  offsetY: number
  sourceWidth: number
  sourceAspect: number
  extractedIndex: number
  extractedMedia: NodeMediaItem
}

export type InteractionState =
  | DragState
  | ResizeState
  | GroupMoveState
  | GroupResizeState
  | ExtractSlideState

export type ScaleModeState = {
  ids: number[]
  centerX: number
  centerY: number
  startDistance: number
  previewScale: number
  minScale: number
  startItems: Record<number, { x: number; y: number; width: number }>
}

export type MoveModeState = {
  ids: number[]
  startPointerX: number
  startPointerY: number
  offsetX: number
  offsetY: number
  startItems: Record<number, { x: number; y: number; width: number }>
}

export type PanState = {
  startClientX: number
  startClientY: number
  startScrollLeft: number
  startScrollTop: number
}

export type MarqueeState = {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export type PersistentGroupView = {
  id: number
  memberIds: number[]
  bounds: GroupBounds
}
