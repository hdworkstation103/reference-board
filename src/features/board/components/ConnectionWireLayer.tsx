type WirePoint = {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
  draft?: boolean
}

type ConnectionWireLayerProps = {
  width: number
  height: number
  wires: WirePoint[]
}

const buildWirePath = ({ startX, startY, endX, endY }: Omit<WirePoint, 'id' | 'draft'>) => {
  const deltaX = endX - startX
  const controlOffset = Math.max(72, Math.abs(deltaX) * 0.42)
  const startControlX = startX + controlOffset
  const endControlX = endX - controlOffset

  return `M ${startX} ${startY} C ${startControlX} ${startY}, ${endControlX} ${endY}, ${endX} ${endY}`
}

function ConnectionWireLayer({ width, height, wires }: ConnectionWireLayerProps) {
  if (wires.length === 0) {
    return null
  }

  return (
    <svg
      className="connection-wire-layer"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <defs>
        <filter id="connection-wire-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="rgba(0, 0, 0, 0.22)" />
        </filter>
      </defs>
      {wires.map((wire) => {
        const path = buildWirePath(wire)
        return (
          <g key={wire.id} className={wire.draft ? 'is-draft' : undefined}>
            <path className="connection-wire-shadow" d={path} />
            <path className="connection-wire-path" d={path} />
          </g>
        )
      })}
    </svg>
  )
}

export default ConnectionWireLayer
