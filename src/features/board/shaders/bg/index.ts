import { AURORA_DRIFT_SHADER_FS } from './auroraDrift'
import { CONTOUR_FLOW_SHADER_FS } from './contourFlow'
import { LIQUID_METAL_SHADER_FS } from './liquidMetal'
import { NOISE_BLOOM_SHADER_FS } from './noiseBloom'
import { SOFT_CELLS_SHADER_FS } from './softCells'

type BackgroundShaderOption = {
  id: string
  label: string
  fs: string
}

export const BACKGROUND_SHADER_OPTIONS: readonly BackgroundShaderOption[] = [
  {
    id: 'aurora-drift',
    label: 'Aurora Drift',
    fs: AURORA_DRIFT_SHADER_FS,
  },
  {
    id: 'contour-flow',
    label: 'Contour Flow',
    fs: CONTOUR_FLOW_SHADER_FS,
  },
  {
    id: 'soft-cells',
    label: 'Soft Cells',
    fs: SOFT_CELLS_SHADER_FS,
  },
  {
    id: 'liquid-metal',
    label: 'Liquid Metal',
    fs: LIQUID_METAL_SHADER_FS,
  },
  {
    id: 'noise-bloom',
    label: 'Noise Bloom',
    fs: NOISE_BLOOM_SHADER_FS,
  },
]

export const DEFAULT_BACKGROUND_SHADER_ID = BACKGROUND_SHADER_OPTIONS[0].id

export const getBackgroundShaderOption = (id: string) =>
  BACKGROUND_SHADER_OPTIONS.find((option) => option.id === id) ??
  BACKGROUND_SHADER_OPTIONS[0]

export type { BackgroundShaderOption }
