import type { DragEventHandler, PointerEventHandler, ReactNode, RefObject } from 'react'

type BoardViewportProps = {
  boardRef: RefObject<HTMLDivElement | null>
  boardWrapRef: RefObject<HTMLDivElement | null>
  boardWidth: number
  boardHeight: number
  isPanning: boolean
  isScaleMode: boolean
  isMoveMode: boolean
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void
  onWrapPointerDown: PointerEventHandler<HTMLElement>
  onAuxClick: React.MouseEventHandler<HTMLElement>
  onPointerMove: PointerEventHandler<HTMLElement>
  onPointerUp: PointerEventHandler<HTMLElement>
  onPointerCancel: PointerEventHandler<HTMLElement>
  onBoardDragOver: DragEventHandler<HTMLDivElement>
  onBoardDrop: DragEventHandler<HTMLDivElement>
  onBoardPointerDown: PointerEventHandler<HTMLDivElement>
  children: ReactNode
}

function BoardViewport({
  boardRef,
  boardWrapRef,
  boardWidth,
  boardHeight,
  isPanning,
  isScaleMode,
  isMoveMode,
  onContextMenu,
  onWrapPointerDown,
  onAuxClick,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onBoardDragOver,
  onBoardDrop,
  onBoardPointerDown,
  children,
}: BoardViewportProps) {
  const className = [
    'board-wrap',
    isPanning ? 'panning' : '',
    isScaleMode ? 'scale-mode' : '',
    isMoveMode ? 'move-mode' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={className}
      ref={boardWrapRef}
      onContextMenu={onContextMenu}
      onPointerDown={onWrapPointerDown}
      onAuxClick={onAuxClick}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className="board"
        ref={boardRef}
        onDragOver={onBoardDragOver}
        onDrop={onBoardDrop}
        onPointerDown={onBoardPointerDown}
        style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}
      >
        {children}
      </div>
    </section>
  )
}

export default BoardViewport
