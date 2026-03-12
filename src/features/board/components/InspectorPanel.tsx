import { useCallback, useEffect, useState } from 'react'
import type { BoardImage } from '../types'

type TransformSettings = {
  flipHorizontal: boolean
  translateX: number
  translateY: number
  scaleX: number
  scaleY: number
  rotateDeg: number
  pivotX: number
  pivotY: number
}

type NumericTransformField = 'translateX' | 'translateY' | 'scaleX' | 'scaleY' | 'rotateDeg' | 'pivotX' | 'pivotY'

type InspectorPanelProps = {
  selectedNode: BoardImage | null
  transformSettings: TransformSettings
  mediaTransformCss: string
  mediaTransformOrigin: string
  onFlipHorizontalChange: (nextValue: boolean) => void
  onTransformSettingsChange: (patch: Partial<TransformSettings>) => void
  onResetTransform: () => void
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return 'Unknown'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unitIndex]}`
}

const estimateDataUrlSize = (value?: string) => {
  if (!value || !value.startsWith('data:')) {
    return null
  }

  const base64Index = value.indexOf('base64,')
  if (base64Index === -1) {
    return null
  }

  const payload = value.slice(base64Index + 7)
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
}

function InspectorPanel({
  selectedNode,
  transformSettings,
  mediaTransformCss,
  mediaTransformOrigin,
  onFlipHorizontalChange,
  onTransformSettingsChange,
  onResetTransform,
}: InspectorPanelProps) {
  const [intrinsicSize, setIntrinsicSize] = useState<{
    key: string
    width: number
    height: number
  } | null>(null)
  const [lockAspect, setLockAspect] = useState(true)
  const [middleDrag, setMiddleDrag] = useState<{
    field: NumericTransformField
    startX: number
    startValue: number
    step: number
    min?: number
    max?: number
  } | null>(null)
  const selectedMediaKey = selectedNode ? `${selectedNode.id}:${selectedNode.src}` : null

  const applyNumericField = useCallback(
    (field: NumericTransformField, value: number) => {
      if (field === 'scaleX' || field === 'scaleY') {
        const nextScale = Math.max(0.1, value)
        if (lockAspect) {
          onTransformSettingsChange({
            scaleX: nextScale,
            scaleY: nextScale,
          })
          return
        }
        onTransformSettingsChange({ [field]: nextScale })
        return
      }

      if (field === 'pivotX' || field === 'pivotY') {
        const nextPivot = Math.max(0, Math.min(100, value))
        onTransformSettingsChange({ [field]: nextPivot })
        return
      }

      onTransformSettingsChange({ [field]: value })
    },
    [lockAspect, onTransformSettingsChange],
  )

  useEffect(() => {
    if (!middleDrag) {
      return
    }

    const onPointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - middleDrag.startX
      let nextValue = middleDrag.startValue + deltaX * middleDrag.step
      if (middleDrag.min !== undefined) {
        nextValue = Math.max(middleDrag.min, nextValue)
      }
      if (middleDrag.max !== undefined) {
        nextValue = Math.min(middleDrag.max, nextValue)
      }
      applyNumericField(middleDrag.field, nextValue)
    }

    const stopDrag = () => {
      setMiddleDrag(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopDrag)
    window.addEventListener('pointercancel', stopDrag)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopDrag)
      window.removeEventListener('pointercancel', stopDrag)
    }
  }, [applyNumericField, middleDrag])

  useEffect(() => {
    if (!selectedNode || selectedNode.mediaKind === 'note') {
      return
    }

    if (selectedNode.mediaKind === 'image') {
      const image = new Image()
      image.onload = () => {
        setIntrinsicSize({
          key: `${selectedNode.id}:${selectedNode.src}`,
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      }
      image.src = selectedNode.src
      return
    }

    const video = document.createElement('video')
    const onLoadedMetadata = () => {
      setIntrinsicSize({
        key: `${selectedNode.id}:${selectedNode.src}`,
        width: video.videoWidth,
        height: video.videoHeight,
      })
    }
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.src = selectedNode.src
    video.preload = 'metadata'

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
    }
  }, [selectedNode])

  if (!selectedNode) {
    return (
      <aside className="inspector-sidebar">
        <div className="inspector-header">Inspector</div>
        <div className="inspector-empty">Select a node to inspect it.</div>
      </aside>
    )
  }

  const activeIntrinsicSize = intrinsicSize && intrinsicSize.key === selectedMediaKey ? intrinsicSize : null
  const pixelWidth = activeIntrinsicSize ? `${Math.max(1, Math.round(activeIntrinsicSize.width))}px` : 'Unknown'
  const pixelHeight = activeIntrinsicSize ? `${Math.max(1, Math.round(activeIntrinsicSize.height))}px` : 'Unknown'
  const estimatedBytes = estimateDataUrlSize(selectedNode.sourceDataUrl ?? selectedNode.src)
  const sourceValue = selectedNode.sourceUrl ?? (selectedNode.sourceDataUrl ? 'Embedded' : 'Unknown')
  const isSourceLink = Boolean(selectedNode.sourceUrl)

  return (
    <aside className="inspector-sidebar">
      <div className="inspector-header">Inspector</div>
      <div className="inspector-body">
        <div className="inspector-preview">
          {selectedNode.mediaKind === 'note' ? (
            <div className="inspector-note-preview">Note</div>
          ) : selectedNode.mediaKind === 'video' ? (
            <video
              src={selectedNode.src}
              muted
              loop
              autoPlay
              playsInline
              controls
              style={{
                transform: mediaTransformCss,
                transformOrigin: mediaTransformOrigin,
              }}
            />
          ) : (
            <img
              src={selectedNode.isGif && selectedNode.paused && selectedNode.gifFreezeSrc ? selectedNode.gifFreezeSrc : selectedNode.src}
              alt={selectedNode.name}
              style={{
                transform: mediaTransformCss,
                transformOrigin: mediaTransformOrigin,
              }}
            />
          )}
        </div>

        <dl className="inspector-fields">
          <div className="inspector-row">
            <dt>Filename</dt>
            <dd>{selectedNode.name}</dd>
          </div>
          <div className="inspector-row">
            <dt>Width</dt>
            <dd>{pixelWidth}</dd>
          </div>
          <div className="inspector-row">
            <dt>Height</dt>
            <dd>{pixelHeight}</dd>
          </div>
          <div className="inspector-row">
            <dt>File Size</dt>
            <dd>{formatBytes(estimatedBytes ?? Number.NaN)}</dd>
          </div>
          <div className="inspector-row">
            <dt>Source</dt>
            <dd title={sourceValue}>
              {isSourceLink ? (
                <a href={selectedNode.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {sourceValue}
                </a>
              ) : (
                sourceValue
              )}
            </dd>
          </div>
        </dl>

        <div className="inspector-tools">
          <div className="inspector-tools-title">Tools</div>
          <label className="inspector-tool-toggle">
            <input
              type="checkbox"
              checked={transformSettings.flipHorizontal}
              disabled={selectedNode.mediaKind === 'note'}
              onChange={(event) => {
                onFlipHorizontalChange(event.currentTarget.checked)
              }}
            />
            <span>Flip image horizontal</span>
          </label>
          <label className="inspector-tool-toggle">
            <input
              type="checkbox"
              checked={lockAspect}
              disabled={selectedNode.mediaKind === 'note'}
              onChange={(event) => {
                setLockAspect(event.currentTarget.checked)
              }}
            />
            <span>Lock Aspect (uniform scale)</span>
          </label>

          <div className="inspector-transform-grid">
            <label className="inspector-param">
              <span>Translate X</span>
              <input
                type="number"
                value={transformSettings.translateX}
                disabled={selectedNode.mediaKind === 'note'}
                onChange={(event) => {
                  applyNumericField('translateX', Number(event.currentTarget.value))
                }}
                onPointerDown={(event) => {
                  if (event.button !== 1 || selectedNode.mediaKind === 'note') {
                    return
                  }
                  event.preventDefault()
                  setMiddleDrag({
                    field: 'translateX',
                    startX: event.clientX,
                    startValue: transformSettings.translateX,
                    step: 1,
                  })
                }}
              />
            </label>
            <label className="inspector-param">
              <span>Translate Y</span>
              <input
                type="number"
                value={transformSettings.translateY}
                disabled={selectedNode.mediaKind === 'note'}
                onChange={(event) => {
                  applyNumericField('translateY', Number(event.currentTarget.value))
                }}
                onPointerDown={(event) => {
                  if (event.button !== 1 || selectedNode.mediaKind === 'note') {
                    return
                  }
                  event.preventDefault()
                  setMiddleDrag({
                    field: 'translateY',
                    startX: event.clientX,
                    startValue: transformSettings.translateY,
                    step: 1,
                  })
                }}
              />
            </label>
            <label className="inspector-param">
              <span>Scale X</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={transformSettings.scaleX}
                disabled={selectedNode.mediaKind === 'note'}
                onChange={(event) => {
                  applyNumericField('scaleX', Number(event.currentTarget.value))
                }}
                onPointerDown={(event) => {
                  if (event.button !== 1 || selectedNode.mediaKind === 'note') {
                    return
                  }
                  event.preventDefault()
                  setMiddleDrag({
                    field: 'scaleX',
                    startX: event.clientX,
                    startValue: transformSettings.scaleX,
                    step: 0.01,
                    min: 0.1,
                  })
                }}
              />
            </label>
            <label className="inspector-param">
              <span>Scale Y</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={transformSettings.scaleY}
                disabled={selectedNode.mediaKind === 'note'}
                onChange={(event) => {
                  applyNumericField('scaleY', Number(event.currentTarget.value))
                }}
                onPointerDown={(event) => {
                  if (event.button !== 1 || selectedNode.mediaKind === 'note') {
                    return
                  }
                  event.preventDefault()
                  setMiddleDrag({
                    field: 'scaleY',
                    startX: event.clientX,
                    startValue: transformSettings.scaleY,
                    step: 0.01,
                    min: 0.1,
                  })
                }}
              />
            </label>
            <label className="inspector-param">
              <span>Rotate</span>
              <input
                type="number"
                value={transformSettings.rotateDeg}
                disabled={selectedNode.mediaKind === 'note'}
                onChange={(event) => {
                  applyNumericField('rotateDeg', Number(event.currentTarget.value))
                }}
                onPointerDown={(event) => {
                  if (event.button !== 1 || selectedNode.mediaKind === 'note') {
                    return
                  }
                  event.preventDefault()
                  setMiddleDrag({
                    field: 'rotateDeg',
                    startX: event.clientX,
                    startValue: transformSettings.rotateDeg,
                    step: 0.2,
                  })
                }}
              />
            </label>
            <label className="inspector-param">
              <span>Pivot X (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={transformSettings.pivotX}
                disabled={selectedNode.mediaKind === 'note'}
                onChange={(event) => {
                  applyNumericField('pivotX', Number(event.currentTarget.value))
                }}
                onPointerDown={(event) => {
                  if (event.button !== 1 || selectedNode.mediaKind === 'note') {
                    return
                  }
                  event.preventDefault()
                  setMiddleDrag({
                    field: 'pivotX',
                    startX: event.clientX,
                    startValue: transformSettings.pivotX,
                    step: 0.2,
                    min: 0,
                    max: 100,
                  })
                }}
              />
            </label>
            <label className="inspector-param">
              <span>Pivot Y (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={transformSettings.pivotY}
                disabled={selectedNode.mediaKind === 'note'}
                onChange={(event) => {
                  applyNumericField('pivotY', Number(event.currentTarget.value))
                }}
                onPointerDown={(event) => {
                  if (event.button !== 1 || selectedNode.mediaKind === 'note') {
                    return
                  }
                  event.preventDefault()
                  setMiddleDrag({
                    field: 'pivotY',
                    startX: event.clientX,
                    startValue: transformSettings.pivotY,
                    step: 0.2,
                    min: 0,
                    max: 100,
                  })
                }}
              />
            </label>
          </div>

          <button
            type="button"
            className="inspector-reset-transform"
            disabled={selectedNode.mediaKind === 'note'}
            onClick={onResetTransform}
          >
            Reset Transform
          </button>
        </div>
      </div>
    </aside>
  )
}

export default InspectorPanel
