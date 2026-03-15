import { useEffect, useSyncExternalStore } from "react";

export type SettingPrimitive = boolean | number | string;

export type SettingsSectionDefinition = {
  id: string;
  label: string;
  description?: string;
  order?: number;
};

type BaseSettingDefinition<
  TValue extends SettingPrimitive,
  TKind extends string,
> = {
  id: string;
  label: string;
  description?: string;
  section: string;
  order?: number;
  defaultValue: TValue;
  kind: TKind;
};

export type BooleanSettingDefinition = BaseSettingDefinition<boolean, "boolean">;

export type NumberSettingDefinition = BaseSettingDefinition<number, "number"> & {
  min?: number;
  max?: number;
  step?: number;
  unitLabel?: string;
};

export type RangeSettingDefinition = BaseSettingDefinition<number, "range"> & {
  min?: number;
  max?: number;
  step?: number;
  unitLabel?: string;
};

export type SelectSettingDefinition = BaseSettingDefinition<string, "select"> & {
  options: Array<{
    label: string;
    value: string;
  }>;
};

export type TextSettingDefinition = BaseSettingDefinition<string, "text"> & {
  placeholder?: string;
};

export type SettingDefinition =
  | BooleanSettingDefinition
  | NumberSettingDefinition
  | RangeSettingDefinition
  | SelectSettingDefinition
  | TextSettingDefinition;

export type SettingsStoreSnapshot = {
  sections: SettingsSectionDefinition[];
  settingIdsBySection: Record<string, string[]>;
  definitions: Record<string, SettingDefinition>;
  values: Record<string, SettingPrimitive>;
};

export type SettingsStore = {
  getSnapshot: () => SettingsStoreSnapshot;
  subscribe: (listener: () => void) => () => void;
  registerSections: (sections: SettingsSectionDefinition[]) => void;
  registerSettings: (definitions: SettingDefinition[]) => void;
  getValue: <TValue extends SettingPrimitive>(
    settingId: string,
  ) => TValue | undefined;
  setValue: (settingId: string, nextValue: SettingPrimitive) => void;
  toggle: (settingId: string) => void;
  reset: (settingId?: string) => void;
};

type CreateSettingsStoreOptions = {
  storageKey?: string;
};

const DEFAULT_SECTION_ID = "general";

const compareOrder = (
  left: { order?: number; label: string },
  right: { order?: number; label: string },
) => {
  const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.label.localeCompare(right.label);
};

const areDefinitionsEqual = (
  left: SettingDefinition | undefined,
  right: SettingDefinition,
) => {
  if (!left) {
    return false;
  }

  if (
    left.id !== right.id ||
    left.kind !== right.kind ||
    left.label !== right.label ||
    left.description !== right.description ||
    left.section !== right.section ||
    left.order !== right.order ||
    left.defaultValue !== right.defaultValue
  ) {
    return false;
  }

  if (left.kind === "boolean" && right.kind === "boolean") {
    return true;
  }

  if (
    (left.kind === "number" || left.kind === "range") &&
    (right.kind === "number" || right.kind === "range")
  ) {
    return (
      left.min === right.min &&
      left.max === right.max &&
      left.step === right.step &&
      left.unitLabel === right.unitLabel
    );
  }

  if (left.kind === "select" && right.kind === "select") {
    if (left.options.length !== right.options.length) {
      return false;
    }

    return left.options.every(
      (option, index) =>
        option.label === right.options[index]?.label &&
        option.value === right.options[index]?.value,
    );
  }

  if (left.kind === "text" && right.kind === "text") {
    return left.placeholder === right.placeholder;
  }

  return false;
};

const buildFallbackSectionLabel = (sectionId: string) =>
  sectionId
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "General";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampNumber = (
  value: number,
  min?: number,
  max?: number,
) => {
  let nextValue = value;

  if (isFiniteNumber(min)) {
    nextValue = Math.max(min, nextValue);
  }

  if (isFiniteNumber(max)) {
    nextValue = Math.min(max, nextValue);
  }

  return nextValue;
};

const normalizeValue = (
  definition: SettingDefinition,
  candidate: unknown,
): SettingPrimitive => {
  if (definition.kind === "boolean") {
    return typeof candidate === "boolean"
      ? candidate
      : definition.defaultValue;
  }

  if (definition.kind === "number" || definition.kind === "range") {
    return isFiniteNumber(candidate)
      ? clampNumber(candidate, definition.min, definition.max)
      : definition.defaultValue;
  }

  if (definition.kind === "select") {
    return definition.options.some((option) => option.value === candidate)
      ? (candidate as string)
      : definition.defaultValue;
  }

  return typeof candidate === "string"
    ? candidate
    : definition.defaultValue;
};

const readStoredValues = (storageKey?: string) => {
  if (!storageKey || typeof window === "undefined") {
    return {} as Record<string, SettingPrimitive>;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {} as Record<string, SettingPrimitive>;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, SettingPrimitive>)
      : {};
  } catch (error) {
    console.warn("Unable to read persisted settings", error);
    return {};
  }
};

