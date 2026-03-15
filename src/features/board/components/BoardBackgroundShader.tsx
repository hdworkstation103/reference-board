import { useEffect, useState, type RefObject } from 'react'
import { BOARD_BACKGROUND_SHADER_FS } from '../constants'
import ShaderSurface from './ShaderSurface'

type BoardBackgroundShaderProps = {
  boardWrapRef: RefObject<HTMLDivElement | null>
  darkMode: boolean
  enabled: boolean
}

type ViewportState = {
  height: number
  scrollLeft: number
  scrollTop: number
  width: number
}

function BoardBackgroundShader({
  boardWrapRef,
  darkMode,
  enabled,
}: BoardBackgroundShaderProps) {
  const [viewport, setViewport] = useState<ViewportState>({
    height: 0,
    scrollLeft: 0,
    scrollTop: 0,
    width: 0,
  })

  useEffect(() => {
    const wrapper = boardWrapRef.current
    if (!wrapper) {
      return
    }

    let frameId = 0

    const updateViewport = () => {
      frameId = 0
      setViewport((current) => {
        const next = {
          height: wrapper.clientHeight,
          scrollLeft: wrapper.scrollLeft,
          scrollTop: wrapper.scrollTop,
          width: wrapper.clientWidth,
        }
        return current.height === next.height &&
          current.scrollLeft === next.scrollLeft &&
          current.scrollTop === next.scrollTop
          && current.width === next.width
          ? current
          : next
      })
    }

    const scheduleViewportUpdate = () => {
      if (frameId !== 0) {
        return
      }
      frameId = window.requestAnimationFrame(updateViewport)
    }

    scheduleViewportUpdate()

    const resizeObserver = new ResizeObserver(() => {
      scheduleViewportUpdate()
    })

    resizeObserver.observe(wrapper)
    wrapper.addEventListener('scroll', scheduleViewportUpdate, {
      passive: true,
    })

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }
      resizeObserver.disconnect()
      wrapper.removeEventListener('scroll', scheduleViewportUpdate)
    }
  }, [boardWrapRef])

  const gridOffsetX = `${-viewport.scrollLeft}px`
  const gridOffsetY = `${-viewport.scrollTop}px`
  const devicePixelRatio = window.devicePixelRatio || 1

  return (
    <div className="board-viewport-background-anchor" aria-hidden="true">
      <div
        className="board-viewport-background"
        style={{ width: `${viewport.width}px`, height: `${viewport.height}px` }}
      >
        <div
          className="board-viewport-grid"
          style={{
            backgroundPosition: `${gridOffsetX} ${gridOffsetY}, ${gridOffsetX} ${gridOffsetY}`,
          }}
        />
        {enabled ? (
          <ShaderSurface
            fs={BOARD_BACKGROUND_SHADER_FS}
            className="board-viewport-shader"
            uniforms={{
              uViewportOffset: [
                viewport.scrollLeft * devicePixelRatio,
                viewport.scrollTop * devicePixelRatio,
              ],
              uTheme: darkMode ? 1 : 0,
            }}
            onStatusChange={(status) => {
              if (status.validationError) {
                console.warn(
                  'Board background shader validation failed:',
                  status.validationError,
                )
              }
              if (status.runtimeError) {
                console.warn(
                  'Board background shader disabled:',
                  status.runtimeError,
                )
              }
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

export default BoardBackgroundShader
