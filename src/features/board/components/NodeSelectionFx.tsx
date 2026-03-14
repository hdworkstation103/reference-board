import { SELECTION_SHADER_FS } from '../constants'
import ShaderSurface from './ShaderSurface'

type NodeSelectionFxProps = {
  enabled: boolean
  onDisable: () => void
}

function NodeSelectionFx({ enabled, onDisable }: NodeSelectionFxProps) {
  return (
    enabled ? (
      <ShaderSurface
        fs={SELECTION_SHADER_FS}
        className="shader-selection-layer node-selection-fx"
        onStatusChange={(status) => {
          if (status.validationError) {
            console.warn("Selection shader disabled:", status.validationError)
            onDisable()
          }
          if (status.runtimeError) {
            console.warn("Selection shader disabled:", status.runtimeError)
            onDisable()
          }
          if (status.runtimeWarning) {
            console.warn("Selection shader warning:", status.runtimeWarning)
          }
        }}
      />
    ) : null
  )
}

export default NodeSelectionFx
