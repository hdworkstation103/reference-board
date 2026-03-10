import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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

type InteractionState = DragState | ResizeState
type PanState = {
  startClientX: number
  startClientY: number
  startScrollLeft: number
  startScrollTop: number
}

const MIN_BOARD_WIDTH = 2400
const MIN_BOARD_HEIGHT = 1600
const BOARD_PADDING = 600
const START_X = 100
const START_Y = 100
const IMAGE_WIDTH = 280
const MIN_IMAGE_WIDTH = 80

function App() {
  const [images, setImages] = useState<BoardImage[]>([])
  const [interaction, setInteraction] = useState<InteractionState | null>(null)
  const [pan, setPan] = useState<PanState | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [boardSize, setBoardSize] = useState({ width: MIN_BOARD_WIDTH, height: MIN_BOARD_HEIGHT })
  const boardRef = useRef<HTMLDivElement | null>(null)
  const boardWrapRef = useRef<HTMLDivElement | null>(null)
  const nextIdRef = useRef(1)
  const nextZRef = useRef(1)
  const objectUrlsRef = useRef<string[]>([])

  useEffect(() => {
    return () => {
      for (const src of objectUrlsRef.current) {
        URL.revokeObjectURL(src)
      }
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'x' || event.key === 'X') && selectedId !== null) {
        setImages((current) => current.filter((item) => item.id !== selectedId))
        setInteraction((current) => (current && current.id === selectedId ? null : current))
        setSelectedId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedId])

  useEffect(() => {
    const wrapper = boardWrapRef.current
    const viewportWidth = wrapper?.clientWidth ?? 0
    const viewportHeight = wrapper?.clientHeight ?? 0

    let maxX = 0
    let maxY = 0
    for (const image of images) {
      maxX = Math.max(maxX, image.x + image.width)
      // Height is approximate from width to avoid storing image aspect metadata.
      maxY = Math.max(maxY, image.y + image.width + 40)
    }

    setBoardSize({
      width: Math.max(MIN_BOARD_WIDTH, viewportWidth + BOARD_PADDING, maxX + BOARD_PADDING),
      height: Math.max(MIN_BOARD_HEIGHT, viewportHeight + BOARD_PADDING, maxY + BOARD_PADDING),
    })
  }, [images])

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

    const board = boardRef.current
    const wrapper = boardWrapRef.current
    if (!board || !wrapper) {
      return
    }

    const targetImage = images.find((img) => img.id === id)
    if (!targetImage) {
      return
    }

    const boardRect = board.getBoundingClientRect()
    const x = event.clientX - boardRect.left + wrapper.scrollLeft
    const y = event.clientY - boardRect.top + wrapper.scrollTop

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
        offsetX: x - targetImage.x,
        offsetY: y - targetImage.y,
      })
      setSelectedId(duplicateId)

      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      return
    }

    bringToFront(id)
    setSelectedId(id)

    setInteraction({
      kind: 'move',
      id,
      offsetX: x - targetImage.x,
      offsetY: y - targetImage.y,
    })

    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const onResizePointerDown = (event: ReactPointerEvent, id: number) => {
    if (event.button !== 0) {
      return
    }

    event.stopPropagation()

    const board = boardRef.current
    const wrapper = boardWrapRef.current
    if (!board || !wrapper) {
      return
    }

    const targetImage = images.find((img) => img.id === id)
    if (!targetImage) {
      return
    }

    bringToFront(id)
    setSelectedId(id)

    const boardRect = board.getBoundingClientRect()
    const pointerX = event.clientX - boardRect.left + wrapper.scrollLeft

    setInteraction({
      kind: 'resize',
      id,
      startWidth: targetImage.width,
      startPointerX: pointerX,
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

    const board = boardRef.current
    const currentWrapper = boardWrapRef.current
    if (!interaction || !board || !currentWrapper) {
      return
    }

    const boardRect = board.getBoundingClientRect()
    if (interaction.kind === 'move') {
      const rawX = event.clientX - boardRect.left + currentWrapper.scrollLeft - interaction.offsetX
      const rawY = event.clientY - boardRect.top + currentWrapper.scrollTop - interaction.offsetY

      const x = Math.max(0, rawX)
      const y = Math.max(0, rawY)

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

    const pointerX = event.clientX - boardRect.left + currentWrapper.scrollLeft
    const deltaX = pointerX - interaction.startPointerX
    setImages((current) =>
      current.map((item) => {
        if (item.id !== interaction.id) {
          return item
        }

        const nextWidth = Math.max(MIN_IMAGE_WIDTH, interaction.startWidth + deltaX)
        return {
          ...item,
          width: nextWidth,
        }
      }),
    )
  }

  const stopDrag = () => {
    setInteraction(null)
    setPan(null)
  }

  const clearBoard = () => {
    for (const src of objectUrlsRef.current) {
      URL.revokeObjectURL(src)
    }
    objectUrlsRef.current = []
    setImages([])
    setSelectedId(null)
    setInteraction(null)
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
            if (event.target === event.currentTarget) {
              setSelectedId(null)
            }
          }}
          style={{ width: `${boardSize.width}px`, height: `${boardSize.height}px` }}
        >
          {images.map((image) => (
            <figure
              key={image.id}
              className={`board-image ${selectedId === image.id ? 'selected' : ''}`}
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
        </div>
      </section>
    </main>
  )
}

export default App
