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
  name: string
  mediaKind: 'image' | 'video'
  isGif: boolean
  paused: boolean
  gifFreezeSrc?: string
  x: number
  y: number
  width: number
  aspect: number
  z: number
}

type PreparedMedia = Pick<BoardImage, 'id' | 'src' | 'name' | 'mediaKind' | 'isGif' | 'paused' | 'z'>
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
  const [groups, setGroups] = useState<PersistedGroup[]>([])
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [groupOverlay, setGroupOverlay] = useState<GroupOverlayState | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const boardWrapRef = useRef<HTMLDivElement | null>(null)
  const nextIdRef = useRef(1)
  const nextGroupIdRef = useRef(1)
  const nextZRef = useRef(1)
  const objectUrlsRef = useRef<string[]>([])
  const gifDecoderCacheRef = useRef<Record<number, { decoder: any; frameCount: number }>>({})
  const groupFadeTimeoutRef = useRef<number | null>(null)
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({})
  const pendingVideoSeekRef = useRef<Record<number, number>>({})
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

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
      for (const src of objectUrlsRef.current) {
        URL.revokeObjectURL(src)
      }
      for (const entry of Object.values(gifDecoderCacheRef.current)) {
        if (entry?.decoder && typeof entry.decoder.close === 'function') {
          entry.decoder.close()
        }
      }
      if (groupFadeTimeoutRef.current !== null) {
        window.clearTimeout(groupFadeTimeoutRef.current)
      }
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
  }, [images, moveMode, scaleMode, selectedId, selectedIds])

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

  const handleFiles = (fileList: FileList | null, anchor?: { x: number; y: number }) => {
    if (!fileList || fileList.length === 0) {
      return
    }

    const files = Array.from(fileList).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    )
    if (files.length === 0) {
      return
    }

    const prepared: PreparedMedia[] = files.map((file) => {
      const src = URL.createObjectURL(file)
      objectUrlsRef.current.push(src)
      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
      return {
        id: nextIdRef.current++,
        src,
        name: file.name,
        mediaKind: file.type.startsWith('video/') ? 'video' : 'image',
        isGif,
        paused: false,
        z: nextZRef.current++,
      }
    })

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
          name: item.name,
          mediaKind: item.mediaKind,
          isGif: item.isGif,
          paused: item.paused,
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
    for (const src of objectUrlsRef.current) {
      URL.revokeObjectURL(src)
    }

    objectUrlsRef.current = []
    setImages([])
    setSelectedId(null)
    setSelectedIds([])
    setInteraction(null)
    setGroupOverlay(null)
    setGroups([])
    setSeekPanelId(null)
    setScaleMode(null)
    setMoveMode(null)
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
            handleFiles(event.target.files)
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
            if (event.dataTransfer.types.includes('Files')) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
            event.preventDefault()
            const point = getBoardPointFromClient(event.clientX, event.clientY)
            handleFiles(event.dataTransfer.files, point ?? undefined)
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

              return (
            <figure
              key={image.id}
              className={`board-image ${selectedSet.has(image.id) ? 'selected' : ''}`}
              style={{
                transform: `translate(${displayX + WORLD_ORIGIN}px, ${displayY + WORLD_ORIGIN}px)`,
                width: `${displayWidth}px`,
                zIndex: image.z,
              }}
              onPointerDown={(event) => onPointerDown(event, image.id)}
            >
              {image.mediaKind === 'video' ? (
                <video
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
                />
              ) : (
                <img
                  src={image.isGif && image.paused && image.gifFreezeSrc ? image.gifFreezeSrc : image.src}
                  alt={image.name}
                  draggable={false}
                  onLoad={(event) => {
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
                />
              )}
              <figcaption>{image.name}</figcaption>
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
