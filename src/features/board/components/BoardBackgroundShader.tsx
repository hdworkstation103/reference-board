import { useEffect, useRef, useState, type RefObject } from 'react'
import type { BackgroundShaderOption } from '../shaders'
import ShaderSurface from './ShaderSurface'

type BoardBackgroundShaderProps = {
  boardWrapRef: RefObject<HTMLDivElement | null>
  darkMode: boolean
  enabled: boolean
  shader: BackgroundShaderOption
}

type ViewportState = {
  height: number
  scrollLeft: number
  scrollTop: number
  width: number
}

type ShaderOffsetState = {
  x: number
  y: number
}

const SHADER_SPRING_STIFFNESS = 180
const SHADER_SPRING_DAMPING = 22
const SHADER_SNAP_DISTANCE = 2400
const SHADER_PAN_SCALE = 0.5

function BoardBackgroundShader({
  boardWrapRef,
  darkMode,
  enabled,
  shader,
}: BoardBackgroundShaderProps) {
  const [viewport, setViewport] = useState<ViewportState>({
    height: 0,
    scrollLeft: 0,
    scrollTop: 0,
    width: 0,
  })
  const [shaderOffset, setShaderOffset] = useState<ShaderOffsetState>({
    x: 0,
    y: 0,
  })
  const shaderOffsetRef = useRef<ShaderOffsetState>({ x: 0, y: 0 })
  const shaderVelocityRef = useRef<ShaderOffsetState>({ x: 0, y: 0 })
  const shaderTargetRef = useRef<ShaderOffsetState>({ x: 0, y: 0 })
  const shaderFrameRef = useRef(0)
  const lastTimestampRef = useRef(0)
  const hasInitializedShaderOffsetRef = useRef(false)

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

  useEffect(() => {
    const target = {
      x: viewport.scrollLeft,
      y: viewport.scrollTop,
    }
    shaderTargetRef.current = target

    if (!hasInitializedShaderOffsetRef.current) {
      hasInitializedShaderOffsetRef.current = true
      shaderOffsetRef.current = target
      shaderVelocityRef.current = { x: 0, y: 0 }
      setShaderOffset(target)
      return
    }

    if (
      Math.abs(target.x - shaderOffsetRef.current.x) > SHADER_SNAP_DISTANCE ||
      Math.abs(target.y - shaderOffsetRef.current.y) > SHADER_SNAP_DISTANCE
    ) {
      shaderOffsetRef.current = target
      shaderVelocityRef.current = { x: 0, y: 0 }
      setShaderOffset(target)
      return
    }

    if (shaderFrameRef.current !== 0) {
      return
    }

    const animateShaderOffset = (timestamp: number) => {
      if (lastTimestampRef.current === 0) {
        lastTimestampRef.current = timestamp
      }

      const deltaSeconds = Math.min(
        (timestamp - lastTimestampRef.current) / 1000,
        0.032,
      )
      lastTimestampRef.current = timestamp

      const nextOffset = { ...shaderOffsetRef.current }
      const nextVelocity = { ...shaderVelocityRef.current }
      const targetOffset = shaderTargetRef.current

      const tickAxis = (axis: keyof ShaderOffsetState) => {
        const displacement = targetOffset[axis] - nextOffset[axis]
        const acceleration =
          displacement * SHADER_SPRING_STIFFNESS -
          nextVelocity[axis] * SHADER_SPRING_DAMPING

        nextVelocity[axis] += acceleration * deltaSeconds
        nextOffset[axis] += nextVelocity[axis] * deltaSeconds
      }

      tickAxis('x')
      tickAxis('y')

      shaderOffsetRef.current = nextOffset
      shaderVelocityRef.current = nextVelocity
      setShaderOffset(nextOffset)

      const settled =
        Math.abs(targetOffset.x - nextOffset.x) < 0.1 &&
        Math.abs(targetOffset.y - nextOffset.y) < 0.1 &&
        Math.abs(nextVelocity.x) < 0.1 &&
        Math.abs(nextVelocity.y) < 0.1

      if (settled) {
        shaderOffsetRef.current = targetOffset
        shaderVelocityRef.current = { x: 0, y: 0 }
        setShaderOffset(targetOffset)
        shaderFrameRef.current = 0
        lastTimestampRef.current = 0
        return
      }

      shaderFrameRef.current = window.requestAnimationFrame(animateShaderOffset)
    }

    shaderFrameRef.current = window.requestAnimationFrame(animateShaderOffset)
  }, [viewport.scrollLeft, viewport.scrollTop])

  useEffect(() => {
    return () => {
      if (shaderFrameRef.current !== 0) {
        window.cancelAnimationFrame(shaderFrameRef.current)
      }
    }
  }, [])

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
            fs={shader.fs}
            className="board-viewport-shader"
            uniforms={{
              uViewportOffset: [
                shaderOffset.x * devicePixelRatio * SHADER_PAN_SCALE,
                shaderOffset.y * devicePixelRatio * SHADER_PAN_SCALE,
              ],
              uTheme: darkMode ? 1 : 0,
            }}
            onStatusChange={(status) => {
              if (status.validationError) {
                console.warn(
                  `Board background shader "${shader.label}" validation failed:`,
                  status.validationError,
                )
              }
              if (status.runtimeError) {
                console.warn(
                  `Board background shader "${shader.label}" disabled:`,
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
