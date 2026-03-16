import type { BoardImage, NodeMediaItem } from "../model";

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error(`Failed to read ${file.name}`))
    }
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`))
    reader.readAsDataURL(file)
  })

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to materialize blob URL'))
    }
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to materialize blob URL'))
    reader.readAsDataURL(blob)
  })

export const isBlobUrl = (value?: string | null): value is string =>
  typeof value === 'string' && value.startsWith('blob:')

export const objectUrlToDataUrl = async (objectUrl: string) => {
  const response = await fetch(objectUrl)
  if (!response.ok) {
    throw new Error(`Failed to read object URL: ${response.status}`)
  }

  return blobToDataUrl(await response.blob())
}

const materializePersistedUrl = async (value?: string) => {
  if (!value) {
    return undefined
  }

  return isBlobUrl(value) ? objectUrlToDataUrl(value) : value
}

export const normalizeHttpUrl = (raw: string) => {
  const value = raw.trim()
  if (!value) {
    return null
  }

  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href
    }
  } catch {
    return null
  }

  return null
}

export const extractDropSourceUrls = (dataTransfer: DataTransfer) => {
  const urls: string[] = []
  const pushUrl = (candidate: string) => {
    const normalized = normalizeHttpUrl(candidate)
    if (normalized && !urls.includes(normalized)) {
      urls.push(normalized)
    }
  }

  const uriList = dataTransfer.getData('text/uri-list')
  if (uriList) {
    for (const line of uriList.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }
      pushUrl(trimmed)
    }
  }

  const plain = dataTransfer.getData('text/plain')
  if (plain) {
    for (const token of plain.split(/\s+/)) {
      pushUrl(token)
    }
  }

  const html = dataTransfer.getData('text/html')
  if (html) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      for (const img of Array.from(doc.querySelectorAll('img[src]'))) {
        pushUrl(img.getAttribute('src') ?? '')
      }
      for (const anchor of Array.from(doc.querySelectorAll('a[href]'))) {
        pushUrl(anchor.getAttribute('href') ?? '')
      }
    } catch {
      // Ignore malformed HTML snippets.
    }
  }

  const downloadUrl = dataTransfer.getData('DownloadURL')
  if (downloadUrl) {
    const parts = downloadUrl.split(':')
    if (parts.length >= 3) {
      pushUrl(parts.slice(2).join(':'))
    }
  }

  return urls
}

export const createMediaItemFromFile = async (file: File, sourceUrl?: string): Promise<NodeMediaItem | null> => {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return null
  }

  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
  const runtimeUrl = URL.createObjectURL(file)

  return {
    src: sourceUrl || runtimeUrl,
    sourceDataUrl: runtimeUrl,
    sourceUrl,
    name: file.name,
    mediaKind: file.type.startsWith('video/') ? 'video' : 'image',
    isGif,
  }
}

export const materializeNodeMediaItemForPersistence = async (
  mediaItem: NodeMediaItem,
): Promise<NodeMediaItem> => {
  const sourceDataUrl = await materializePersistedUrl(mediaItem.sourceDataUrl)
  const src = await materializePersistedUrl(mediaItem.src)

  if (mediaItem.sourceUrl) {
    return {
      ...mediaItem,
      src: mediaItem.sourceUrl,
      sourceDataUrl:
        sourceDataUrl ??
        (src && src !== mediaItem.sourceUrl ? src : undefined),
    }
  }

  return {
    ...mediaItem,
    src: src ?? mediaItem.src,
    sourceDataUrl: sourceDataUrl ?? src ?? mediaItem.sourceDataUrl,
  }
}

export const materializeBoardImageForPersistence = async (
  image: BoardImage,
): Promise<BoardImage> => {
  if (image.mediaKind === 'note') {
    return image
  }

  const sourceDataUrl = await materializePersistedUrl(image.sourceDataUrl)
  const src = await materializePersistedUrl(image.src)
  const mediaItems = image.mediaItems
    ? await Promise.all(
        image.mediaItems.map(materializeNodeMediaItemForPersistence),
      )
    : undefined

  const nextSrc = image.sourceUrl
    ? image.sourceUrl
    : src ?? sourceDataUrl ?? image.src

  return {
    ...image,
    src: nextSrc,
    sourceDataUrl: sourceDataUrl ?? src ?? image.sourceDataUrl,
    mediaItems,
  }
}
