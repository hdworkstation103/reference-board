import type { NodeMediaItem } from "../model";

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

  const dataUrl = await fileToDataUrl(file)
  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')

  return {
    src: sourceUrl || dataUrl,
    sourceDataUrl: dataUrl,
    sourceUrl,
    name: file.name,
    mediaKind: file.type.startsWith('video/') ? 'video' : 'image',
    isGif,
  }
}
