import { useCallback, useEffect, useState } from "react";
import type { BoardImage, HistoryEntry, MediaTransformSettings } from "../model";

type NumericTransformField =
  | "translateX"
  | "translateY"
  | "scaleX"
  | "scaleY"
  | "rotateDeg"
  | "pivotX"
  | "pivotY";

type IntrinsicSize = {
  key: string;
  width: number;
  height: number;
};

type MiddleDragState = {
  field: NumericTransformField;
  startX: number;
  startValue: number;
  step: number;
  min?: number;
  max?: number;
};

type InspectorPanelProps = {
  selectedNode: BoardImage | null;
  historyEntries: HistoryEntry[];
  transformSettings: MediaTransformSettings;
  mediaTransformCss: string;
  mediaTransformOrigin: string;
  onFlipHorizontalChange: (nextValue: boolean) => void;
  onTransformSettingsChange: (
    patch: Partial<MediaTransformSettings>,
  ) => void;
  onResetTransform: () => void;
};

type InspectorHistoryPanelProps = {
  historyEntries: HistoryEntry[];
};

type TransformNumberFieldProps = {
  label: string;
  field: NumericTransformField;
  value: number;
  disabled: boolean;
  step?: number;
  min?: number;
  max?: number;
  dragStep: number;
  onChange: (field: NumericTransformField, value: number) => void;
  onDragStart: (state: MiddleDragState) => void;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded =
    value >= 10 || unitIndex === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
};

const estimateDataUrlSize = (value?: string) => {
  if (!value || !value.startsWith("data:")) {
    return null;
  }

  const base64Index = value.indexOf("base64,");
  if (base64Index === -1) {
    return null;
  }

  const payload = value.slice(base64Index + 7);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
};

