import {
  createSettingsStore,
  useRegisterSettings,
  useRegisterSettingsSections,
  useSettingsSnapshot,
  type SettingDefinition,
  type SettingPrimitive,
  type SettingsSectionDefinition,
} from "./store";

export type BoardSettingDefinition = SettingDefinition;
export type BoardSettingValue = SettingPrimitive;
export type BoardSettingsSectionDefinition = SettingsSectionDefinition;

export const boardSettingsStore = createSettingsStore({
  storageKey: "reference-board-settings",
});

const BOARD_SETTINGS_SECTIONS: BoardSettingsSectionDefinition[] = [
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme and presentation controls for the workspace.",
    order: 0,
  },
  {
    id: "rendering",
    label: "Rendering",
    description: "Visual effects and compositing behavior.",
    order: 1,
  },
  {
    id: "workspace",
    label: "Workspace",
    description: "Board-level panels and layout preferences.",
    order: 2,
  },
];

const BOARD_SETTINGS: BoardSettingDefinition[] = [
  {
    id: "appearance.darkMode",
    kind: "boolean",
    section: "appearance",
    order: 0,
    label: "Dark mode",
    description: "Switch the board UI between light and dark themes.",
    defaultValue: false,
  },
  {
    id: "rendering.selectionShader",
    kind: "boolean",
    section: "rendering",
    order: 0,
    label: "Selection shader",
    description: "Use shader-based selection effects when the browser supports them.",
    defaultValue: true,
  },
  {
    id: "rendering.shaderCompositing",
    kind: "boolean",
    section: "rendering",
    order: 1,
    label: "Shader compositing",
    description: "Blend shader overlays into media previews and selection treatments.",
    defaultValue: true,
  },
  {
    id: "workspace.inspectorWidth",
    kind: "range",
    section: "workspace",
    order: 0,
    label: "Sidebar width",
    description: "Adjust the width of the inspector and settings sidebar.",
    defaultValue: 300,
    min: 220,
    max: 560,
    step: 10,
    unitLabel: "px",
  },
  {
    id: "workspace.shaderSandbox",
    kind: "boolean",
    section: "workspace",
    order: 1,
    label: "Shader sandbox",
    description: "Open the shader sandbox in place of the board view.",
    defaultValue: false,
  },
];

boardSettingsStore.registerSections(BOARD_SETTINGS_SECTIONS);
boardSettingsStore.registerSettings(BOARD_SETTINGS);

export const registerBoardSettingsSections = (
  sections: BoardSettingsSectionDefinition[],
) => {
  boardSettingsStore.registerSections(sections);
};

export const registerBoardSettings = (settings: BoardSettingDefinition[]) => {
  boardSettingsStore.registerSettings(settings);
};

export const useBoardSettings = () => useSettingsSnapshot(boardSettingsStore);

export const useRegisterBoardSettings = (
  settings: BoardSettingDefinition[],
) => {
  useRegisterSettings(boardSettingsStore, settings);
};

export const useRegisterBoardSettingsSections = (
  sections: BoardSettingsSectionDefinition[],
) => {
  useRegisterSettingsSections(boardSettingsStore, sections);
};

export const useBoardSettingValue = <TValue extends BoardSettingValue>(
  settingId: string,
) => {
  const snapshot = useBoardSettings();
  return snapshot.values[settingId] as TValue | undefined;
};

export const getBoardSettingValue = <TValue extends BoardSettingValue>(
  settingId: string,
) => boardSettingsStore.getValue<TValue>(settingId);

export const setBoardSettingValue = (
  settingId: string,
  nextValue: BoardSettingValue,
) => {
  boardSettingsStore.setValue(settingId, nextValue);
};

export const toggleBoardSettingValue = (settingId: string) => {
  boardSettingsStore.toggle(settingId);
};

export const resetBoardSettingValue = (settingId?: string) => {
  boardSettingsStore.reset(settingId);
};
