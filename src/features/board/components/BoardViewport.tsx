import type { DragEventHandler, PointerEventHandler, ReactNode, RefObject } from 'react'
import type { BackgroundShaderOption } from '../shaders'
import BoardBackgroundShader from './BoardBackgroundShader'

type BoardViewportProps = {
  boardRef: RefObject<HTMLDivElement | null>
  boardWrapRef: RefObject<HTMLDivElement | null>
  boardWidth: number
  boardHeight: number
  backgroundShader: BackgroundShaderOption
  darkMode: boolean
  isPanning: boolean
  isScaleMode: boolean
  isMoveMode: boolean
  shaderCompositingEnabled: boolean
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
  backgroundShader,
  darkMode,
  isPanning,
  isScaleMode,
  isMoveMode,
  shaderCompositingEnabled,
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
        <BoardBackgroundShader
          boardWrapRef={boardWrapRef}
          darkMode={darkMode}
          enabled={shaderCompositingEnabled}
          shader={backgroundShader}
        />
        {children}
      </div>
    </section>
  )
}

export default BoardViewport
