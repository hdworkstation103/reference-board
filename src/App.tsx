import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { CSSProperties } from 'react'
import AppToolbar from './features/board/components/AppToolbar'
import BoardNode from './features/board/components/BoardNode'
import BoardViewport from './features/board/components/BoardViewport'
import ContextMenu from './features/board/components/ContextMenu'
import GroupOverlays from './features/board/components/GroupOverlays'
import InspectorPanel from './features/board/components/InspectorPanel'
import SelectionMarquee from './features/board/components/SelectionMarquee'
import {
  IMAGE_WIDTH,
  MIN_IMAGE_WIDTH,
  NOTE_DEFAULT_ASPECT,
  START_X,
  START_Y,
  WORLD_ORIGIN,
  WORLD_SIZE,
} from './features/board/constants'
import { getGroupBounds, getItemHeight, getItemRect, hasSameMembers } from './features/board/geometry'
import { createMediaItemFromFile, extractDropSourceUrls, fileToDataUrl } from './features/board/media/io'
import { applyActiveMediaFromItems, getMediaItemsForNode } from './features/board/media/nodeMedia'
import { buildSnapshot, parseSnapshot } from './features/board/snapshot'
import './features/board/styles/board.css'
import type {
  BoardImage,
  ContextMenuSection,
  ContextMenuState,
  GroupBounds,
  GroupOverlayState,
  InteractionState,
  MarqueeState,
  MediaTimeline,
  MoveModeState,
  NodeMediaItem,
  PanState,
  PersistedGroup,
  PersistentGroupView,
  PreparedMedia,
  ScaleModeState,
} from './features/board/types'

type GifFrameLike = CanvasImageSource & {
  close?: () => void
  codedHeight?: number
  codedWidth?: number
  displayHeight?: number
  displayWidth?: number
}

type GifDecoderLike = {
  close?: () => void
  decode: (options: { frameIndex: number }) => Promise<{ image: GifFrameLike }>
  frameCount?: number
  tracks?: {
    ready?: Promise<unknown>
    selectedTrack?: {
      frameCount?: number
    }
  }
}

type GifDecoderCtor = new (options: { data: Blob; type: string }) => GifDecoderLike
type MediaTransformSettings = {
  flipHorizontal: boolean
  translateX: number
  translateY: number
  scaleX: number
  scaleY: number
  rotateDeg: number
  pivotX: number
  pivotY: number
}

const DEFAULT_MEDIA_TRANSFORM: MediaTransformSettings = {
  flipHorizontal: false,
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotateDeg: 0,
  pivotX: 50,
  pivotY: 50,
}

