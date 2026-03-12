import { Shader } from 'react-shaders'
import { SELECTION_SHADER_FS } from '../constants'

type NodeSelectionFxProps = {
  enabled: boolean
  onDisable: () => void
}

function NodeSelectionFx({ enabled, onDisable }: NodeSelectionFxProps) {
  return (
    <div className="shader-selection-layer node-selection-fx" aria-hidden="true">
      {enabled && (
        <Shader
          fs={SELECTION_SHADER_FS}
          clearColor={[0, 0, 0, 0]}
          style={{ width: '100%', height: '100%' } as never}
          onError={(error) => {
            console.warn('Selection shader disabled:', error)
            onDisable()
          }}
          onWarning={(warning) => {
            if (warning) {
              console.warn('Selection shader warning:', warning)
            }
          }}
        />
      )}
    </div>
  )
}

export default NodeSelectionFx
