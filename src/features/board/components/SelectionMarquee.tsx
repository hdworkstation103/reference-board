import { WORLD_ORIGIN } from '../constants'
import type { MarqueeState } from '../types'

type SelectionMarqueeProps = {
  marquee: MarqueeState
}

function SelectionMarquee({ marquee }: SelectionMarqueeProps) {
  return (
    <div
      className="selection-marquee"
      style={{
        left: `${Math.min(marquee.startX, marquee.currentX) + WORLD_ORIGIN}px`,
        top: `${Math.min(marquee.startY, marquee.currentY) + WORLD_ORIGIN}px`,
        width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
        height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
      }}
    />
  )
}

export default SelectionMarquee