function App() {
  const [images, setImages] = useState<BoardImage[]>([])
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem('pureref-lite-theme') === 'dark')
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
  const [mediaTransforms, setMediaTransforms] = useState<Record<number, MediaTransformSettings>>({})
  const [groups, setGroups] = useState<PersistedGroup[]>([])
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [groupOverlay, setGroupOverlay] = useState<GroupOverlayState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [enableSelectionShader, setEnableSelectionShader] = useState(true)
  const [inspectorWidth, setInspectorWidth] = useState(300)
  const [inspectorResize, setInspectorResize] = useState<{ startX: number; startWidth: number } | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const boardWrapRef = useRef<HTMLDivElement | null>(null)
  const nextIdRef = useRef(1)
  const nextGroupIdRef = useRef(1)
  const nextZRef = useRef(1)
  const gifDecoderCacheRef = useRef<Record<number, { decoder: GifDecoderLike; frameCount: number }>>({})
  const groupFadeTimeoutRef = useRef<number | null>(null)
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({})
  const pendingVideoSeekRef = useRef<Record<number, number>>({})
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const keyStateRef = useRef({ shift: false })
  const slideshowTimersRef = useRef<Record<number, number>>({})

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const effectiveSeekPanelId = useMemo(
    () => (seekPanelId !== null && images.some((item) => item.id === seekPanelId) ? seekPanelId : null),
    [images, seekPanelId],
  )
  const activeBrokenMediaIds = useMemo(() => {
    const validIds = new Set(images.map((item) => item.id))
    const next: Record<number, true> = {}
    for (const key of Object.keys(brokenMediaIds)) {
      const id = Number(key)
      if (validIds.has(id)) {
        next[id] = true
      }
    }
    return next
  }, [brokenMediaIds, images])
  const activeMediaTransforms = useMemo(() => {
    const validIds = new Set(images.map((item) => item.id))
    const next: Record<number, MediaTransformSettings> = {}
    for (const key of Object.keys(mediaTransforms)) {
      const id = Number(key)
      if (validIds.has(id)) {
        next[id] = mediaTransforms[id]
      }
    }
    return next
  }, [mediaTransforms, images])
  const activeGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          memberIds: group.memberIds.filter((id) => images.some((item) => item.id === id)),
        }))
        .filter((group) => group.memberIds.length > 1),
    [groups, images],
  )
  const persistentGroupViews = useMemo(
    () =>
      activeGroups
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
        .filter((value): value is PersistentGroupView => value !== null),
    [activeGroups, images],
  )
  const inspectorNode = useMemo(() => {
    if (selectedId === null) {
      return null
    }

    return images.find((item) => item.id === selectedId) ?? null
  }, [images, selectedId])
  const selectedNodeTransform = useMemo(() => {
    if (!inspectorNode) {
      return DEFAULT_MEDIA_TRANSFORM
    }

    return activeMediaTransforms[inspectorNode.id] ?? DEFAULT_MEDIA_TRANSFORM
  }, [activeMediaTransforms, inspectorNode])
  const contextMenuSections = useMemo<ContextMenuSection[]>(() => {
    if (!contextMenu) {
      return []
    }

    switch (contextMenu.target.kind) {
      case 'board':
        return [
          {
            title: 'Board',
            items: [
              { id: 'board.add-note', label: 'Add note here', shortcut: 'N' },
              { id: 'board.paste-media', label: 'Paste media', shortcut: 'Ctrl+V', disabled: true },
              { id: 'board.create-frame', label: 'Create frame', disabled: true },
            ],
          },
          {
            title: 'Mock',
            items: [
              { id: 'board.inspect-zone', label: 'Inspect board zone' },
              { id: 'board.board-settings', label: 'Board settings' },
            ],
          },
        ]
      case 'node':
        return [
          {
            title: contextMenu.target.nodeMediaKind === 'note' ? 'Note' : 'Node',
            items: [
              { id: 'node.open-details', label: 'Open details', shortcut: 'Enter' },
              { id: 'node.duplicate', label: 'Duplicate node', shortcut: 'Ctrl+D', disabled: true },
              { id: 'node.replace-media', label: 'Replace media', disabled: contextMenu.target.nodeMediaKind === 'note' },
            ],
          },
          {
            title: 'Mock',
            items: [
              { id: 'node.pin-context', label: 'Pin quick actions' },
              { id: 'node.generate-variants', label: 'Generate variants', disabled: true },
            ],
          },
        ]
      case 'selection':
        return [
          {
            title: 'Selection',
            items: [
              { id: 'selection.align', label: 'Align selection', disabled: true },
              { id: 'selection.distribute', label: 'Distribute evenly', disabled: true },
              { id: 'selection.wrap-group', label: 'Wrap in group' },
            ],
          },
          {
            title: 'Mock',
            items: [
              { id: 'selection.export', label: 'Export selection' },
              { id: 'selection.layout-preset', label: 'Apply layout preset', disabled: true },
            ],
          },
        ]
    }
  }, [contextMenu])
  const appContentStyle = useMemo(
    () =>
      ({
        '--inspector-width': `${inspectorWidth}px`,
      }) as CSSProperties,
    [inspectorWidth],
  )

  const getMediaTransformForNode = (id: number) => activeMediaTransforms[id] ?? DEFAULT_MEDIA_TRANSFORM
  const getTransformOrigin = (settings: MediaTransformSettings) => `${settings.pivotX}% ${settings.pivotY}%`
  const getTransformCss = (settings: MediaTransformSettings) => {
    const scaleX = settings.flipHorizontal ? -settings.scaleX : settings.scaleX
    return `translate(${settings.translateX}px, ${settings.translateY}px) rotate(${settings.rotateDeg}deg) scale(${scaleX}, ${settings.scaleY})`
  }

  const updateSelectedNodeTransform = (patch: Partial<MediaTransformSettings>) => {
    if (!inspectorNode || inspectorNode.mediaKind === 'note') {
      return
    }

    setMediaTransforms((current) => {
      const currentSettings = current[inspectorNode.id] ?? DEFAULT_MEDIA_TRANSFORM
      const nextSettings = {
        ...currentSettings,
        ...patch,
      }

      const isDefault =
        nextSettings.flipHorizontal === DEFAULT_MEDIA_TRANSFORM.flipHorizontal &&
        nextSettings.translateX === DEFAULT_MEDIA_TRANSFORM.translateX &&
        nextSettings.translateY === DEFAULT_MEDIA_TRANSFORM.translateY &&
        nextSettings.scaleX === DEFAULT_MEDIA_TRANSFORM.scaleX &&
        nextSettings.scaleY === DEFAULT_MEDIA_TRANSFORM.scaleY &&
        nextSettings.rotateDeg === DEFAULT_MEDIA_TRANSFORM.rotateDeg &&
        nextSettings.pivotX === DEFAULT_MEDIA_TRANSFORM.pivotX &&
        nextSettings.pivotY === DEFAULT_MEDIA_TRANSFORM.pivotY

      const next = { ...current }
      if (isDefault) {
        delete next[inspectorNode.id]
      } else {
        next[inspectorNode.id] = nextSettings
      }
      return next
    })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  const openContextMenu = (menu: ContextMenuState) => {
    setContextMenu(menu)
  }

  useEffect(() => {
    if (!inspectorResize) {
      return
    }

    const onPointerMove = (event: PointerEvent) => {
      const delta = inspectorResize.startX - event.clientX
      const maxWidth = Math.max(320, Math.floor(window.innerWidth * 0.55))
      const nextWidth = Math.max(220, Math.min(maxWidth, inspectorResize.startWidth + delta))
      setInspectorWidth(nextWidth)
    }

    const stopResize = () => {
      setInspectorResize(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
    }
  }, [inspectorResize])

  useEffect(() => {
    const decoderCache = gifDecoderCacheRef.current
    return () => {
      for (const entry of Object.values(decoderCache)) {
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
    window.localStorage.setItem('pureref-lite-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

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

  function advanceMediaForNodeIds(nodeIds: number[], direction: 1 | -1) {
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

  async function ensureGifDecoder(item: BoardImage) {
    const cached = gifDecoderCacheRef.current[item.id]
    if (cached) {
      return cached
    }

    const DecoderCtor = (window as unknown as { ImageDecoder?: GifDecoderCtor }).ImageDecoder
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

          if (current.kind === 'extract-slide') {
            return deleteIds.includes(current.sourceId) ? null : current
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
    const selectionAlreadyPersisted = activeGroups.some((group) => hasSameMembers(group.memberIds, activeGroupIds))
    if (activeGroupIds.length > 1 && !selectionAlreadyPersisted) {
      const bounds = getGroupBounds(activeGroupIds, images)
      if (!bounds) {
        return
      }

      if (groupFadeTimeoutRef.current !== null) {
        window.clearTimeout(groupFadeTimeoutRef.current)
        groupFadeTimeoutRef.current = null
      }

      window.setTimeout(() => {
        setGroupOverlay({ bounds, active: true })
      }, 0)
      return
    }

    window.setTimeout(() => {
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
    }, 0)
  }, [selectedIds, images, activeGroups])

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
    const snapshot = buildSnapshot(images, activeGroups, darkMode)
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
      const snapshotState = parseSnapshot(await file.text())

      setImages(snapshotState.loadedImages)
      setGroups(snapshotState.loadedGroups)
      setDarkMode(snapshotState.darkMode)
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
      setMediaTransforms({})
      setContextMenu(null)

      nextIdRef.current = snapshotState.nextId
      nextZRef.current = snapshotState.nextZ
      nextGroupIdRef.current = snapshotState.nextGroupId
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
    closeContextMenu()

    if (event.button === 2 && event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()

      const point = getBoardPointer(event)
      if (!point) {
        return
      }

      const sourceNode = images.find((img) => img.id === id)
      if (!sourceNode || sourceNode.mediaKind === 'note') {
        return
      }

      const sourceItems = getMediaItemsForNode(sourceNode)
      if (sourceItems.length < 2) {
        return
      }

      const extractedIndex = Math.max(0, Math.min(sourceNode.activeMediaIndex ?? 0, sourceItems.length - 1))
      const extractedMedia = sourceItems[extractedIndex]

      setSelectedId(id)
      setSelectedIds([id])
      setInteraction({
        kind: 'extract-slide',
        sourceId: id,
        sourceRect: getItemRect(sourceNode),
        offsetX: point.x - sourceNode.x,
        offsetY: point.y - sourceNode.y,
        sourceWidth: sourceNode.width,
        sourceAspect: sourceNode.aspect,
        extractedIndex,
        extractedMedia,
      })
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      return
    }

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

  const onNodeContextMenu = (event: ReactMouseEvent, id: number) => {
    event.preventDefault()
    event.stopPropagation()

    const node = images.find((item) => item.id === id)
    if (!node) {
      return
    }

    const activeSelection = selectedSet.has(id)
      ? selectedIds.filter((selectedId) => images.some((item) => item.id === selectedId))
      : [id]

    if (!selectedSet.has(id)) {
      setSelectedId(id)
      setSelectedIds([id])
    }

    openContextMenu({
      x: event.clientX,
      y: event.clientY,
      target:
        activeSelection.length > 1
          ? {
              kind: 'selection',
              anchorId: id,
              selectedIds: activeSelection,
            }
          : {
              kind: 'node',
              nodeId: id,
              nodeName: node.name,
              nodeMediaKind: node.mediaKind,
              selectedIds: activeSelection,
            },
    })
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

    if (interaction.kind === 'extract-slide') {
      const outsideSource =
        point.x < interaction.sourceRect.left ||
        point.x > interaction.sourceRect.right ||
        point.y < interaction.sourceRect.top ||
        point.y > interaction.sourceRect.bottom

      if (!outsideSource) {
        return
      }

      const newNodeId = nextIdRef.current++
      const extractedMedia = interaction.extractedMedia

      setImages((current) => {
        const sourceNode = current.find((item) => item.id === interaction.sourceId && item.mediaKind !== 'note')
        if (!sourceNode) {
          return current
        }

        const sourceItems = getMediaItemsForNode(sourceNode)
        if (sourceItems.length < 2) {
          return current
        }

        const safeIndex = Math.max(0, Math.min(interaction.extractedIndex, sourceItems.length - 1))
        const nextSourceItems = sourceItems.filter((_, index) => index !== safeIndex)
        if (nextSourceItems.length === 0) {
          return current
        }

        const nextSourceIndex = Math.max(0, Math.min(sourceNode.activeMediaIndex ?? 0, nextSourceItems.length - 1))

        const extractedNode: BoardImage = {
          id: newNodeId,
          src: extractedMedia.src,
          sourceDataUrl: extractedMedia.sourceDataUrl,
          sourceUrl: extractedMedia.sourceUrl,
          name: extractedMedia.name,
          mediaKind: extractedMedia.mediaKind,
          isGif: extractedMedia.isGif,
          paused: false,
          mediaItems: [extractedMedia],
          activeMediaIndex: 0,
          slideshowPlaying: false,
          x: point.x - interaction.offsetX,
          y: point.y - interaction.offsetY,
          width: interaction.sourceWidth,
          aspect: interaction.sourceAspect,
          z: nextZRef.current++,
        }

        return [
          ...current.map((item) => {
            if (item.id !== sourceNode.id) {
              return item
            }

            const nextSource = applyActiveMediaFromItems({
              ...item,
              mediaItems: nextSourceItems,
              activeMediaIndex: nextSourceIndex,
              paused: false,
              gifFreezeSrc: undefined,
              slideshowPlaying: nextSourceItems.length > 1 ? item.slideshowPlaying : false,
            })

            return {
              ...nextSource,
              aspect: item.aspect,
            }
          }),
          extractedNode,
        ]
      })

      setSelectedId(newNodeId)
      setSelectedIds([newNodeId])
      setSeekPanelId((current) => (current === interaction.sourceId ? null : current))
      setInteraction({
        kind: 'move',
        id: newNodeId,
        offsetX: interaction.offsetX,
        offsetY: interaction.offsetY,
      })
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

  const stopDrag = (event?: ReactPointerEvent<HTMLElement>) => {
    const shouldMergeOnDrop =
      Boolean(event?.shiftKey || keyStateRef.current.shift) && interaction?.kind === 'move' && !scaleMode && !moveMode

    if (shouldMergeOnDrop && event) {
      const point = getBoardPointFromClient(event.clientX, event.clientY)
      if (point) {
        const sourceId = interaction.id
        let mergedTargetId: number | null = null
        let removedSourceId: number | null = null

        setImages((current) => {
          const sourceNode = current.find((item) => item.id === sourceId && item.mediaKind !== 'note')
          if (!sourceNode) {
            return current
          }

          const sourceRect = getItemRect(sourceNode)
          const targetNode = [...current]
            .filter((item) => item.id !== sourceId && item.mediaKind !== 'note' && item.z < sourceNode.z)
            .sort((a, b) => b.z - a.z)
            .find((item) => {
              const rect = getItemRect(item)
              return (
                point.x >= rect.left &&
                point.x <= rect.right &&
                point.y >= rect.top &&
                point.y <= rect.bottom &&
                !(sourceRect.left > rect.right || sourceRect.right < rect.left || sourceRect.top > rect.bottom || sourceRect.bottom < rect.top)
              )
            })

          if (!targetNode) {
            return current
          }

          const sourceMediaItems = getMediaItemsForNode(sourceNode)
          if (sourceMediaItems.length === 0) {
            return current
          }

          mergedTargetId = targetNode.id
          removedSourceId = sourceId

          return current
            .filter((item) => item.id !== sourceId)
            .map((item) => {
              if (item.id !== targetNode.id) {
                return item
              }

              const targetMediaItems = getMediaItemsForNode(item)
              const nextMediaItems = [...targetMediaItems, ...sourceMediaItems]
              const next = applyActiveMediaFromItems({
                ...item,
                mediaItems: nextMediaItems,
                activeMediaIndex: Math.max(0, Math.min(item.activeMediaIndex ?? 0, targetMediaItems.length - 1)),
              })

              return {
                ...next,
                aspect: item.aspect,
              }
            })
        })

        if (mergedTargetId !== null && removedSourceId !== null) {
          const removedId = removedSourceId
          setSelectedIds([mergedTargetId])
          setSelectedId(mergedTargetId)
          setSeekPanelId((current) => (current === removedId ? null : current))

          setVideoTimelines((current) => {
            const next = { ...current }
            delete next[removedId]
            return next
          })
          setGifFrameCounts((current) => {
            const next = { ...current }
            delete next[removedId]
            return next
          })
          setGifSeekFrames((current) => {
            const next = { ...current }
            delete next[removedId]
            return next
          })
          setBrokenMediaIds((current) => {
            const next = { ...current }
            delete next[removedId]
            return next
          })
        }
      }
    }

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
    setMediaTransforms({})
    setContextMenu(null)
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
      <AppToolbar
        darkMode={darkMode}
        imageCount={images.length}
        enableSelectionShader={enableSelectionShader}
        onAddFiles={(files) => {
          void handleFiles(files)
        }}
        onSaveVersion={saveVersion}
        onAddNote={addNote}
        onLoadVersion={(files) => {
          void loadVersion(files)
        }}
        onCenterView={centerView}
        onClearBoard={clearBoard}
        onToggleDarkMode={() => {
          setDarkMode((current) => !current)
        }}
      />
      <section className="app-content" style={appContentStyle}>
        <BoardViewport
          boardRef={boardRef}
          boardWrapRef={boardWrapRef}
          boardWidth={WORLD_SIZE}
          boardHeight={WORLD_SIZE}
          isPanning={Boolean(pan)}
          isScaleMode={Boolean(scaleMode)}
          isMoveMode={Boolean(moveMode)}
          onContextMenu={(event) => {
            event.preventDefault()

            const point = getBoardPointFromClient(event.clientX, event.clientY)
            if (!point) {
              return
            }

            if (event.target === boardRef.current) {
              setSelectedId(null)
              setSelectedIds([])
            }

            openContextMenu({
              x: event.clientX,
              y: event.clientY,
              target: {
                kind: 'board',
                worldX: point.x,
                worldY: point.y,
              },
            })
          }}
          onWrapPointerDown={(event) => {
            closeContextMenu()

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
          onBoardDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
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
          onBoardDrop={(event: ReactDragEvent<HTMLDivElement>) => {
            handleBoardDrop(event)
          }}
          onBoardPointerDown={(event) => {
            closeContextMenu()

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
        >
        {images.map((image) => {
          const activeScaleMode = scaleMode
          const activeMoveMode = moveMode
          const scalePreview = activeScaleMode?.startItems[image.id]
          const movePreview = activeMoveMode?.startItems[image.id]
          let displayX = image.x
          let displayY = image.y
          let displayWidth = image.width

          if (activeScaleMode && scalePreview) {
            displayX = activeScaleMode.centerX + (scalePreview.x - activeScaleMode.centerX) * activeScaleMode.previewScale
            displayY = activeScaleMode.centerY + (scalePreview.y - activeScaleMode.centerY) * activeScaleMode.previewScale
            displayWidth = Math.max(MIN_IMAGE_WIDTH, scalePreview.width * activeScaleMode.previewScale)
          } else if (activeMoveMode && movePreview) {
            displayX = movePreview.x + activeMoveMode.offsetX
            displayY = movePreview.y + activeMoveMode.offsetY
          }

          return (
            <BoardNode
              key={image.id}
              image={image}
              selected={selectedSet.has(image.id)}
              displayX={displayX}
              displayY={displayY}
              displayWidth={displayWidth}
              broken={Boolean(activeBrokenMediaIds[image.id])}
              mediaTransformCss={getTransformCss(getMediaTransformForNode(image.id))}
              mediaTransformOrigin={getTransformOrigin(getMediaTransformForNode(image.id))}
              enableSelectionShader={enableSelectionShader}
              seekPanelOpen={effectiveSeekPanelId === image.id && (image.mediaKind === 'video' || image.isGif)}
              videoTimeline={videoTimelines[image.id]}
              gifFrameCount={gifFrameCounts[image.id] ?? 1}
              gifSeekFrame={gifSeekFrames[image.id] ?? 0}
              onPointerDown={onPointerDown}
              onContextMenu={onNodeContextMenu}
              onResizePointerDown={onResizePointerDown}
              onDisableSelectionShader={() => {
                setEnableSelectionShader(false)
              }}
              onNoteFocusChange={setIsEditorFocused}
              onNoteMarkdownChange={(id, markdown) => {
                setImages((current) =>
                  current.map((item) =>
                    item.id === id
                      ? {
                          ...item,
                          noteMarkdown: markdown,
                        }
                      : item,
                  ),
                )
              }}
              onToggleSlideshow={(id) => {
                setImages((current) =>
                  current.map((item) =>
                    item.id === id
                      ? {
                          ...item,
                          slideshowPlaying: !item.slideshowPlaying,
                        }
                      : item,
                  ),
                )
              }}
              onToggleNoteMode={(id) => {
                setImages((current) =>
                  current.map((item) =>
                    item.id === id
                      ? {
                          ...item,
                          noteMode: item.noteMode === 'editing' ? 'viewing' : 'editing',
                        }
                      : item,
                  ),
                )
              }}
              setVideoRef={(id, element) => {
                videoRefs.current[id] = element
              }}
              onVideoLoadedMetadata={(id, event) => {
                setBrokenMediaIds((current) => {
                  if (!current[id]) {
                    return current
                  }
                  const next = { ...current }
                  delete next[id]
                  return next
                })

                const videoEl = event.currentTarget
                if (!videoEl.videoWidth || !videoEl.videoHeight) {
                  return
                }

                const pendingSeekTime = pendingVideoSeekRef.current[id]
                if (pendingSeekTime !== undefined) {
                  const safeDuration = Number.isFinite(videoEl.duration) ? videoEl.duration : pendingSeekTime
                  videoEl.currentTime = Math.max(0, Math.min(pendingSeekTime, safeDuration))
                  delete pendingVideoSeekRef.current[id]
                }

                const nextAspect = videoEl.videoHeight / videoEl.videoWidth
                const nextDuration = Number.isFinite(videoEl.duration) ? videoEl.duration : 0

                setVideoTimelines((current) => ({
                  ...current,
                  [id]: {
                    current: videoEl.currentTime,
                    duration: nextDuration,
                  },
                }))

                setImages((current) =>
                  current.map((item) => {
                    if (item.id !== id) {
                      return item
                    }

                    if ((item.mediaItems?.length ?? 0) > 1 || Math.abs(item.aspect - nextAspect) < 0.001) {
                      return item
                    }

                    return {
                      ...item,
                      aspect: nextAspect,
                    }
                  }),
                )
              }}
              onVideoTimeUpdate={(id, event) => {
                const videoEl = event.currentTarget
                setVideoTimelines((current) => {
                  const previous = current[id]
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
                    [id]: nextValue,
                  }
                })
              }}
              onMediaError={(id) => {
                fallbackNodeMediaToEmbeddedData(id)
                setBrokenMediaIds((current) => ({ ...current, [id]: true }))
              }}
              onImageLoad={(id, event) => {
                setBrokenMediaIds((current) => {
                  if (!current[id]) {
                    return current
                  }
                  const next = { ...current }
                  delete next[id]
                  return next
                })

                const imgEl = event.currentTarget
                if (!imgEl.naturalWidth || !imgEl.naturalHeight) {
                  return
                }

                const nextAspect = imgEl.naturalHeight / imgEl.naturalWidth
                setImages((current) =>
                  current.map((item) => {
                    if (item.id !== id) {
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
              onSeekVideo={(id, nextTime) => {
                const video = videoRefs.current[id]
                if (video) {
                  video.currentTime = nextTime
                }

                setVideoTimelines((current) => ({
                  ...current,
                  [id]: {
                    current: nextTime,
                    duration: current[id]?.duration ?? video?.duration ?? 0,
                  },
                }))
              }}
              onSeekGif={onGifSeek}
            />
          )
        })}

        <GroupOverlays
          persistentGroups={persistentGroupViews}
          groupOverlay={groupOverlay}
          selectedCount={selectedIds.length}
          onPersistentGroupMove={startGroupMove}
          onPersistentGroupResize={startGroupResize}
          onSelectedGroupMove={onGroupMovePointerDown}
          onSelectedGroupResize={onGroupResizePointerDown}
        />

        {marquee && <SelectionMarquee marquee={marquee} />}
        </BoardViewport>
        <ContextMenu
          menu={contextMenu}
          sections={contextMenuSections}
          onClose={closeContextMenu}
          onAction={(actionId) => {
            console.info('[context-menu]', actionId, contextMenu?.target)
          }}
        />
        <div
          className="inspector-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector"
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return
            }
            event.preventDefault()
            setInspectorResize({
              startX: event.clientX,
              startWidth: inspectorWidth,
            })
          }}
        />
        <InspectorPanel
          selectedNode={inspectorNode}
          transformSettings={selectedNodeTransform}
          mediaTransformCss={getTransformCss(selectedNodeTransform)}
          mediaTransformOrigin={getTransformOrigin(selectedNodeTransform)}
          onFlipHorizontalChange={(nextValue) => {
            updateSelectedNodeTransform({ flipHorizontal: nextValue })
          }}
          onTransformSettingsChange={updateSelectedNodeTransform}
          onResetTransform={() => {
            updateSelectedNodeTransform(DEFAULT_MEDIA_TRANSFORM)
          }}
        />
      </section>
    </main>
  )
}

export default App
