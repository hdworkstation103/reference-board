import { WORLD_ORIGIN } from '../constants'
import type { GroupOverlayState, PersistentGroupView } from '../types'

type GroupOverlaysProps = {
  persistentGroups: PersistentGroupView[]
  groupOverlay: GroupOverlayState | null
  selectedCount: number
  onPersistentGroupMove: (event: React.PointerEvent, ids: number[]) => void
  onPersistentGroupResize: (event: React.PointerEvent, ids: number[], bounds: PersistentGroupView['bounds']) => void
  onSelectedGroupMove: (event: React.PointerEvent) => void
  onSelectedGroupResize: (event: React.PointerEvent) => void
}

function GroupOverlays({
  persistentGroups,
  groupOverlay,
  selectedCount,
  onPersistentGroupMove,
  onPersistentGroupResize,
  onSelectedGroupMove,
  onSelectedGroupResize,
}: GroupOverlaysProps) {
  return (
    <>
      {persistentGroups.map((group) => (
        <div
          key={group.id}
          className="group-container persistent"
          style={{
            left: `${group.bounds.left + WORLD_ORIGIN}px`,
            top: `${group.bounds.top + WORLD_ORIGIN}px`,
            width: `${group.bounds.width}px`,
            height: `${group.bounds.height}px`,
          }}
        >
          <button
            type="button"
            className="group-move-handle persistent-group-handle"
            onPointerDown={(event) => onPersistentGroupMove(event, group.memberIds)}
            aria-label={`Move persistent group ${group.id}`}
          >
            Group ({group.memberIds.length})
          </button>
          <button
            type="button"
            className="group-resize-handle persistent-group-handle"
            onPointerDown={(event) => onPersistentGroupResize(event, group.memberIds, group.bounds)}
            aria-label={`Resize persistent group ${group.id}`}
          />
        </div>
      ))}

      {groupOverlay && (
        <div
          className={`group-container ${groupOverlay.active ? 'active' : 'inactive'}`}
          style={{
            left: `${groupOverlay.bounds.left + WORLD_ORIGIN}px`,
            top: `${groupOverlay.bounds.top + WORLD_ORIGIN}px`,
            width: `${groupOverlay.bounds.width}px`,
            height: `${groupOverlay.bounds.height}px`,
          }}
        >
          {groupOverlay.active && (
            <>
              <button
                type="button"
                className="group-move-handle"
                onPointerDown={onSelectedGroupMove}
                aria-label="Move selected group"
              >
                Group ({selectedCount})
              </button>
              <button
                type="button"
                className="group-resize-handle"
                onPointerDown={onSelectedGroupResize}
                aria-label="Resize selected group"
              />
            </>
          )}
        </div>
      )}
    </>
  )
}

export default GroupOverlays
