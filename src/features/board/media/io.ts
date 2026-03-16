import type { BoardImage, NodeMediaItem } from "../model";

type FileSystemFileEntryLike = FileSystemFileEntry & {
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void
}

type FileSystemDirectoryReaderLike = {
  readEntries: (
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void
}

type FileSystemDirectoryEntryLike = FileSystemDirectoryEntry & {
  createReader: () => FileSystemDirectoryReaderLike
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null
}

type DroppedMediaFile = {
  file: File
  relativePath: string
}

const isMediaFile = (file: File) =>
  file.type.startsWith('image/') || file.type.startsWith('video/')

const readFileEntry = (entry: FileSystemFileEntryLike) =>
  new Promise<File>((resolve, reject) => {
    entry.file(resolve, (error) => reject(error))
  })

const readDirectoryEntries = async (
  directory: FileSystemDirectoryEntryLike,
) => {
  const reader = directory.createReader()
  const entries: FileSystemEntry[] = []

  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, (error) => reject(error))
    })

    if (batch.length === 0) {
      break
    }

    entries.push(...batch)
  }

  return entries
}

const collectEntryMediaFiles = async (
  entry: FileSystemEntry,
  parentPath = '',
): Promise<DroppedMediaFile[]> => {
  const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name

  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntryLike)
    return isMediaFile(file) ? [{ file, relativePath }] : []
  }

  if (!entry.isDirectory) {
    return []
  }

  const children = await readDirectoryEntries(entry as FileSystemDirectoryEntryLike)
  const nested = await Promise.all(
    children.map((child) => collectEntryMediaFiles(child, relativePath)),
  )
  return nested.flat()
}

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

export const extractDroppedMediaFiles = async (transfer: DataTransfer | null) => {
  if (!transfer) {
    return {
      files: [] as File[],
      topLevelDirectoryNames: [] as string[],
      fromDirectory: false,
    }
  }

  const entryItems = Array.from(transfer.items)
    .map((item) => (item as DataTransferItemWithEntry).webkitGetAsEntry?.() ?? null)
    .filter((entry) => entry !== null) as FileSystemEntry[]

  const topLevelDirectoryNames = entryItems
    .filter((entry) => entry.isDirectory)
    .map((entry) => entry.name)

  if (topLevelDirectoryNames.length > 0) {
    const droppedFiles = (await Promise.all(
      entryItems.map((entry) => collectEntryMediaFiles(entry)),
    ))
      .flat()
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))

    return {
      files: droppedFiles.map(({ file }) => file),
      topLevelDirectoryNames,
      fromDirectory: true,
    }
  }

  const directFiles = Array.from(transfer.files).filter(isMediaFile)
  const relativeTopLevelDirectories = Array.from(
    new Set(
      directFiles
        .map((file) => file.webkitRelativePath.split('/')[0] ?? '')
        .filter((name) => name.length > 0),
    ),
  )

  return {
    files: directFiles.sort((left, right) =>
      (left.webkitRelativePath || left.name).localeCompare(
        right.webkitRelativePath || right.name,
      ),
    ),
    topLevelDirectoryNames: relativeTopLevelDirectories,
    fromDirectory: relativeTopLevelDirectories.length > 0,
  }
}

export const createMediaItemFromFile = async (file: File, sourceUrl?: string): Promise<NodeMediaItem | null> => {
  if (!isMediaFile(file)) {
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
