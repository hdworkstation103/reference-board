import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import './App.css'

type BoardImage = {
  id: number
  src: string
  name: string
  x: number
  y: number
  width: number
  z: number
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

const MIN_BOARD_WIDTH = 2400
const MIN_BOARD_HEIGHT = 1600
const BOARD_PADDING = 600
const START_X = 100
const START_Y = 100
const IMAGE_WIDTH = 280
const MIN_IMAGE_WIDTH = 80

const getItemRect = (item: BoardImage): ItemRect => ({
  left: item.x,
  top: item.y,
  right: item.x + item.width,
  // Approximate height from width; sufficient for coarse selection/group bounds.
  bottom: item.y + item.width + 40,
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

function App() {
  const [images, setImages] = useState<BoardImage[]>([])
  const [interaction, setInteraction] = useState<InteractionState | null>(null)
  const [pan, setPan] = useState<PanState | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [groupOverlay, setGroupOverlay] = useState<GroupOverlayState | null>(null)
  const [boardSize, setBoardSize] = useState({ width: MIN_BOARD_WIDTH, height: MIN_BOARD_HEIGHT })
  const boardRef = useRef<HTMLDivElement | null>(null)
  const boardWrapRef = useRef<HTMLDivElement | null>(null)
  const nextIdRef = useRef(1)
  const nextZRef = useRef(1)
  const objectUrlsRef = useRef<string[]>([])
  const groupFadeTimeoutRef = useRef<number | null>(null)

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  useEffect(() => {
    return () => {
      for (const src of objectUrlsRef.current) {
        URL.revokeObjectURL(src)
      }
      if (groupFadeTimeoutRef.current !== null) {
        window.clearTimeout(groupFadeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'x' || event.key === 'X') && selectedId !== null) {
        const nextSelectedIds = selectedIds.filter((id) => id !== selectedId)

        setImages((current) => current.filter((item) => item.id !== selectedId))
        setInteraction((current) => {
          if (!current) {
            return current
          }

          if (current.kind === 'move' || current.kind === 'resize') {
            return current.id === selectedId ? null : current
          }

          return current.ids.includes(selectedId) ? null : current
        })

        setSelectedIds(nextSelectedIds)
        setSelectedId(nextSelectedIds.length > 0 ? nextSelectedIds[nextSelectedIds.length - 1] : null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedId, selectedIds])

  useEffect(() => {
    const wrapper = boardWrapRef.current
    const viewportWidth = wrapper?.clientWidth ?? 0
    const viewportHeight = wrapper?.clientHeight ?? 0

    let maxX = 0
    let maxY = 0
    for (const image of images) {
      const rect = getItemRect(image)
      maxX = Math.max(maxX, rect.right)
      maxY = Math.max(maxY, rect.bottom)
    }

    setBoardSize({
      width: Math.max(MIN_BOARD_WIDTH, viewportWidth + BOARD_PADDING, maxX + BOARD_PADDING),
      height: Math.max(MIN_BOARD_HEIGHT, viewportHeight + BOARD_PADDING, maxY + BOARD_PADDING),
    })
  }, [images])

  useEffect(() => {
    const activeGroupIds = selectedIds.filter((id) => images.some((item) => item.id === id))
    if (activeGroupIds.length > 1) {
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
  }, [selectedIds, images])

  const getBoardPointer = (event: ReactPointerEvent) => {
    const board = boardRef.current
    const wrapper = boardWrapRef.current
    if (!board || !wrapper) {
      return null
    }

    const boardRect = board.getBoundingClientRect()
    return {
      x: event.clientX - boardRect.left + wrapper.scrollLeft,
      y: event.clientY - boardRect.top + wrapper.scrollTop,
    }
  }

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return
    }

    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    if (files.length === 0) {
      return
    }

    setImages((current) => {
      const cols = 5
      const nextImages = files.map((file, i) => {
        const src = URL.createObjectURL(file)
        objectUrlsRef.current.push(src)
        const id = nextIdRef.current++
        const row = Math.floor((current.length + i) / cols)
        const col = (current.length + i) % cols

        return {
          id,
          src,
          name: file.name,
          x: START_X + col * (IMAGE_WIDTH + 30),
          y: START_Y + row * 220,
          width: IMAGE_WIDTH,
          z: nextZRef.current++,
        }
      })

      return [...current, ...nextImages]
    })
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

  const onGroupMovePointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0 || !groupOverlay || !groupOverlay.active || selectedIds.length < 2) {
      return
    }

    event.stopPropagation()

    const point = getBoardPointer(event)
    if (!point) {
      return
    }

    const activeIds = selectedIds.filter((id) => images.some((item) => item.id === id))
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

    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const onGroupResizePointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0 || !groupOverlay || !groupOverlay.active || selectedIds.length < 2) {
      return
    }

    event.stopPropagation()

    const point = getBoardPointer(event)
    if (!point) {
      return
    }

    const activeIds = selectedIds.filter((id) => images.some((item) => item.id === id))
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
      startBounds: groupOverlay.bounds,
      startItems,
      minScale: Number.isFinite(minScale) ? minScale : 0.1,
    })

    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    const wrapper = boardWrapRef.current
    if (pan && wrapper) {
      wrapper.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startClientX)
      wrapper.scrollTop = pan.startScrollTop - (event.clientY - pan.startClientY)
      return
    }

    const point = getBoardPointer(event)
    if (!point) {
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
      const x = Math.max(0, point.x - interaction.offsetX)
      const y = Math.max(0, point.y - interaction.offsetY)

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
            x: Math.max(0, start.x + deltaX),
            y: Math.max(0, start.y + deltaY),
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
          x: Math.max(0, interaction.startBounds.left + (start.x - interaction.startBounds.left) * scale),
          y: Math.max(0, interaction.startBounds.top + (start.y - interaction.startBounds.top) * scale),
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
  }

  const centerView = () => {
    const wrapper = boardWrapRef.current
    if (!wrapper) {
      return
    }

    wrapper.scrollTo({
      left: 0,
      top: 0,
      behavior: 'smooth',
    })
  }

  return (
    <main className="app-shell">
      <header className="toolbar">
        <label className="add-button" htmlFor="image-picker">
          Add Images
        </label>
        <input
          id="image-picker"
          type="file"
          accept="image/*"
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
        <span className="meta">{images.length} image(s)</span>
      </header>

      <section
        className={`board-wrap ${pan ? 'panning' : ''}`}
        ref={boardWrapRef}
        onPointerDown={(event) => {
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
          onPointerDown={(event) => {
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
          style={{ width: `${boardSize.width}px`, height: `${boardSize.height}px` }}
        >
          {images.map((image) => (
            <figure
              key={image.id}
              className={`board-image ${selectedSet.has(image.id) ? 'selected' : ''}`}
              style={{
                transform: `translate(${image.x}px, ${image.y}px)`,
                width: `${image.width}px`,
                zIndex: image.z,
              }}
              onPointerDown={(event) => onPointerDown(event, image.id)}
            >
              <img src={image.src} alt={image.name} draggable={false} />
              <figcaption>{image.name}</figcaption>
              <button
                type="button"
                className="resize-handle"
                onPointerDown={(event) => onResizePointerDown(event, image.id)}
                aria-label={`Resize ${image.name}`}
              />
            </figure>
          ))}

          {groupOverlay && (
            <div
              className={`group-container ${groupOverlay.active ? 'active' : 'inactive'}`}
              style={{
                left: `${groupOverlay.bounds.left}px`,
                top: `${groupOverlay.bounds.top}px`,
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
                left: `${Math.min(marquee.startX, marquee.currentX)}px`,
                top: `${Math.min(marquee.startY, marquee.currentY)}px`,
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
