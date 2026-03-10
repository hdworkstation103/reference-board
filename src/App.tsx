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
  id: number
  offsetX: number
  offsetY: number
}

const BOARD_WIDTH = 4000
const BOARD_HEIGHT = 2600
const START_X = 100
const START_Y = 100
const IMAGE_WIDTH = 280

function App() {
  const [images, setImages] = useState<BoardImage[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
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

    const boardRect = board.getBoundingClientRect()
    const x = event.clientX - boardRect.left + wrapper.scrollLeft
    const y = event.clientY - boardRect.top + wrapper.scrollTop

    setDrag({
      id,
      offsetX: x - targetImage.x,
      offsetY: y - targetImage.y,
    })

    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    const board = boardRef.current
    const wrapper = boardWrapRef.current
    if (!drag || !board || !wrapper) {
      return
    }

    const boardRect = board.getBoundingClientRect()
    const rawX = event.clientX - boardRect.left + wrapper.scrollLeft - drag.offsetX
    const rawY = event.clientY - boardRect.top + wrapper.scrollTop - drag.offsetY

    const x = Math.max(0, Math.min(rawX, BOARD_WIDTH - 80))
    const y = Math.max(0, Math.min(rawY, BOARD_HEIGHT - 80))

    setImages((current) =>
      current.map((item) =>
        item.id === drag.id
          ? {
              ...item,
              x,
              y,
            }
          : item,
      ),
    )
  }

  const stopDrag = () => {
    setDrag(null)
  }

  const clearBoard = () => {
    for (const image of images) {
      URL.revokeObjectURL(image.src)
    }
    objectUrlsRef.current = []
    setImages([])
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
        className="board-wrap"
        ref={boardWrapRef}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div className="board" ref={boardRef}>
          {images.map((image) => (
            <figure
              key={image.id}
              className="board-image"
              style={{
                transform: `translate(${image.x}px, ${image.y}px)`,
                width: `${image.width}px`,
                zIndex: image.z,
              }}
              onPointerDown={(event) => onPointerDown(event, image.id)}
            >
              <img src={image.src} alt={image.name} draggable={false} />
              <figcaption>{image.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