function InspectorHistoryPanel({
  historyEntries,
}: InspectorHistoryPanelProps) {
  const [showAllHistory, setShowAllHistory] = useState(false);

  const visibleHistoryEntries = historyEntries
    .filter((entry) => {
      if (entry.visibilityPriority === 2) {
        return false;
      }
      if (!showAllHistory) {
        return entry.visibilityPriority === 0;
      }
      return true;
    })
    .slice(-30)
    .reverse();

  return (
    <div className="inspector-history">
      <div className="inspector-history-header">
        <div className="inspector-tools-title">Session History</div>
        <label className="inspector-history-toggle">
          <input
            type="checkbox"
            checked={showAllHistory}
            onChange={(event) => setShowAllHistory(event.target.checked)}
          />
          Show all
        </label>
      </div>
      <div className="inspector-history-list">
        {visibleHistoryEntries.length === 0 ? (
          <div className="inspector-history-empty">No visible history yet.</div>
        ) : (
          visibleHistoryEntries.map((entry) => (
            <div key={entry.id} className="inspector-history-item">
              <div className="inspector-history-label">{entry.label}</div>
              <div className="inspector-history-time">
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TransformNumberField({
  label,
  field,
  value,
  disabled,
  step,
  min,
  max,
  dragStep,
  onChange,
  onDragStart,
}: TransformNumberFieldProps) {
  return (
    <label className="inspector-param">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => {
          onChange(field, Number(event.currentTarget.value));
        }}
        onPointerDown={(event) => {
          if (event.button !== 1 || disabled) {
            return;
          }
          event.preventDefault();
          onDragStart({
            field,
            startX: event.clientX,
            startValue: value,
            step: dragStep,
            min,
            max,
          });
        }}
      />
    </label>
  );
}

function InspectorPanel({
  selectedNode,
  historyEntries,
  transformSettings,
  mediaTransformCss,
  mediaTransformOrigin,
  onFlipHorizontalChange,
  onTransformSettingsChange,
  onResetTransform,
}: InspectorPanelProps) {
  const [intrinsicSize, setIntrinsicSize] = useState<IntrinsicSize | null>(null);
  const [lockAspect, setLockAspect] = useState(true);
  const [middleDrag, setMiddleDrag] = useState<MiddleDragState | null>(null);
  const selectedMediaKey = selectedNode ? `${selectedNode.id}:${selectedNode.src}` : null;
  const disableTransforms = !selectedNode || selectedNode.mediaKind === "note";

  const applyNumericField = useCallback(
    (field: NumericTransformField, value: number) => {
      if (field === "scaleX" || field === "scaleY") {
        const nextScale = Math.max(0.1, value);
        if (lockAspect) {
          onTransformSettingsChange({
            scaleX: nextScale,
            scaleY: nextScale,
          });
          return;
        }
        onTransformSettingsChange({ [field]: nextScale });
        return;
      }

      if (field === "pivotX" || field === "pivotY") {
        const nextPivot = Math.max(0, Math.min(100, value));
        onTransformSettingsChange({ [field]: nextPivot });
        return;
      }

      onTransformSettingsChange({ [field]: value });
    },
    [lockAspect, onTransformSettingsChange],
  );

  useEffect(() => {
    if (!middleDrag) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - middleDrag.startX;
      let nextValue = middleDrag.startValue + deltaX * middleDrag.step;
      if (middleDrag.min !== undefined) {
        nextValue = Math.max(middleDrag.min, nextValue);
      }
      if (middleDrag.max !== undefined) {
        nextValue = Math.min(middleDrag.max, nextValue);
      }
      applyNumericField(middleDrag.field, nextValue);
    };

    const stopDrag = () => {
      setMiddleDrag(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [applyNumericField, middleDrag]);

  useEffect(() => {
    if (!selectedNode || selectedNode.mediaKind === "note") {
      return;
    }

    if (selectedNode.mediaKind === "image") {
      const image = new Image();
      image.onload = () => {
        setIntrinsicSize({
          key: `${selectedNode.id}:${selectedNode.src}`,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.src = selectedNode.src;
      return;
    }

    const video = document.createElement("video");
    const onLoadedMetadata = () => {
      setIntrinsicSize({
        key: `${selectedNode.id}:${selectedNode.src}`,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.src = selectedNode.src;
    video.preload = "metadata";

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <aside className="inspector-sidebar">
        <div className="inspector-header">Inspector</div>
        <div className="inspector-body">
          <div className="inspector-empty">Select a node to inspect it.</div>
          <InspectorHistoryPanel historyEntries={historyEntries} />
        </div>
      </aside>
    );
  }

  const activeIntrinsicSize =
    intrinsicSize && intrinsicSize.key === selectedMediaKey ? intrinsicSize : null;
  const pixelWidth = activeIntrinsicSize
    ? `${Math.max(1, Math.round(activeIntrinsicSize.width))}px`
    : "Unknown";
  const pixelHeight = activeIntrinsicSize
    ? `${Math.max(1, Math.round(activeIntrinsicSize.height))}px`
    : "Unknown";
  const estimatedBytes = estimateDataUrlSize(
    selectedNode.sourceDataUrl ?? selectedNode.src,
  );
  const sourceValue =
    selectedNode.sourceUrl ?? (selectedNode.sourceDataUrl ? "Embedded" : "Unknown");
  const isSourceLink = Boolean(selectedNode.sourceUrl);

  return (
    <aside className="inspector-sidebar">
      <div className="inspector-header">Inspector</div>
      <div className="inspector-body">
        <div className="inspector-preview">
          {selectedNode.mediaKind === "note" ? (
            <div className="inspector-note-preview">Note</div>
          ) : selectedNode.mediaKind === "video" ? (
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
              src={
                selectedNode.isGif &&
                selectedNode.paused &&
                selectedNode.gifFreezeSrc
                  ? selectedNode.gifFreezeSrc
                  : selectedNode.src
              }
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
                <a
                  href={selectedNode.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
              disabled={disableTransforms}
              onChange={(event) => {
                onFlipHorizontalChange(event.currentTarget.checked);
              }}
            />
            <span>Flip image horizontal</span>
          </label>
          <label className="inspector-tool-toggle">
            <input
              type="checkbox"
              checked={lockAspect}
              disabled={disableTransforms}
              onChange={(event) => {
                setLockAspect(event.currentTarget.checked);
              }}
            />
            <span>Lock Aspect (uniform scale)</span>
          </label>

          <div className="inspector-transform-grid">
            <TransformNumberField
              label="Translate X"
              field="translateX"
              value={transformSettings.translateX}
              disabled={disableTransforms}
              dragStep={1}
              onChange={applyNumericField}
              onDragStart={setMiddleDrag}
            />
            <TransformNumberField
              label="Translate Y"
              field="translateY"
              value={transformSettings.translateY}
              disabled={disableTransforms}
              dragStep={1}
              onChange={applyNumericField}
              onDragStart={setMiddleDrag}
            />
            <TransformNumberField
              label="Scale X"
              field="scaleX"
              value={transformSettings.scaleX}
              disabled={disableTransforms}
              step={0.1}
              min={0.1}
              dragStep={0.01}
              onChange={applyNumericField}
              onDragStart={setMiddleDrag}
            />
            <TransformNumberField
              label="Scale Y"
              field="scaleY"
              value={transformSettings.scaleY}
              disabled={disableTransforms}
              step={0.1}
              min={0.1}
              dragStep={0.01}
              onChange={applyNumericField}
              onDragStart={setMiddleDrag}
            />
            <TransformNumberField
              label="Rotate"
              field="rotateDeg"
              value={transformSettings.rotateDeg}
              disabled={disableTransforms}
              dragStep={0.2}
              onChange={applyNumericField}
              onDragStart={setMiddleDrag}
            />
            <TransformNumberField
              label="Pivot X (%)"
              field="pivotX"
              value={transformSettings.pivotX}
              disabled={disableTransforms}
              min={0}
              max={100}
              dragStep={0.2}
              onChange={applyNumericField}
              onDragStart={setMiddleDrag}
            />
            <TransformNumberField
              label="Pivot Y (%)"
              field="pivotY"
              value={transformSettings.pivotY}
              disabled={disableTransforms}
              min={0}
              max={100}
              dragStep={0.2}
              onChange={applyNumericField}
              onDragStart={setMiddleDrag}
            />
          </div>

          <button
            type="button"
            className="inspector-reset-transform"
            disabled={disableTransforms}
            onClick={onResetTransform}
          >
            Reset Transform
          </button>
        </div>
        <InspectorHistoryPanel historyEntries={historyEntries} />
      </div>
    </aside>
  );
}

export default InspectorPanel;
