import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import './App.css'

type BoardImage = {
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

type PreparedMedia = Pick<BoardImage, 'id' | 'src' | 'sourceDataUrl' | 'name' | 'mediaKind' | 'isGif' | 'paused' | 'z'>
type NodeMediaItem = {
  src: string
  sourceDataUrl?: string
  sourceUrl?: string
  name: string
  mediaKind: 'image' | 'video'
  isGif: boolean
}

type SnapshotMedia = {
  id: string
  name: string
  mediaKind: 'image' | 'video'
  isGif: boolean
  sourceDataUrl?: string
  sourceUrl?: string
}

type SnapshotMediaNode = Pick<BoardImage, 'id' | 'paused' | 'x' | 'y' | 'width' | 'aspect' | 'z'> & {
  kind: 'media'
  mediaIds: string[]
  activeMediaIndex: number
  slideshowPlaying?: boolean
}

type SnapshotNoteNode = Pick<BoardImage, 'id' | 'x' | 'y' | 'width' | 'aspect' | 'z'> & {
  kind: 'note'
  name: string
  noteMarkdown: string
  noteMode: 'editing' | 'viewing'
}

type SnapshotNode = SnapshotMediaNode | SnapshotNoteNode

type BoardSnapshotV4 = {
  version: 4
  createdAt: string
  media: Record<string, SnapshotMedia>
  nodes: SnapshotNode[]
  groups: PersistedGroup[]
  darkMode: boolean
}

type MediaTimeline = {
  current: number
  duration: number
}

type ItemRect = {
  left: number
  top: number
  right: number
  bottom: number
}

type GroupBounds = {
  left: number
  top: number
  width: number
  height: number
}

type GroupOverlayState = {
  bounds: GroupBounds
  active: boolean
}

type PersistedGroup = {
  id: number
  memberIds: number[]
}

type DragState = {
  kind: 'move'
  id: number
  offsetX: number
  offsetY: number
}

type ResizeState = {
  kind: 'resize'
  id: number
  startWidth: number
  startPointerX: number
}

type GroupMoveState = {
  kind: 'move-group'
  ids: number[]
  startPointerX: number
  startPointerY: number
  startPositions: Record<number, { x: number; y: number }>
}

type GroupResizeState = {
  kind: 'resize-group'
  ids: number[]
  startPointerX: number
  startBounds: GroupBounds
  startItems: Record<number, { x: number; y: number; width: number }>
  minScale: number
}

type InteractionState = DragState | ResizeState | GroupMoveState | GroupResizeState
type ScaleModeState = {
  ids: number[]
  centerX: number
  centerY: number
  startDistance: number
  previewScale: number
  minScale: number
  startItems: Record<number, { x: number; y: number; width: number }>
}
type MoveModeState = {
  ids: number[]
  startPointerX: number
  startPointerY: number
  offsetX: number
  offsetY: number
  startItems: Record<number, { x: number; y: number; width: number }>
}

type PanState = {
  startClientX: number
  startClientY: number
  startScrollLeft: number
  startScrollTop: number
}

type MarqueeState = {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

const START_X = 100
const START_Y = 100
const IMAGE_WIDTH = 280
const MIN_IMAGE_WIDTH = 80
const NOTE_DEFAULT_ASPECT = 0.7
const WORLD_SIZE = 120000
const WORLD_ORIGIN = WORLD_SIZE / 2
const CAPTION_HEIGHT = 22
const CARD_BORDER_HEIGHT = 2

const getItemHeight = (item: BoardImage) => item.width * item.aspect + CAPTION_HEIGHT + CARD_BORDER_HEIGHT
const getItemRect = (item: BoardImage): ItemRect => ({
  left: item.x,
  top: item.y,
  right: item.x + item.width,
  bottom: item.y + getItemHeight(item),
})

const getGroupBounds = (ids: number[], images: BoardImage[]): GroupBounds | null => {
  const selected = images.filter((item) => ids.includes(item.id))
  if (selected.length === 0) {
    return null
  }

  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  for (const item of selected) {
    const rect = getItemRect(item)
    left = Math.min(left, rect.left)
    top = Math.min(top, rect.top)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  }
}

const hasSameMembers = (a: number[], b: number[]) => {
  if (a.length !== b.length) {
    return false
  }

  const bSet = new Set(b)
  return a.every((id) => bSet.has(id))
}

const fileToDataUrl = (file: File) =>
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

const normalizeHttpUrl = (raw: string) => {
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

const extractDropSourceUrls = (dataTransfer: DataTransfer) => {
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

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const renderInlineMarkdown = (value: string) => {
  let html = escapeHtml(value)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return html
}

const renderMarkdownToHtml = (markdown: string) => {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n')
  const output: string[] = []
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      if (inList) {
        output.push('</ul>')
        inList = false
      }
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      if (inList) {
        output.push('</ul>')
        inList = false
      }
      const level = heading[1].length
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const listItem = trimmed.match(/^-\s+(.*)$/)
    if (listItem) {
      if (!inList) {
        output.push('<ul>')
        inList = true
      }
      output.push(`<li>${renderInlineMarkdown(listItem[1])}</li>`)
      continue
    }

    if (inList) {
      output.push('</ul>')
      inList = false
    }

    output.push(`<p>${renderInlineMarkdown(trimmed)}</p>`)
  }

  if (inList) {
    output.push('</ul>')
  }

  return output.join('')
}

const getActiveMediaItem = (item: BoardImage) => {
  const mediaItems = item.mediaItems
  if (!mediaItems || mediaItems.length === 0) {
    return null
  }

  const index = Math.max(0, Math.min(item.activeMediaIndex ?? 0, mediaItems.length - 1))
  return { index, media: mediaItems[index] }
}

const applyActiveMediaFromItems = (item: BoardImage): BoardImage => {
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

function App() {
  const [images, setImages] = useState<BoardImage[]>([])
  const [darkMode, setDarkMode] = useState(false)
  const [interaction, setInteraction] = useState<InteractionState | null>(null)
  const [scaleMode, setScaleMode] = useState<ScaleModeState | null>(null)
  const [moveMode, setMoveMode] = useState<MoveModeState | null>(null)
  const [pan, setPan] = useState<PanState | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [seekPanelId, setSeekPanelId] = useState<number | null>(null)
  const [videoTimelines, setVideoTimelines] = useState<Record<number, MediaTimeline>>({})
  const [gifFrameCounts, setGifFrameCounts] = useState<Record<number, number>>({})
  const [gifSeekFrames, setGifSeekFrames] = useState<Record<number, number>>({})
  const [brokenMediaIds, setBrokenMediaIds] = useState<Record<number, true>>({})
  const [groups, setGroups] = useState<PersistedGroup[]>([])
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [groupOverlay, setGroupOverlay] = useState<GroupOverlayState | null>(null)
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const boardWrapRef = useRef<HTMLDivElement | null>(null)
  const nextIdRef = useRef(1)
  const nextGroupIdRef = useRef(1)
  const nextZRef = useRef(1)
  const gifDecoderCacheRef = useRef<Record<number, { decoder: any; frameCount: number }>>({})
  const groupFadeTimeoutRef = useRef<number | null>(null)
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({})
  const pendingVideoSeekRef = useRef<Record<number, number>>({})
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const keyStateRef = useRef({ shift: false })
  const slideshowTimersRef = useRef<Record<number, number>>({})

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const persistentGroupViews = useMemo(
    () =>
      groups
        .map((group) => {
          const bounds = getGroupBounds(group.memberIds, images)
          return bounds
            ? {
                id: group.id,
                memberIds: group.memberIds,
                bounds,
              }
            : null
        })
        .filter((value): value is { id: number; memberIds: number[]; bounds: GroupBounds } => value !== null),
    [groups, images],
  )

  useEffect(() => {
    return () => {
      for (const entry of Object.values(gifDecoderCacheRef.current)) {
        if (entry?.decoder && typeof entry.decoder.close === 'function') {
          entry.decoder.close()
        }
      }
      if (groupFadeTimeoutRef.current !== null) {
        window.clearTimeout(groupFadeTimeoutRef.current)
      }
      for (const timer of Object.values(slideshowTimersRef.current)) {
        window.clearInterval(timer)
      }
      slideshowTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    for (const item of images) {
      if (item.mediaKind !== 'video') {
        continue
      }

      const video = videoRefs.current[item.id]
      if (!video) {
        continue
      }

      if (item.paused) {
        video.pause()
        continue
      }

      void video.play().catch(() => {
        // Keep state as source of truth; browser may block play in rare cases.
      })
    }
  }, [images])

  const applyScaleMode = () => {
    if (!scaleMode) {
      return
    }

    setImages((current) =>
      current.map((item) => {
        if (!scaleMode.ids.includes(item.id)) {
          return item
        }

        const start = scaleMode.startItems[item.id]
        if (!start) {
          return item
        }

        return {
          ...item,
          x: scaleMode.centerX + (start.x - scaleMode.centerX) * scaleMode.previewScale,
          y: scaleMode.centerY + (start.y - scaleMode.centerY) * scaleMode.previewScale,
          width: Math.max(MIN_IMAGE_WIDTH, start.width * scaleMode.previewScale),
        }
      }),
    )

    setScaleMode(null)
  }

  const applyMoveMode = () => {
    if (!moveMode) {
      return
    }

    setImages((current) =>
      current.map((item) => {
        if (!moveMode.ids.includes(item.id)) {
          return item
        }

        const start = moveMode.startItems[item.id]
        if (!start) {
          return item
        }

        return {
          ...item,
          x: start.x + moveMode.offsetX,
          y: start.y + moveMode.offsetY,
        }
      }),
    )

    setMoveMode(null)
  }

  const applyTransformMode = () => {
    if (scaleMode) {
      applyScaleMode()
      return
    }

    if (moveMode) {
      applyMoveMode()
    }
  }

  useEffect(() => {
    if (seekPanelId !== null && !images.some((item) => item.id === seekPanelId)) {
      setSeekPanelId(null)
    }
  }, [images, seekPanelId])

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('pureref-lite-theme')
    if (savedTheme === 'dark') {
      setDarkMode(true)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('pureref-lite-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const imageIdSet = new Set(images.map((item) => item.id))
    setGroups((current) => {
      let changed = false
      const next = current
        .map((group) => {
          const memberIds = group.memberIds.filter((id) => imageIdSet.has(id))
          if (memberIds.length !== group.memberIds.length) {
            changed = true
          }
          return { ...group, memberIds }
        })
        .filter((group) => {
          if (group.memberIds.length > 1) {
            return true
          }
          changed = true
          return false
        })

      return changed ? next : current
    })
  }, [images])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        keyStateRef.current.shift = true
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        keyStateRef.current.shift = false
      }
    }
    const onBlur = () => {
      keyStateRef.current.shift = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    const validIds = new Set(images.map((item) => item.id))
    setBrokenMediaIds((current) => {
      let changed = false
      const next: Record<number, true> = {}
      for (const key of Object.keys(current)) {
        const id = Number(key)
        if (validIds.has(id)) {
          next[id] = true
        } else {
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [images])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditorFocused) {
        return
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'g' && selectedIds.length > 1) {
        event.preventDefault()

        const memberIds = selectedIds.filter((id) => images.some((item) => item.id === id))
        if (memberIds.length < 2) {
          return
        }

        setGroups((current) => {
          const selectedSet = new Set(memberIds)
          const nextGroups = current.filter((group) => !group.memberIds.every((id) => selectedSet.has(id)))

          const alreadyExists = nextGroups.some((group) => hasSameMembers(group.memberIds, memberIds))
          if (alreadyExists) {
            return nextGroups
          }

          return [
            ...nextGroups,
            {
              id: nextGroupIdRef.current++,
              memberIds,
            },
          ]
        })
        return
      }

      const slideshowPrev = event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A'
      const slideshowNext = event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D'
      if (!event.ctrlKey && !event.altKey && !event.metaKey && (slideshowPrev || slideshowNext)) {
        if (selectedIds.length !== 1) {
          return
        }

        const activeNode = images.find((item) => item.id === selectedIds[0])
        if (!activeNode || !activeNode.mediaItems || activeNode.mediaItems.length < 2) {
          return
        }

        event.preventDefault()
        const direction: 1 | -1 = slideshowNext ? 1 : -1
        advanceMediaForNodeIds([activeNode.id], direction)
        return
      }

      const isLayoutShortcut = event.key.toLowerCase() === 'l'
      const isAlignShortcut =
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight'

      if (event.key === ' ' || event.code === 'Space') {
        const activeIds =
          selectedIds.length > 0 ? selectedIds : selectedId !== null ? [selectedId] : []
        if (activeIds.length === 0) {
          return
        }

        event.preventDefault()
        setImages((current) => {
          const selectedMedia = current.filter(
            (item) => activeIds.includes(item.id) && (item.mediaKind === 'video' || item.isGif),
          )
          if (selectedMedia.length === 0) {
            return current
          }

          const shouldPause = selectedMedia.some((item) => !item.paused)
          return current.map((item) =>
            activeIds.includes(item.id) && (item.mediaKind === 'video' || item.isGif)
              ? {
                  ...item,
                  paused: shouldPause,
                }
              : item,
          )
        })
        return
      }

      if (event.key === 'Escape' && (scaleMode || moveMode)) {
        event.preventDefault()
        setScaleMode(null)
        setMoveMode(null)
        return
      }

      if ((event.key === 's' || event.key === 'S') && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault()

        if (scaleMode) {
          setScaleMode(null)
          return
        }

        if (moveMode) {
          setMoveMode(null)
        }

        const activeIds = selectedIds.length > 0 ? selectedIds : selectedId !== null ? [selectedId] : []
        if (activeIds.length === 0) {
          return
        }

        const selected = images.filter((item) => activeIds.includes(item.id))
        if (selected.length === 0) {
          return
        }

        const startItems: Record<number, { x: number; y: number; width: number }> = {}
        let minScale = Number.POSITIVE_INFINITY
        for (const item of selected) {
          startItems[item.id] = { x: item.x, y: item.y, width: item.width }
          minScale = Math.min(minScale, MIN_IMAGE_WIDTH / item.width)
        }

        let centerX = 0
        let centerY = 0
        if (selected.length === 1) {
          const item = selected[0]
          centerX = item.x + item.width / 2
          centerY = item.y + getItemHeight(item) / 2
        } else {
          const bounds = getGroupBounds(activeIds, images)
          if (!bounds) {
            return
          }
          centerX = bounds.left + bounds.width / 2
          centerY = bounds.top + bounds.height / 2
        }

        const pointer = lastPointerRef.current
        const distance = Math.max(1, Math.hypot(pointer.x - centerX, pointer.y - centerY))
        setScaleMode({
          ids: selected.map((item) => item.id),
          centerX,
          centerY,
          startDistance: distance,
          previewScale: 1,
          minScale: Number.isFinite(minScale) ? minScale : 0.1,
          startItems,
        })
        return
      }

      if ((event.key === 'g' || event.key === 'G') && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault()

        if (moveMode) {
          setMoveMode(null)
          return
        }

        if (scaleMode) {
          setScaleMode(null)
        }

        const activeIds = selectedIds.length > 0 ? selectedIds : selectedId !== null ? [selectedId] : []
        if (activeIds.length === 0) {
          return
        }

        const selected = images.filter((item) => activeIds.includes(item.id))
        if (selected.length === 0) {
          return
        }

        const pointer = lastPointerRef.current
        const startItems: Record<number, { x: number; y: number; width: number }> = {}
        for (const item of selected) {
          startItems[item.id] = { x: item.x, y: item.y, width: item.width }
        }

        setMoveMode({
          ids: selected.map((item) => item.id),
          startPointerX: pointer.x,
          startPointerY: pointer.y,
          offsetX: 0,
          offsetY: 0,
          startItems,
        })
        return
      }

      if (event.key === '`' || event.code === 'Backquote') {
        const activeId = selectedId
        if (activeId === null) {
          return
        }

        const selectedMedia = images.find((item) => item.id === activeId)
        if (!selectedMedia || (selectedMedia.mediaKind !== 'video' && !selectedMedia.isGif)) {
          return
        }

        event.preventDefault()
        if (selectedMedia.isGif) {
          void ensureGifDecoder(selectedMedia)
        }
        setSeekPanelId((current) => (current === activeId ? null : activeId))
      }

      if (event.ctrlKey && selectedIds.length > 1 && (isAlignShortcut || isLayoutShortcut)) {
        event.preventDefault()

        setImages((current) => {
          const selected = current.filter((item) => selectedIds.includes(item.id))
          if (selected.length < 2) {
            return current
          }

          if (event.key === 'ArrowUp') {
            const topY = Math.min(...selected.map((item) => item.y))
            return current.map((item) =>
              selectedIds.includes(item.id)
                ? {
                    ...item,
                    y: topY,
                  }
                : item,
            )
          }

          if (event.key === 'ArrowDown') {
            const bottomY = Math.max(...selected.map((item) => item.y + getItemHeight(item)))
            return current.map((item) => {
              if (!selectedIds.includes(item.id)) {
                return item
              }

              return {
                ...item,
                y: bottomY - getItemHeight(item),
              }
            })
          }

          if (event.key === 'ArrowLeft') {
            const leftX = Math.min(...selected.map((item) => item.x))
            return current.map((item) =>
              selectedIds.includes(item.id)
                ? {
                    ...item,
                    x: leftX,
                  }
                : item,
            )
          }

          if (event.key === 'ArrowRight') {
            const rightX = Math.max(...selected.map((item) => item.x + item.width))
            return current.map((item) =>
              selectedIds.includes(item.id)
                ? {
                    ...item,
                    x: rightX - item.width,
                  }
                : item,
            )
          }

          if (isLayoutShortcut) {
            const ordered = [...selected].sort((a, b) => a.y - b.y || a.x - b.x)
            const cols = Math.ceil(Math.sqrt(ordered.length))
            const gap = 24
            const anchorX = Math.min(...ordered.map((item) => item.x))
            const anchorY = Math.min(...ordered.map((item) => item.y))
            const positions = new Map<number, { x: number; y: number }>()

            let currentX = anchorX
            let currentY = anchorY
            let rowHeight = 0
            let col = 0

            for (const item of ordered) {
              if (col >= cols) {
                currentY += rowHeight + gap
                currentX = anchorX
                rowHeight = 0
                col = 0
              }

              positions.set(item.id, { x: currentX, y: currentY })
              currentX += item.width + gap
              rowHeight = Math.max(rowHeight, getItemHeight(item))
              col += 1
            }

            return current.map((item) => {
              if (!selectedIds.includes(item.id)) {
                return item
              }

              const nextPosition = positions.get(item.id)
              if (!nextPosition) {
                return item
              }

              return {
                ...item,
                x: nextPosition.x,
                y: nextPosition.y,
              }
            })
          }

          return current
        })
        return
      }

      if (event.key === 'x' || event.key === 'X') {
        const deleteIds = selectedIds.length > 1 ? selectedIds : selectedId !== null ? [selectedId] : []
        if (deleteIds.length === 0) {
          return
        }

        setImages((current) => current.filter((item) => !deleteIds.includes(item.id)))
        setInteraction((current) => {
          if (!current) {
            return current
          }

          if (current.kind === 'move' || current.kind === 'resize') {
            return deleteIds.includes(current.id) ? null : current
          }

          return current.ids.some((id) => deleteIds.includes(id)) ? null : current
        })

        setSelectedIds([])
        setSelectedId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [images, isEditorFocused, moveMode, scaleMode, selectedId, selectedIds])

  useEffect(() => {
    const shouldPlay = new Set(
      images
        .filter((item) => item.mediaKind !== 'note' && (item.mediaItems?.length ?? 0) > 1 && item.slideshowPlaying)
        .map((item) => item.id),
    )

    for (const [idString, timer] of Object.entries(slideshowTimersRef.current)) {
      const id = Number(idString)
      if (!shouldPlay.has(id)) {
        window.clearInterval(timer)
        delete slideshowTimersRef.current[id]
      }
    }

    for (const id of shouldPlay) {
      if (slideshowTimersRef.current[id] !== undefined) {
        continue
      }

      slideshowTimersRef.current[id] = window.setInterval(() => {
        advanceMediaForNodeIds([id], 1)
      }, 10000)
    }
  }, [images])

  useEffect(() => {
    const wrapper = boardWrapRef.current
    if (!wrapper) {
      return
    }

    wrapper.scrollTo({
      left: WORLD_ORIGIN - wrapper.clientWidth / 2,
      top: WORLD_ORIGIN - wrapper.clientHeight / 2,
      behavior: 'auto',
    })
  }, [])

  useEffect(() => {
    const activeGroupIds = selectedIds.filter((id) => images.some((item) => item.id === id))
    const selectionAlreadyPersisted = groups.some((group) => hasSameMembers(group.memberIds, activeGroupIds))
    if (activeGroupIds.length > 1 && !selectionAlreadyPersisted) {
      const bounds = getGroupBounds(activeGroupIds, images)
      if (!bounds) {
        return
      }

      if (groupFadeTimeoutRef.current !== null) {
        window.clearTimeout(groupFadeTimeoutRef.current)
        groupFadeTimeoutRef.current = null
      }

      setGroupOverlay({ bounds, active: true })
      return
    }

    setGroupOverlay((current) => {
      if (!current || !current.active) {
        return current
      }

      if (groupFadeTimeoutRef.current !== null) {
        window.clearTimeout(groupFadeTimeoutRef.current)
      }

      groupFadeTimeoutRef.current = window.setTimeout(() => {
        setGroupOverlay(null)
        groupFadeTimeoutRef.current = null
      }, 180)

      return { ...current, active: false }
    })
  }, [selectedIds, images, groups])

  const getBoardPointer = (event: ReactPointerEvent) => {
    return getBoardPointFromClient(event.clientX, event.clientY)
  }

  const getBoardPointFromClient = (clientX: number, clientY: number) => {
    const wrapper = boardWrapRef.current
    if (!wrapper) {
      return null
    }

    const wrapperRect = wrapper.getBoundingClientRect()
    return {
      x: clientX - wrapperRect.left + wrapper.scrollLeft - WORLD_ORIGIN,
      y: clientY - wrapperRect.top + wrapper.scrollTop - WORLD_ORIGIN,
    }
  }

  const handleFiles = async (fileList: FileList | null, anchor?: { x: number; y: number }, sourceUrls?: string[]) => {
    if (!fileList || fileList.length === 0) {
      return
    }

    const files = Array.from(fileList).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    )
    if (files.length === 0) {
      return
    }

    const prepared = await Promise.all(
      files.map(async (file, index): Promise<PreparedMedia & { sourceUrl?: string }> => {
      const dataUrl = await fileToDataUrl(file)
      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
      const sourceUrl =
        sourceUrls && sourceUrls.length > 0 ? sourceUrls[Math.min(index, sourceUrls.length - 1)] : undefined
      return {
        id: nextIdRef.current++,
        src: dataUrl,
        sourceDataUrl: dataUrl,
        sourceUrl,
        name: file.name,
        mediaKind: file.type.startsWith('video/') ? 'video' : 'image',
        isGif,
        paused: false,
        z: nextZRef.current++,
      }
      }),
    )

    setImages((current) => {
      const cols = 5
      const nextImages = prepared.map((item, i) => {
        const row = Math.floor(i / cols)
        const col = i % cols
        const x = anchor
          ? anchor.x - IMAGE_WIDTH / 2 + col * (IMAGE_WIDTH + 30)
          : START_X + ((current.length + i) % cols) * (IMAGE_WIDTH + 30)
        const y = anchor ? anchor.y + row * 220 : START_Y + Math.floor((current.length + i) / cols) * 220

        return {
          id: item.id,
          src: item.src,
          sourceDataUrl: item.sourceDataUrl,
          sourceUrl: item.sourceUrl,
          name: item.name,
          mediaKind: item.mediaKind,
          isGif: item.isGif,
          paused: item.paused,
          slideshowPlaying: false,
          x,
          y,
          width: IMAGE_WIDTH,
          aspect: 1,
          z: item.z,
        }
      })

      return [...current, ...nextImages]
    })

    if (prepared.length > 1) {
      const newIds = prepared.map((item) => item.id)
      setSelectedIds(newIds)
      setSelectedId(newIds[newIds.length - 1])
    }
  }

  const createMediaItemFromFile = async (file: File, sourceUrl?: string): Promise<NodeMediaItem | null> => {
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

  const replaceNodeWithFile = async (nodeId: number, file: File, sourceUrl?: string) => {
    const mediaItem = await createMediaItemFromFile(file, sourceUrl)
    if (!mediaItem) {
      return
    }

    setImages((current) =>
      current.map((item) => {
        if (item.id !== nodeId) {
          return item
        }

        if (item.mediaItems && item.mediaItems.length > 1) {
          const activeIndex = Math.max(0, Math.min(item.activeMediaIndex ?? 0, item.mediaItems.length - 1))
          const nextMediaItems = item.mediaItems.map((existing, index) => (index === activeIndex ? mediaItem : existing))
          const next = applyActiveMediaFromItems({
            ...item,
            mediaItems: nextMediaItems,
            activeMediaIndex: activeIndex,
            paused: false,
            gifFreezeSrc: undefined,
          })

          return {
            ...next,
            // Preserve slideshow frame ratio for stacked media nodes.
            aspect: item.aspect,
          }
        }

        return {
          ...item,
          src: mediaItem.src,
          sourceDataUrl: mediaItem.sourceDataUrl,
          sourceUrl: mediaItem.sourceUrl,
          name: mediaItem.name,
          mediaKind: mediaItem.mediaKind,
          isGif: mediaItem.isGif,
          paused: false,
          gifFreezeSrc: undefined,
          mediaItems: [mediaItem],
          activeMediaIndex: 0,
          slideshowPlaying: false,
          noteMarkdown: undefined,
          noteMode: undefined,
          aspect: 1,
        }
      }),
    )

    setVideoTimelines((current) => {
      const next = { ...current }
      delete next[nodeId]
      return next
    })
    setGifFrameCounts((current) => {
      const next = { ...current }
      delete next[nodeId]
      return next
    })
    setGifSeekFrames((current) => {
      const next = { ...current }
      delete next[nodeId]
      return next
    })
    setBrokenMediaIds((current) => {
      if (!current[nodeId]) {
        return current
      }
      const next = { ...current }
      delete next[nodeId]
      return next
    })
    setSeekPanelId((current) => (current === nodeId ? null : current))
  }

  const appendMediaToNode = async (nodeId: number, files: File[], sourceUrls: string[]) => {
    const additions = (
      await Promise.all(
        files.map((file, index) => createMediaItemFromFile(file, sourceUrls[Math.min(index, sourceUrls.length - 1)])),
      )
    ).filter((item): item is NodeMediaItem => item !== null)

    if (additions.length === 0) {
      return
    }

    setImages((current) =>
      current.map((item) => {
        if (item.id !== nodeId || item.mediaKind === 'note') {
          return item
        }

        const baseItems =
          item.mediaItems && item.mediaItems.length > 0
            ? item.mediaItems
            : [
                {
                  src: item.src,
                  sourceDataUrl: item.sourceDataUrl,
                  sourceUrl: item.sourceUrl,
                  name: item.name,
                  mediaKind: item.mediaKind,
                  isGif: item.isGif,
                },
              ]

        const nextItems = [...baseItems, ...additions]
        const next = applyActiveMediaFromItems({
          ...item,
          mediaItems: nextItems,
          activeMediaIndex: Math.max(0, Math.min(item.activeMediaIndex ?? 0, nextItems.length - 1)),
          slideshowPlaying: item.slideshowPlaying ?? false,
        })

        return {
          ...next,
          // Preserve first media aspect and only switch content.
          aspect: item.aspect,
        }
      }),
    )
  }

  const fallbackNodeMediaToEmbeddedData = (nodeId: number) => {
    setImages((current) =>
      current.map((item) => {
        if (item.id !== nodeId || !item.sourceDataUrl) {
          return item
        }

        if (item.sourceUrl && item.src === item.sourceUrl && item.sourceDataUrl !== item.src) {
          const fallbackSrc = item.sourceDataUrl
          if (item.mediaItems && item.mediaItems.length > 0) {
            const index = Math.max(0, Math.min(item.activeMediaIndex ?? 0, item.mediaItems.length - 1))
            const nextMediaItems = item.mediaItems.map((mediaItem, mediaIndex) =>
              mediaIndex === index
                ? {
                    ...mediaItem,
                    src: fallbackSrc,
                  }
                : mediaItem,
            )
            return {
              ...item,
              src: fallbackSrc,
              mediaItems: nextMediaItems,
            }
          }

          return {
            ...item,
            src: fallbackSrc,
          }
        }

        return item
      }),
    )
  }

  const advanceMediaForNodeIds = (nodeIds: number[], direction: 1 | -1) => {
    if (nodeIds.length === 0) {
      return
    }

    const nodeIdSet = new Set(nodeIds)
    setImages((current) =>
      current.map((item) => {
        if (!nodeIdSet.has(item.id) || !item.mediaItems || item.mediaItems.length < 2) {
          return item
        }

        const nextIndex =
          (Math.max(0, Math.min(item.activeMediaIndex ?? 0, item.mediaItems.length - 1)) +
            direction +
            item.mediaItems.length) %
          item.mediaItems.length

        const next = applyActiveMediaFromItems({
          ...item,
          activeMediaIndex: nextIndex,
          paused: false,
          gifFreezeSrc: undefined,
        })

        return {
          ...next,
          aspect: item.aspect,
        }
      }),
    )

    setBrokenMediaIds((current) => {
      let changed = false
      const next = { ...current }
      for (const id of nodeIds) {
        if (next[id]) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : current
    })

    setSeekPanelId((current) => (current !== null && nodeIdSet.has(current) ? null : current))
  }

  const handleBoardDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()

    const droppedFiles = Array.from(event.dataTransfer.files).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    )
    if (droppedFiles.length === 0) {
      return
    }

    const point = getBoardPointFromClient(event.clientX, event.clientY)
    const sourceUrls = extractDropSourceUrls(event.dataTransfer)
    const sourceUrl = sourceUrls.length > 0 ? sourceUrls[0] : undefined

    const shouldAppendToNode = event.shiftKey || keyStateRef.current.shift

    if (point) {
      const targetNode = [...images]
        .filter((item) => item.mediaKind !== 'note')
        .sort((a, b) => b.z - a.z)
        .find((item) => {
          const rect = getItemRect(item)
          return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
        })

      if (targetNode) {
        if (shouldAppendToNode) {
          void appendMediaToNode(targetNode.id, droppedFiles, sourceUrls)
          return
        }
        void replaceNodeWithFile(targetNode.id, droppedFiles[0], sourceUrl)
        return
      }
    }

    void handleFiles(event.dataTransfer.files, point ?? undefined, sourceUrls)
  }

  const addNote = () => {
    const noteId = nextIdRef.current++
    const noteName = `Note ${images.filter((item) => item.mediaKind === 'note').length + 1}`

    const nextNote: BoardImage = {
      id: noteId,
      src: '',
      sourceDataUrl: '',
      name: noteName,
      mediaKind: 'note',
      isGif: false,
      paused: false,
      noteMarkdown: '# Note\n\n- Add your notes here',
      noteMode: 'editing',
      x: START_X,
      y: START_Y,
      width: IMAGE_WIDTH,
      aspect: NOTE_DEFAULT_ASPECT,
      z: nextZRef.current++,
    }

    setImages((current) => [...current, nextNote])
    setSelectedId(noteId)
    setSelectedIds([noteId])
  }

  const saveVersion = () => {
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

      const mediaIds: string[] = mediaItems.map((mediaItem) => {
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

    const snapshot: BoardSnapshotV4 = {
      version: 4,
      createdAt: new Date().toISOString(),
      media,
      nodes,
      groups: groups.map((group) => ({ id: group.id, memberIds: [...group.memberIds] })),
      darkMode,
    }

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `pureref-lite-${snapshot.createdAt.replaceAll(':', '-')}.json`
    link.click()
    URL.revokeObjectURL(href)
  }

  const loadVersion = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Partial<BoardSnapshotV4>
      if (!parsed || parsed.version !== 4 || !parsed.media || !Array.isArray(parsed.nodes)) {
        throw new Error('Unsupported snapshot format')
      }

      const mediaMap = parsed.media as Record<string, Partial<SnapshotMedia>>
      const loadedImages: BoardImage[] = parsed.nodes
        .map((node) => {
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
              noteMode: node.noteMode === 'editing' ? 'editing' : 'viewing',
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

          const nextImage: BoardImage = {
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

          return nextImage
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

      setImages(loadedImages)
      setGroups(loadedGroups)
      setDarkMode(Boolean(parsed.darkMode))
      setSelectedId(null)
      setSelectedIds([])
      setSeekPanelId(null)
      setScaleMode(null)
      setMoveMode(null)
      setInteraction(null)
      setGroupOverlay(null)
      setPan(null)
      setMarquee(null)
      setVideoTimelines({})
      setGifFrameCounts({})
      setGifSeekFrames({})
      setBrokenMediaIds({})

      const maxImageId = loadedImages.reduce((max, item) => Math.max(max, item.id), 0)
      const maxZ = loadedImages.reduce((max, item) => Math.max(max, item.z), 0)
      const maxGroupId = loadedGroups.reduce((max, group) => Math.max(max, group.id), 0)
      nextIdRef.current = maxImageId + 1
      nextZRef.current = maxZ + 1
      nextGroupIdRef.current = maxGroupId + 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load snapshot'
      window.alert(`Unable to load version: ${message}`)
    }
  }

  const bringToFront = (id: number) => {
    setImages((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              z: nextZRef.current++,
            }
          : item,
      ),
    )
  }

  const onPointerDown = (event: ReactPointerEvent, id: number) => {
    if (event.button === 0 && (scaleMode || moveMode)) {
      event.preventDefault()
      event.stopPropagation()
      applyTransformMode()
      return
    }

    if (event.button !== 0) {
      return
    }

    const point = getBoardPointer(event)
    if (!point) {
      return
    }

    const targetImage = images.find((img) => img.id === id)
    if (!targetImage) {
      return
    }

    if (event.ctrlKey) {
      event.preventDefault()
      if (selectedSet.has(id)) {
        const next = selectedIds.filter((selectedNodeId) => selectedNodeId !== id)
        setSelectedIds(next)
        if (selectedId === id) {
          setSelectedId(next.length > 0 ? next[next.length - 1] : null)
        }
        return
      }

      setSelectedIds([...selectedIds, id])
      setSelectedId(id)
      return
    }

    if (event.altKey) {
      const duplicateId = nextIdRef.current++
      const duplicateZ = nextZRef.current++
      const sourceVideo = targetImage.mediaKind === 'video' ? videoRefs.current[id] : null
      const sourceVideoTime = sourceVideo ? sourceVideo.currentTime : null
      const sourceVideoDuration =
        sourceVideo && Number.isFinite(sourceVideo.duration) ? sourceVideo.duration : videoTimelines[id]?.duration ?? 0
      const sourceGifFrame = targetImage.isGif ? gifSeekFrames[id] ?? 0 : 0

      setImages((current) => {
        const source = current.find((item) => item.id === id)
        if (!source) {
          return current
        }

        return [
          ...current,
          {
            ...source,
            id: duplicateId,
            z: duplicateZ,
          },
        ]
      })

      if (sourceVideoTime !== null) {
        pendingVideoSeekRef.current[duplicateId] = sourceVideoTime
        setVideoTimelines((current) => ({
          ...current,
          [duplicateId]: {
            current: sourceVideoTime,
            duration: sourceVideoDuration,
          },
        }))
      }

      if (targetImage.isGif) {
        setGifSeekFrames((current) => ({
          ...current,
          [duplicateId]: sourceGifFrame,
        }))
      }

      setInteraction({
        kind: 'move',
        id: duplicateId,
        offsetX: point.x - targetImage.x,
        offsetY: point.y - targetImage.y,
      })
      setSelectedId(duplicateId)
      setSelectedIds([duplicateId])

      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      return
    }

    if (selectedIds.length > 1 && selectedSet.has(id)) {
      const activeIds = selectedIds.filter((selected) => images.some((item) => item.id === selected))
      const startPositions: Record<number, { x: number; y: number }> = {}
      for (const item of images) {
        if (activeIds.includes(item.id)) {
          startPositions[item.id] = { x: item.x, y: item.y }
        }
      }

      setSelectedId(id)
      setInteraction({
        kind: 'move-group',
        ids: activeIds,
        startPointerX: point.x,
        startPointerY: point.y,
        startPositions,
      })

      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      return
    }

    bringToFront(id)
    setSelectedId(id)
    setSelectedIds([id])

    setInteraction({
      kind: 'move',
      id,
      offsetX: point.x - targetImage.x,
      offsetY: point.y - targetImage.y,
    })

    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const onResizePointerDown = (event: ReactPointerEvent, id: number) => {
    if (event.button === 0 && (scaleMode || moveMode)) {
      event.preventDefault()
      event.stopPropagation()
      applyTransformMode()
      return
    }

    if (event.button !== 0) {
      return
    }

    event.stopPropagation()

    const point = getBoardPointer(event)
    if (!point) {
      return
    }

    const targetImage = images.find((img) => img.id === id)
    if (!targetImage) {
      return
    }

    bringToFront(id)
    setSelectedId(id)
    setSelectedIds([id])

    setInteraction({
      kind: 'resize',
      id,
      startWidth: targetImage.width,
      startPointerX: point.x,
    })

    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const ensureGifDecoder = async (item: BoardImage) => {
    const cached = gifDecoderCacheRef.current[item.id]
    if (cached) {
      return cached
    }

    const DecoderCtor = (window as any).ImageDecoder
    if (!DecoderCtor) {
      return null
    }

    try {
      const response = await fetch(item.src)
      const blob = await response.blob()
      const decoder = new DecoderCtor({ data: blob, type: 'image/gif' })
      if (decoder.tracks?.ready) {
        await decoder.tracks.ready
      }

      const frameCount = decoder.tracks?.selectedTrack?.frameCount ?? decoder.frameCount ?? 1
      const result = { decoder, frameCount: Math.max(1, frameCount) }
      gifDecoderCacheRef.current[item.id] = result
      setGifFrameCounts((current) => ({ ...current, [item.id]: result.frameCount }))
      return result
    } catch {
      return null
    }
  }

  const decodeGifFrameToDataUrl = async (item: BoardImage, frameIndex: number) => {
    const decoderInfo = await ensureGifDecoder(item)
    if (!decoderInfo) {
      return null
    }

    try {
      const clampedIndex = Math.max(0, Math.min(frameIndex, decoderInfo.frameCount - 1))
      const result = await decoderInfo.decoder.decode({ frameIndex: clampedIndex })
      const frame = result.image

      const width = frame.displayWidth || frame.codedWidth
      const height = frame.displayHeight || frame.codedHeight
      if (!width || !height) {
        if (typeof frame.close === 'function') {
          frame.close()
        }
        return null
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        if (typeof frame.close === 'function') {
          frame.close()
        }
        return null
      }

      ctx.drawImage(frame as CanvasImageSource, 0, 0)
      if (typeof frame.close === 'function') {
        frame.close()
      }

      return canvas.toDataURL('image/png')
    } catch {
      return null
    }
  }

  const onGifSeek = async (item: BoardImage, nextFrame: number) => {
    setGifSeekFrames((current) => ({ ...current, [item.id]: nextFrame }))
    const frameDataUrl = await decodeGifFrameToDataUrl(item, nextFrame)
    if (!frameDataUrl) {
      return
    }

    setImages((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? {
              ...candidate,
              paused: true,
              gifFreezeSrc: frameDataUrl,
            }
          : candidate,
      ),
    )
  }

  const startGroupMove = (event: ReactPointerEvent, ids: number[]) => {
    if (event.button === 0 && (scaleMode || moveMode)) {
      event.preventDefault()
      event.stopPropagation()
      applyTransformMode()
      return
    }

    if (event.button !== 0 || ids.length < 2) {
      return
    }

    event.stopPropagation()

    const point = getBoardPointer(event)
    if (!point) {
      return
    }

    const activeIds = ids.filter((id) => images.some((item) => item.id === id))
    if (activeIds.length < 2) {
      return
    }

    const startPositions: Record<number, { x: number; y: number }> = {}
    for (const item of images) {
      if (activeIds.includes(item.id)) {
        startPositions[item.id] = { x: item.x, y: item.y }
      }
    }

    setInteraction({
      kind: 'move-group',
      ids: activeIds,
      startPointerX: point.x,
      startPointerY: point.y,
      startPositions,
    })
    setSelectedIds(activeIds)
    setSelectedId(activeIds[activeIds.length - 1])

    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const startGroupResize = (event: ReactPointerEvent, ids: number[], bounds: GroupBounds) => {
    if (event.button === 0 && (scaleMode || moveMode)) {
      event.preventDefault()
      event.stopPropagation()
      applyTransformMode()
      return
    }

    if (event.button !== 0 || ids.length < 2) {
      return
    }

    event.stopPropagation()

    const point = getBoardPointer(event)
    if (!point) {
      return
    }

    const activeIds = ids.filter((id) => images.some((item) => item.id === id))
    if (activeIds.length < 2) {
      return
    }

    const startItems: Record<number, { x: number; y: number; width: number }> = {}
    let minScale = Number.POSITIVE_INFINITY

    for (const item of images) {
      if (!activeIds.includes(item.id)) {
        continue
      }

      startItems[item.id] = { x: item.x, y: item.y, width: item.width }
      minScale = Math.min(minScale, MIN_IMAGE_WIDTH / item.width)
    }

    setInteraction({
      kind: 'resize-group',
      ids: activeIds,
      startPointerX: point.x,
      startBounds: bounds,
      startItems,
      minScale: Number.isFinite(minScale) ? minScale : 0.1,
    })
    setSelectedIds(activeIds)
    setSelectedId(activeIds[activeIds.length - 1])

    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const onGroupMovePointerDown = (event: ReactPointerEvent) => {
    if (!groupOverlay || !groupOverlay.active || selectedIds.length < 2) {
      return
    }

    startGroupMove(event, selectedIds)
  }

  const onGroupResizePointerDown = (event: ReactPointerEvent) => {
    if (!groupOverlay || !groupOverlay.active || selectedIds.length < 2) {
      return
    }

    startGroupResize(event, selectedIds, groupOverlay.bounds)
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    const point = getBoardPointer(event)
    if (!point) {
      return
    }
    lastPointerRef.current = point

    if (scaleMode) {
      const nextDistance = Math.max(1, Math.hypot(point.x - scaleMode.centerX, point.y - scaleMode.centerY))
      const rawScale = nextDistance / scaleMode.startDistance
      const nextScale = Math.max(scaleMode.minScale, Math.min(rawScale, 40))
      setScaleMode((current) => {
        if (!current) {
          return current
        }
        if (Math.abs(current.previewScale - nextScale) < 0.001) {
          return current
        }
        return {
          ...current,
          previewScale: nextScale,
        }
      })
      return
    }

    if (moveMode) {
      const nextOffsetX = point.x - moveMode.startPointerX
      const nextOffsetY = point.y - moveMode.startPointerY
      setMoveMode((current) => {
        if (!current) {
          return current
        }
        if (Math.abs(current.offsetX - nextOffsetX) < 0.1 && Math.abs(current.offsetY - nextOffsetY) < 0.1) {
          return current
        }
        return {
          ...current,
          offsetX: nextOffsetX,
          offsetY: nextOffsetY,
        }
      })
      return
    }

    const wrapper = boardWrapRef.current
    if (pan && wrapper) {
      wrapper.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startClientX)
      wrapper.scrollTop = pan.startScrollTop - (event.clientY - pan.startClientY)
      return
    }

    if (marquee) {
      const left = Math.min(marquee.startX, point.x)
      const top = Math.min(marquee.startY, point.y)
      const right = Math.max(marquee.startX, point.x)
      const bottom = Math.max(marquee.startY, point.y)

      const nextSelectedIds = images
        .filter((item) => {
          const rect = getItemRect(item)
          return !(rect.left > right || rect.right < left || rect.top > bottom || rect.bottom < top)
        })
        .map((item) => item.id)

      setMarquee((current) =>
        current
          ? {
              ...current,
              currentX: point.x,
              currentY: point.y,
            }
          : current,
      )
      setSelectedIds(nextSelectedIds)
      setSelectedId(nextSelectedIds.length > 0 ? nextSelectedIds[nextSelectedIds.length - 1] : null)
      return
    }

    if (!interaction) {
      return
    }

    if (interaction.kind === 'move') {
      const x = point.x - interaction.offsetX
      const y = point.y - interaction.offsetY

      setImages((current) =>
        current.map((item) =>
          item.id === interaction.id
            ? {
                ...item,
                x,
                y,
              }
            : item,
        ),
      )
      return
    }

    if (interaction.kind === 'resize') {
      const deltaX = point.x - interaction.startPointerX
      setImages((current) =>
        current.map((item) => {
          if (item.id !== interaction.id) {
            return item
          }

          return {
            ...item,
            width: Math.max(MIN_IMAGE_WIDTH, interaction.startWidth + deltaX),
          }
        }),
      )
      return
    }

    if (interaction.kind === 'move-group') {
      const deltaX = point.x - interaction.startPointerX
      const deltaY = point.y - interaction.startPointerY

      setImages((current) =>
        current.map((item) => {
          if (!interaction.ids.includes(item.id)) {
            return item
          }

          const start = interaction.startPositions[item.id]
          if (!start) {
            return item
          }

          return {
            ...item,
            x: start.x + deltaX,
            y: start.y + deltaY,
          }
        }),
      )
      return
    }

    const deltaX = point.x - interaction.startPointerX
    const rawScale = (interaction.startBounds.width + deltaX) / interaction.startBounds.width
    const scale = Math.max(interaction.minScale, rawScale)

    setImages((current) =>
      current.map((item) => {
        if (!interaction.ids.includes(item.id)) {
          return item
        }

        const start = interaction.startItems[item.id]
        if (!start) {
          return item
        }

        return {
          ...item,
          x: interaction.startBounds.left + (start.x - interaction.startBounds.left) * scale,
          y: interaction.startBounds.top + (start.y - interaction.startBounds.top) * scale,
          width: Math.max(MIN_IMAGE_WIDTH, start.width * scale),
        }
      }),
    )
  }

  const stopDrag = () => {
    setInteraction(null)
    setPan(null)
    setMarquee(null)
  }

  const clearBoard = () => {
    setImages([])
    setSelectedId(null)
    setSelectedIds([])
    setInteraction(null)
    setGroupOverlay(null)
    setGroups([])
    setSeekPanelId(null)
    setScaleMode(null)
    setMoveMode(null)
    setBrokenMediaIds({})
  }

  const centerView = () => {
    const wrapper = boardWrapRef.current
    if (!wrapper) {
      return
    }

    wrapper.scrollTo({
      left: WORLD_ORIGIN - wrapper.clientWidth / 2,
      top: WORLD_ORIGIN - wrapper.clientHeight / 2,
      behavior: 'smooth',
    })
  }

  return (
    <main className={`app-shell ${darkMode ? 'dark' : ''}`}>
      <header className="toolbar">
        <label className="add-button" htmlFor="image-picker">
          Add Images
        </label>
        <input
          id="image-picker"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(event) => {
            void handleFiles(event.target.files)
            event.currentTarget.value = ''
          }}
        />
        <button type="button" onClick={saveVersion}>
          Save Version
        </button>
        <button type="button" onClick={addNote}>
          Add Note
        </button>
        <label className="add-button" htmlFor="version-picker">
          Load Version
        </label>
        <input
          id="version-picker"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void loadVersion(event.target.files)
            event.currentTarget.value = ''
          }}
        />
        <button type="button" onClick={centerView}>
          Reset View
        </button>
        <button type="button" className="danger" onClick={clearBoard}>
          Clear Board
        </button>
        <button type="button" onClick={() => setDarkMode((current) => !current)}>
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
        <span className="meta">{images.length} image(s)</span>
      </header>

      <section
        className={`board-wrap ${pan ? 'panning' : ''} ${scaleMode ? 'scale-mode' : ''} ${moveMode ? 'move-mode' : ''}`}
        ref={boardWrapRef}
        onPointerDown={(event) => {
          if (event.button === 0 && (scaleMode || moveMode)) {
            event.preventDefault()
            applyTransformMode()
            return
          }

          if (event.button !== 1) {
            return
          }

          event.preventDefault()
          const wrapper = boardWrapRef.current
          if (!wrapper) {
            return
          }

          setPan({
            startClientX: event.clientX,
            startClientY: event.clientY,
            startScrollLeft: wrapper.scrollLeft,
            startScrollTop: wrapper.scrollTop,
          })

          ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
        }}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault()
          }
        }}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div
          className="board"
          ref={boardRef}
          onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
            const types = event.dataTransfer.types
            if (
              types.includes('Files') ||
              types.includes('text/uri-list') ||
              types.includes('text/plain') ||
              types.includes('text/html') ||
              types.includes('DownloadURL')
            ) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
            handleBoardDrop(event)
          }}
          onPointerDown={(event) => {
            if (event.button === 0 && (scaleMode || moveMode)) {
              event.preventDefault()
              applyTransformMode()
              return
            }

            if (event.target !== event.currentTarget || event.button !== 0) {
              return
            }

            const point = getBoardPointer(event)
            if (!point) {
              return
            }

            if (event.ctrlKey) {
              setMarquee({
                startX: point.x,
                startY: point.y,
                currentX: point.x,
                currentY: point.y,
              })
              ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
              return
            }

            setSelectedId(null)
            setSelectedIds([])
          }}
          style={{ width: `${WORLD_SIZE}px`, height: `${WORLD_SIZE}px` }}
        >
          {images.map((image) => (
            (() => {
              const scalePreview = scaleMode ? scaleMode.startItems[image.id] : null
              const movePreview = moveMode ? moveMode.startItems[image.id] : null
              const displayX = scalePreview
                ? scaleMode!.centerX + (scalePreview.x - scaleMode!.centerX) * scaleMode!.previewScale
                : movePreview
                  ? movePreview.x + moveMode!.offsetX
                  : image.x
              const displayY = scalePreview
                ? scaleMode!.centerY + (scalePreview.y - scaleMode!.centerY) * scaleMode!.previewScale
                : movePreview
                  ? movePreview.y + moveMode!.offsetY
                  : image.y
              const displayWidth = scalePreview ? Math.max(MIN_IMAGE_WIDTH, scalePreview.width * scaleMode!.previewScale) : image.width
              const isMediaStack = image.mediaKind !== 'note' && (image.mediaItems?.length ?? 0) > 1
              const displayImageSrc = image.isGif && image.paused && image.gifFreezeSrc ? image.gifFreezeSrc : image.src
              const shouldUseBlurBg = isMediaStack && image.mediaKind === 'image' && !image.isGif

              return (
            <figure
              key={image.id}
              className={`board-image ${selectedSet.has(image.id) ? 'selected' : ''} ${image.mediaKind === 'note' ? 'note-node' : ''} ${isMediaStack ? 'media-stack-node' : ''}`}
              style={{
                transform: `translate(${displayX + WORLD_ORIGIN}px, ${displayY + WORLD_ORIGIN}px)`,
                width: `${displayWidth}px`,
                height:
                  image.mediaKind === 'note'
                    ? `${displayWidth * image.aspect + CAPTION_HEIGHT + CARD_BORDER_HEIGHT}px`
                    : undefined,
                zIndex: image.z,
              }}
              onPointerDown={(event) => onPointerDown(event, image.id)}
            >
              {image.mediaKind === 'note' ? (
                <div className="note-body">
                  {image.noteMode === 'editing' ? (
                    <textarea
                      className="note-editor"
                      value={image.noteMarkdown ?? ''}
                      onPointerDown={(event) => {
                        event.stopPropagation()
                      }}
                      onFocus={() => {
                        setIsEditorFocused(true)
                      }}
                      onBlur={() => {
                        setIsEditorFocused(false)
                      }}
                      onChange={(event) => {
                        const nextMarkdown = event.currentTarget.value
                        setImages((current) =>
                          current.map((item) =>
                            item.id === image.id
                              ? {
                                  ...item,
                                  noteMarkdown: nextMarkdown,
                                }
                              : item,
                          ),
                        )
                      }}
                    />
                  ) : (
                    <div
                      className="note-markdown"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(image.noteMarkdown ?? '') }}
                    />
                  )}
                </div>
              ) : brokenMediaIds[image.id] || !image.src ? (
                <div
                  className="broken-media"
                  style={{ height: `${displayWidth * image.aspect}px` }}
                  aria-label={`${image.name} failed to load`}
                >
                  <div className="broken-media-icon">!</div>
                  <div className="broken-media-label">Media unavailable</div>
                </div>
              ) : image.mediaKind === 'video' ? (
                <div className="media-frame" style={{ height: `${displayWidth * image.aspect}px` }}>
                  <video
                    className="media-content"
                    src={image.src}
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                    draggable={false}
                    ref={(element) => {
                      videoRefs.current[image.id] = element
                    }}
                    onLoadedMetadata={(event) => {
                    setBrokenMediaIds((current) => {
                      if (!current[image.id]) {
                        return current
                      }
                      const next = { ...current }
                      delete next[image.id]
                      return next
                    })

                    const videoEl = event.currentTarget
                    if (!videoEl.videoWidth || !videoEl.videoHeight) {
                      return
                    }

                    const pendingSeekTime = pendingVideoSeekRef.current[image.id]
                    if (pendingSeekTime !== undefined) {
                      const safeDuration = Number.isFinite(videoEl.duration) ? videoEl.duration : pendingSeekTime
                      videoEl.currentTime = Math.max(0, Math.min(pendingSeekTime, safeDuration))
                      delete pendingVideoSeekRef.current[image.id]
                    }

                    const nextAspect = videoEl.videoHeight / videoEl.videoWidth
                    const nextDuration = Number.isFinite(videoEl.duration) ? videoEl.duration : 0

                    setVideoTimelines((current) => ({
                      ...current,
                      [image.id]: {
                        current: videoEl.currentTime,
                        duration: nextDuration,
                      },
                    }))
                    setImages((current) =>
                      current.map((item) => {
                        if (item.id !== image.id) {
                          return item
                        }

                        if ((item.mediaItems?.length ?? 0) > 1) {
                          return item
                        }

                        if (Math.abs(item.aspect - nextAspect) < 0.001) {
                          return item
                        }

                        return {
                          ...item,
                          aspect: nextAspect,
                        }
                      }),
                    )
                  }}
                    onTimeUpdate={(event) => {
                      const videoEl = event.currentTarget
                      setVideoTimelines((current) => {
                        const previous = current[image.id]
                        const nextValue = {
                          current: videoEl.currentTime,
                          duration: Number.isFinite(videoEl.duration) ? videoEl.duration : previous?.duration ?? 0,
                        }

                        if (
                          previous &&
                          Math.abs(previous.current - nextValue.current) < 0.02 &&
                          Math.abs(previous.duration - nextValue.duration) < 0.02
                        ) {
                          return current
                        }

                        return {
                          ...current,
                          [image.id]: nextValue,
                        }
                      })
                    }}
                    onError={() => {
                      fallbackNodeMediaToEmbeddedData(image.id)
                      setBrokenMediaIds((current) => ({ ...current, [image.id]: true }))
                    }}
                  />
                </div>
              ) : (
                <div className="media-frame" style={{ height: `${displayWidth * image.aspect}px` }}>
                  {shouldUseBlurBg && (
                    <img
                      className="media-bg-blur"
                      src={displayImageSrc}
                      alt=""
                      draggable={false}
                      aria-hidden="true"
                    />
                  )}
                  <img
                    className="media-content"
                    src={displayImageSrc}
                    alt={image.name}
                    draggable={false}
                    onLoad={(event) => {
                    setBrokenMediaIds((current) => {
                      if (!current[image.id]) {
                        return current
                      }
                      const next = { ...current }
                      delete next[image.id]
                      return next
                    })

                    const imgEl = event.currentTarget
                    if (!imgEl.naturalWidth || !imgEl.naturalHeight) {
                      return
                    }

                    const nextAspect = imgEl.naturalHeight / imgEl.naturalWidth
                    setImages((current) =>
                      current.map((item) => {
                        if (item.id !== image.id) {
                          return item
                        }

                        if ((item.mediaItems?.length ?? 0) > 1) {
                          return item
                        }

                        let didChange = false
                        let nextItem = item

                        if (Math.abs(item.aspect - nextAspect) >= 0.001) {
                          nextItem = {
                            ...nextItem,
                            aspect: nextAspect,
                          }
                          didChange = true
                        }

                        if (item.isGif && !item.gifFreezeSrc) {
                          try {
                            const canvas = document.createElement('canvas')
                            canvas.width = imgEl.naturalWidth
                            canvas.height = imgEl.naturalHeight
                            const ctx = canvas.getContext('2d')
                            if (ctx) {
                              ctx.drawImage(imgEl, 0, 0)
                              nextItem = {
                                ...nextItem,
                                gifFreezeSrc: canvas.toDataURL('image/png'),
                              }
                              didChange = true
                            }
                          } catch {
                            // Ignore draw failures; GIF can still play normally.
                          }
                        }

                        return didChange ? nextItem : item
                      }),
                    )
                  }}
                    onError={() => {
                      fallbackNodeMediaToEmbeddedData(image.id)
                      setBrokenMediaIds((current) => ({ ...current, [image.id]: true }))
                    }}
                  />
                </div>
              )}
              <figcaption>
                <span className="caption-name">{image.name}</span>
                {isMediaStack && (
                  <span className="stack-count">
                    {Math.max(0, Math.min(image.activeMediaIndex ?? 0, (image.mediaItems?.length ?? 1) - 1)) + 1}/
                    {image.mediaItems?.length}
                  </span>
                )}
                {isMediaStack && (
                  <button
                    type="button"
                    className="slideshow-toggle"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      setImages((current) =>
                        current.map((item) =>
                          item.id === image.id
                            ? {
                                ...item,
                                slideshowPlaying: !item.slideshowPlaying,
                              }
                            : item,
                        ),
                      )
                    }}
                    aria-label={`${image.slideshowPlaying ? 'Pause' : 'Play'} slideshow for ${image.name}`}
                  >
                    {image.slideshowPlaying ? 'Pause' : 'Play'}
                  </button>
                )}
                {image.mediaKind === 'note' && (
                  <button
                    type="button"
                    className="note-mode-toggle"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      setImages((current) =>
                        current.map((item) =>
                          item.id === image.id
                            ? {
                                ...item,
                                noteMode: item.noteMode === 'editing' ? 'viewing' : 'editing',
                              }
                            : item,
                        ),
                      )
                    }}
                    aria-label={`${image.noteMode === 'editing' ? 'View' : 'Edit'} ${image.name}`}
                  >
                    {image.noteMode === 'editing' ? 'View' : 'Edit'}
                  </button>
                )}
                <button
                  type="button"
                  className="source-link"
                  disabled={!image.sourceUrl}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!image.sourceUrl) {
                      return
                    }
                    window.open(image.sourceUrl, '_blank', 'noopener,noreferrer')
                  }}
                  title={image.sourceUrl ?? 'No source available'}
                  aria-label={`Open source for ${image.name}`}
                >
                  Source
                </button>
              </figcaption>
              <button
                type="button"
                className="resize-handle"
                onPointerDown={(event) => onResizePointerDown(event, image.id)}
                aria-label={`Resize ${image.name}`}
              />
              {(seekPanelId === image.id && (image.mediaKind === 'video' || image.isGif)) && (
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
                        max={Math.max(videoTimelines[image.id]?.duration ?? 0, 0.01)}
                        step={0.01}
                        value={Math.min(
                          videoTimelines[image.id]?.current ?? 0,
                          Math.max(videoTimelines[image.id]?.duration ?? 0, 0.01),
                        )}
                        onChange={(event) => {
                          const nextTime = Number(event.currentTarget.value)
                          const video = videoRefs.current[image.id]
                          if (video) {
                            video.currentTime = nextTime
                          }

                          setVideoTimelines((current) => ({
                            ...current,
                            [image.id]: {
                              current: nextTime,
                              duration: current[image.id]?.duration ?? video?.duration ?? 0,
                            },
                          }))
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <div className="seek-panel-title">GIF Seek</div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max((gifFrameCounts[image.id] ?? 1) - 1, 0)}
                        step={1}
                        value={Math.min(gifSeekFrames[image.id] ?? 0, Math.max((gifFrameCounts[image.id] ?? 1) - 1, 0))}
                        onChange={(event) => {
                          const nextFrame = Number(event.currentTarget.value)
                          void onGifSeek(image, nextFrame)
                        }}
                      />
                    </>
                  )}
                </div>
              )}
            </figure>
              )
            })()
          ))}

          {persistentGroupViews.map((group) => (
            <div
              key={group.id}
              className="group-container persistent"
              style={{
                left: `${group.bounds.left + WORLD_ORIGIN}px`,
                top: `${group.bounds.top + WORLD_ORIGIN}px`,
                width: `${group.bounds.width}px`,
                height: `${group.bounds.height}px`,
              }}
            >
              <button
                type="button"
                className="group-move-handle persistent-group-handle"
                onPointerDown={(event) => startGroupMove(event, group.memberIds)}
                aria-label={`Move persistent group ${group.id}`}
              >
                Group ({group.memberIds.length})
              </button>
              <button
                type="button"
                className="group-resize-handle persistent-group-handle"
                onPointerDown={(event) => startGroupResize(event, group.memberIds, group.bounds)}
                aria-label={`Resize persistent group ${group.id}`}
              />
            </div>
          ))}

          {groupOverlay && (
            <div
              className={`group-container ${groupOverlay.active ? 'active' : 'inactive'}`}
              style={{
                left: `${groupOverlay.bounds.left + WORLD_ORIGIN}px`,
                top: `${groupOverlay.bounds.top + WORLD_ORIGIN}px`,
                width: `${groupOverlay.bounds.width}px`,
                height: `${groupOverlay.bounds.height}px`,
              }}
            >
              {groupOverlay.active && (
                <>
                  <button
                    type="button"
                    className="group-move-handle"
                    onPointerDown={onGroupMovePointerDown}
                    aria-label="Move selected group"
                  >
                    Group ({selectedIds.length})
                  </button>
                  <button
                    type="button"
                    className="group-resize-handle"
                    onPointerDown={onGroupResizePointerDown}
                    aria-label="Resize selected group"
                  />
                </>
              )}
            </div>
          )}

          {marquee && (
            <div
              className="selection-marquee"
              style={{
                left: `${Math.min(marquee.startX, marquee.currentX) + WORLD_ORIGIN}px`,
                top: `${Math.min(marquee.startY, marquee.currentY) + WORLD_ORIGIN}px`,
                width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
                height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
              }}
            />
          )}
        </div>
      </section>
    </main>
  )
}

export default App
