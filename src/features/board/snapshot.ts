import { MIN_IMAGE_WIDTH, NOTE_DEFAULT_ASPECT } from './constants'
import type { BoardImage, BoardSnapshotV4, NodeMediaItem, PersistedGroup, SnapshotMedia, SnapshotNode } from './types'

export const buildSnapshot = (images: BoardImage[], groups: PersistedGroup[], darkMode: boolean): BoardSnapshotV4 => {
  const media: Record<string, SnapshotMedia> = {}
  const mediaIdBySignature = new Map<string, string>()

  const nodes: SnapshotNode[] = images.map((image) => {
    if (image.mediaKind === 'note') {
      return {
        kind: 'note',
        id: image.id,
        name: image.name,
        noteMarkdown: image.noteMarkdown ?? '',
        noteMode: image.noteMode === 'editing' ? 'editing' : 'viewing',
        x: image.x,
        y: image.y,
        width: image.width,
        aspect: image.aspect,
        z: image.z,
      }
    }

    const mediaItems =
      image.mediaItems && image.mediaItems.length > 0
        ? image.mediaItems
        : [
            {
              src: image.src,
              sourceDataUrl: image.sourceDataUrl,
              sourceUrl: image.sourceUrl,
              name: image.name,
              mediaKind: image.mediaKind,
              isGif: image.isGif,
            },
          ]

    const mediaIds = mediaItems.map((mediaItem) => {
      const sourceDataUrl = mediaItem.sourceDataUrl || mediaItem.src
      const hasSource = typeof mediaItem.sourceUrl === 'string' && mediaItem.sourceUrl.length > 0
      const signature = hasSource
        ? `${mediaItem.mediaKind}:source:${mediaItem.isGif ? '1' : '0'}:${mediaItem.sourceUrl}`
        : `${mediaItem.mediaKind}:data:${mediaItem.isGif ? '1' : '0'}:${sourceDataUrl}`

      let mediaId = mediaIdBySignature.get(signature)
      if (!mediaId) {
        mediaId = `m${mediaIdBySignature.size + 1}`
        mediaIdBySignature.set(signature, mediaId)
        media[mediaId] = {
          id: mediaId,
          name: mediaItem.name,
          mediaKind: mediaItem.mediaKind,
          isGif: mediaItem.isGif,
          sourceDataUrl: hasSource ? undefined : sourceDataUrl,
          sourceUrl: hasSource ? mediaItem.sourceUrl : undefined,
        }
      }

      return mediaId
    })

    return {
      kind: 'media',
      id: image.id,
      mediaIds,
      activeMediaIndex: Math.max(0, Math.min(image.activeMediaIndex ?? 0, mediaIds.length - 1)),
      slideshowPlaying: Boolean(image.slideshowPlaying),
      paused: image.paused,
      x: image.x,
      y: image.y,
      width: image.width,
      aspect: image.aspect,
      z: image.z,
    }
  })

  return {
    version: 4,
    createdAt: new Date().toISOString(),
    media,
    nodes,
    groups: groups.map((group) => ({ id: group.id, memberIds: [...group.memberIds] })),
    darkMode,
  }
}