const writeStoredValues = (
  storageKey: string | undefined,
  values: Record<string, SettingPrimitive>,
) => {
  if (!storageKey || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(values));
  } catch (error) {
    console.warn("Unable to persist settings", error);
  }
};

export const createSettingsStore = (
  options?: CreateSettingsStoreOptions,
): SettingsStore => {
  const listeners = new Set<() => void>();
  const sectionMap = new Map<string, SettingsSectionDefinition>([
    [
      DEFAULT_SECTION_ID,
      {
        id: DEFAULT_SECTION_ID,
        label: "General",
        order: Number.MAX_SAFE_INTEGER,
      },
    ],
  ]);
  const definitionMap = new Map<string, SettingDefinition>();
  const storedValues = readStoredValues(options?.storageKey);
  const valueMap = new Map<string, SettingPrimitive>(
    Object.entries(storedValues),
  );

  const buildSnapshot = (): SettingsStoreSnapshot => {
    const sections = Array.from(sectionMap.values()).sort(compareOrder);
    const definitions = Array.from(definitionMap.values()).sort(compareOrder);
    const definitionsById: Record<string, SettingDefinition> = {};
    const settingIdsBySection: Record<string, string[]> = Object.fromEntries(
      sections.map((section) => [section.id, []]),
    );

    for (const definition of definitions) {
      definitionsById[definition.id] = definition;
      if (!settingIdsBySection[definition.section]) {
        settingIdsBySection[definition.section] = [];
      }
      settingIdsBySection[definition.section].push(definition.id);
    }

    return {
      sections,
      settingIdsBySection,
      definitions: definitionsById,
      values: Object.fromEntries(valueMap),
    };
  };

  let snapshot = buildSnapshot();

  const emitChange = () => {
    snapshot = buildSnapshot();
    writeStoredValues(options?.storageKey, snapshot.values);
    listeners.forEach((listener) => {
      listener();
    });
  };

  const ensureSection = (sectionId: string) => {
    if (sectionMap.has(sectionId)) {
      return;
    }

    sectionMap.set(sectionId, {
      id: sectionId,
      label: buildFallbackSectionLabel(sectionId),
      order: Number.MAX_SAFE_INTEGER,
    });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    registerSections: (sections) => {
      let didChange = false;

      for (const section of sections) {
        const previous = sectionMap.get(section.id);
        if (
          previous?.label === section.label &&
          previous?.description === section.description &&
          previous?.order === section.order
        ) {
          continue;
        }

        sectionMap.set(section.id, section);
        didChange = true;
      }

      if (didChange) {
        emitChange();
      }
    },
    registerSettings: (definitions) => {
      let didChange = false;

      for (const definition of definitions) {
        ensureSection(definition.section);
        const normalizedValue = normalizeValue(
          definition,
          valueMap.get(definition.id),
        );
        const previousDefinition = definitionMap.get(definition.id);
        const previousValue = valueMap.get(definition.id);

        if (!areDefinitionsEqual(previousDefinition, definition)) {
          definitionMap.set(definition.id, definition);
          didChange = true;
        }

        if (previousValue !== normalizedValue) {
          valueMap.set(definition.id, normalizedValue);
          didChange = true;
        }
      }

      if (didChange) {
        emitChange();
      }
    },
    getValue: <TValue extends SettingPrimitive>(settingId: string) =>
      valueMap.get(settingId) as TValue | undefined,
    setValue: (settingId, nextValue) => {
      const definition = definitionMap.get(settingId);
      if (!definition) {
        return;
      }

      const normalizedValue = normalizeValue(definition, nextValue);
      if (valueMap.get(settingId) === normalizedValue) {
        return;
      }

      valueMap.set(settingId, normalizedValue);
      emitChange();
    },
    toggle: (settingId) => {
      const definition = definitionMap.get(settingId);
      if (!definition || definition.kind !== "boolean") {
        return;
      }

      const currentValue = normalizeValue(definition, valueMap.get(settingId));
      valueMap.set(settingId, !currentValue);
      emitChange();
    },
    reset: (settingId) => {
      if (settingId) {
        const definition = definitionMap.get(settingId);
        if (!definition) {
          return;
        }

        if (valueMap.get(settingId) === definition.defaultValue) {
          return;
        }

        valueMap.set(settingId, definition.defaultValue);
        emitChange();
        return;
      }

      let didChange = false;
      for (const definition of definitionMap.values()) {
        if (valueMap.get(definition.id) !== definition.defaultValue) {
          valueMap.set(definition.id, definition.defaultValue);
          didChange = true;
        }
      }

      if (didChange) {
        emitChange();
      }
    },
  };
};

export const useSettingsSnapshot = (store: SettingsStore) =>
  useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

export const useRegisterSettings = (
  store: SettingsStore,
  definitions: SettingDefinition[],
) => {
  useEffect(() => {
    store.registerSettings(definitions);
  }, [definitions, store]);
};

export const useRegisterSettingsSections = (
  store: SettingsStore,
  sections: SettingsSectionDefinition[],
) => {
  useEffect(() => {
    store.registerSections(sections);
  }, [sections, store]);
};
