import type { BoardImage, NodeMediaItem } from '../types'

export const getActiveMediaItem = (item: BoardImage) => {
  const mediaItems = item.mediaItems
  if (!mediaItems || mediaItems.length === 0) {
    return null
  }

  const index = Math.max(0, Math.min(item.activeMediaIndex ?? 0, mediaItems.length - 1))
  return { index, media: mediaItems[index] }
}

export const applyActiveMediaFromItems = (item: BoardImage): BoardImage => {
  const active = getActiveMediaItem(item)
  if (!active) {
    return item
  }

  return {
    ...item,
    activeMediaIndex: active.index,
    src: active.media.sourceUrl || active.media.sourceDataUrl || '',
    sourceDataUrl: active.media.sourceDataUrl,
    sourceUrl: active.media.sourceUrl,
    name: active.media.name,
    mediaKind: active.media.mediaKind,
    isGif: active.media.isGif,
  }
}

export const getMediaItemsForNode = (item: BoardImage): NodeMediaItem[] => {
  if (item.mediaKind === 'note') {
    return []
  }

  if (item.mediaItems && item.mediaItems.length > 0) {
    return item.mediaItems
  }

  return [
    {
      src: item.src,
      sourceDataUrl: item.sourceDataUrl,
      sourceUrl: item.sourceUrl,
      name: item.name,
      mediaKind: item.mediaKind,
      isGif: item.isGif,
    },
  ]
}