export const parseSnapshot = (text: string) => {
  const parsed = JSON.parse(text) as Partial<BoardSnapshotV4>
  if (!parsed || parsed.version !== 4 || !parsed.media || !Array.isArray(parsed.nodes)) {
    throw new Error('Unsupported snapshot format')
  }

  const mediaMap = parsed.media as Record<string, Partial<SnapshotMedia>>
  const loadedImages = parsed.nodes
    .map<BoardImage | null>((node) => {
      if (
        typeof node?.id !== 'number' ||
        typeof node?.x !== 'number' ||
        typeof node?.y !== 'number' ||
        typeof node?.width !== 'number' ||
        typeof node?.aspect !== 'number' ||
        typeof node?.z !== 'number'
      ) {
        return null
      }

      if (node.kind === 'note') {
        if (typeof node.name !== 'string' || typeof node.noteMarkdown !== 'string') {
          return null
        }

        return {
          id: node.id,
          src: '',
          sourceDataUrl: '',
          name: node.name,
          mediaKind: 'note' as const,
          isGif: false,
          paused: false,
          noteMarkdown: node.noteMarkdown,
          noteMode: node.noteMode === 'editing' ? 'editing' : ('viewing' as const),
          x: node.x,
          y: node.y,
          width: Math.max(MIN_IMAGE_WIDTH, node.width),
          aspect: node.aspect > 0 ? node.aspect : NOTE_DEFAULT_ASPECT,
          z: node.z,
        }
      }

      if (node.kind !== 'media' || !Array.isArray(node.mediaIds)) {
        return null
      }

      const mediaItems = node.mediaIds
        .map((mediaId) => mediaMap[mediaId])
        .filter((mediaEntry): mediaEntry is Partial<SnapshotMedia> => Boolean(mediaEntry))
        .map((mediaEntry) => {
          if (
            typeof mediaEntry.name !== 'string' ||
            (mediaEntry.mediaKind !== 'image' && mediaEntry.mediaKind !== 'video')
          ) {
            return null
          }

          const preferredSrc =
            typeof mediaEntry.sourceUrl === 'string' && mediaEntry.sourceUrl.length > 0
              ? mediaEntry.sourceUrl
              : typeof mediaEntry.sourceDataUrl === 'string'
                ? mediaEntry.sourceDataUrl
                : ''

          const nextItem: NodeMediaItem = {
            src: preferredSrc,
            sourceDataUrl: typeof mediaEntry.sourceDataUrl === 'string' ? mediaEntry.sourceDataUrl : undefined,
            sourceUrl: typeof mediaEntry.sourceUrl === 'string' ? mediaEntry.sourceUrl : undefined,
            name: mediaEntry.name,
            mediaKind: mediaEntry.mediaKind,
            isGif: Boolean(mediaEntry.isGif),
          }
          return nextItem
        })
        .filter((item): item is NodeMediaItem => item !== null)

      if (mediaItems.length === 0) {
        return null
      }

      const activeMediaIndex = Math.max(0, Math.min(node.activeMediaIndex ?? 0, mediaItems.length - 1))
      const activeMedia = mediaItems[activeMediaIndex]

      return {
        id: node.id,
        src: activeMedia.src,
        sourceDataUrl: activeMedia.sourceDataUrl,
        sourceUrl: activeMedia.sourceUrl,
        name: activeMedia.name,
        mediaKind: activeMedia.mediaKind,
        isGif: activeMedia.isGif,
        mediaItems,
        activeMediaIndex,
        slideshowPlaying: Boolean(node.slideshowPlaying),
        paused: Boolean(node.paused),
        x: node.x,
        y: node.y,
        width: Math.max(MIN_IMAGE_WIDTH, node.width),
        aspect: node.aspect > 0 ? node.aspect : 1,
        z: node.z,
      }
    })
    .filter((item): item is BoardImage => item !== null)

  const validIds = new Set(loadedImages.map((item) => item.id))
  const loadedGroups = Array.isArray(parsed.groups)
    ? parsed.groups
        .map((group, index) => ({
          id: typeof group?.id === 'number' ? group.id : index + 1,
          memberIds: Array.isArray(group?.memberIds)
            ? group.memberIds.filter((id): id is number => typeof id === 'number' && validIds.has(id))
            : [],
        }))
        .filter((group) => group.memberIds.length > 1)
    : []

  return {
    darkMode: Boolean(parsed.darkMode),
    loadedGroups,
    loadedImages,
    nextGroupId: loadedGroups.reduce((max, group) => Math.max(max, group.id), 0) + 1,
    nextId: loadedImages.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    nextZ: loadedImages.reduce((max, item) => Math.max(max, item.z), 0) + 1,
  }
}
