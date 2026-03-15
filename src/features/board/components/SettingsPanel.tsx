import {
  boardSettingsStore,
  useBoardSettings,
  type BoardSettingDefinition,
} from "../settings";

const renderSettingControl = (
  definition: BoardSettingDefinition,
  controlId: string,
  value: boolean | number | string | undefined,
) => {
  if (definition.kind === "boolean") {
    return (
      <label className="settings-checkbox">
        <input
          id={controlId}
          type="checkbox"
          checked={value === true}
          onChange={(event) => {
            boardSettingsStore.setValue(definition.id, event.currentTarget.checked);
          }}
        />
        <span>{value === true ? "On" : "Off"}</span>
      </label>
    );
  }

  if (definition.kind === "select") {
    return (
      <select
        id={controlId}
        className="settings-select"
        value={typeof value === "string" ? value : definition.defaultValue}
        onChange={(event) => {
          boardSettingsStore.setValue(definition.id, event.currentTarget.value);
        }}
      >
        {definition.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (definition.kind === "text") {
    return (
      <input
        id={controlId}
        className="settings-text"
        type="text"
        value={typeof value === "string" ? value : definition.defaultValue}
        placeholder={definition.placeholder}
        onChange={(event) => {
          boardSettingsStore.setValue(definition.id, event.currentTarget.value);
        }}
      />
    );
  }

  if (definition.kind === "range") {
    const numericValue =
      typeof value === "number" ? value : definition.defaultValue;

    return (
      <div className="settings-range">
        <input
          id={controlId}
          type="range"
          min={definition.min}
          max={definition.max}
          step={definition.step ?? 1}
          value={numericValue}
          onChange={(event) => {
            boardSettingsStore.setValue(
              definition.id,
              Number(event.currentTarget.value),
            );
          }}
        />
        <output>
          {Math.round(numericValue)}
          {definition.unitLabel ? ` ${definition.unitLabel}` : ""}
        </output>
      </div>
    );
  }

  return (
    <input
      id={controlId}
      className="settings-number"
      type="number"
      min={definition.min}
      max={definition.max}
      step={definition.step ?? 1}
      value={typeof value === "number" ? value : definition.defaultValue}
      onChange={(event) => {
        boardSettingsStore.setValue(definition.id, Number(event.currentTarget.value));
      }}
    />
  );
};

type SettingsPanelProps = {
  showHeader?: boolean;
};

function SettingsPanel({ showHeader = true }: SettingsPanelProps) {
  const snapshot = useBoardSettings();

  return (
    <section className="settings-panel" aria-label="Workspace settings panel">
      {showHeader ? (
        <div className="settings-panel-header">
          <div>
            <div className="settings-panel-title">Workspace Settings</div>
            <div className="settings-panel-subtitle">
              Registered settings appear here automatically for any feature that adds
              them to the board settings store.
            </div>
          </div>
          <button
            type="button"
            className="settings-panel-reset"
            onClick={() => {
              boardSettingsStore.reset();
            }}
          >
            Reset All
          </button>
        </div>
      ) : null}

      {snapshot.sections.map((section) => {
        const settingIds = snapshot.settingIdsBySection[section.id] ?? [];
        if (settingIds.length === 0) {
          return null;
        }

        return (
          <section key={section.id} className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-title">{section.label}</div>
              {section.description ? (
                <div className="settings-section-description">
                  {section.description}
                </div>
              ) : null}
            </div>

            <div className="settings-section-body">
              {settingIds.map((settingId) => {
                const definition = snapshot.definitions[settingId];
                if (!definition) {
                  return null;
                }

                const controlId = `setting-${definition.id}`;

                return (
                  <div key={definition.id} className="settings-field">
                    <div className="settings-field-copy">
                      <label className="settings-field-label" htmlFor={controlId}>
                        {definition.label}
                      </label>
                      {definition.description ? (
                        <div className="settings-field-description">
                          {definition.description}
                        </div>
                      ) : null}
                    </div>
                    <div
                      className="settings-field-control"
                    >
                      {renderSettingControl(
                        definition,
                        controlId,
                        snapshot.values[definition.id],
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}

export default SettingsPanel;
