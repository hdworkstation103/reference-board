import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  CAPTION_HEIGHT,
  CARD_BORDER_HEIGHT,
  WORLD_ORIGIN,
} from "../constants";
import TexturePreviewSurface from "./TexturePreviewSurface";

type BrightnessNodeProps = {
  x: number;
  y: number;
  width: number;
  bodyHeight: number;
  zIndex: number;
  brightness: number;
  sourceLabel: string | null;
  sourceCanvas: HTMLCanvasElement | null;
  outputCanvas: HTMLCanvasElement | null;
  inputConnected: boolean;
  outputConnected: boolean;
  isDropTarget: boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
  onOutputPointerDown: (event: ReactPointerEvent) => void;
  onBrightnessChange: (value: number) => void;
};

function BrightnessNode({
  x,
  y,
  width,
  bodyHeight,
  zIndex,
  brightness,
  sourceLabel,
  sourceCanvas,
  outputCanvas,
  inputConnected,
  outputConnected,
  isDropTarget,
  onPointerDown,
  onOutputPointerDown,
  onBrightnessChange,
}: BrightnessNodeProps) {
  const hasInput = sourceLabel !== null;

  return (
    <figure
      className={[
        "board-image",
        "node-shell",
        "processor-node-shell",
        isDropTarget ? "is-wire-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        transform: `translate(${x + WORLD_ORIGIN}px, ${y + WORLD_ORIGIN}px)`,
        width: `${width}px`,
        height: `${bodyHeight + CAPTION_HEIGHT + CARD_BORDER_HEIGHT}px`,
        zIndex,
      }}
      onPointerDown={onPointerDown}
    >
      <div
        className={`processor-node-input ${inputConnected ? "is-connected" : ""}`}
        aria-hidden="true"
      />
      <div className="processor-node-body" style={{ height: `${bodyHeight}px` }}>
        <div className="processor-node-preview">
          {outputCanvas ? (
            <TexturePreviewSurface
              className="media-content processor-node-surface"
              source={outputCanvas}
            />
          ) : sourceCanvas ? (
            <TexturePreviewSurface
              className="media-content processor-node-surface"
              source={sourceCanvas}
            />
          ) : (
            <div className="processor-node-placeholder">
              <span className="preview-node-eyebrow">Process</span>
              <strong className="preview-node-title">
                {hasInput ? "Preparing output" : "Awaiting input"}
              </strong>
              <span className="preview-node-copy">
                {hasInput
                  ? "Connected texture is rendering through the processor."
                  : "Connect a media output to drive this node."}
              </span>
            </div>
          )}
        </div>
        <div
          className="processor-node-controls"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <label className="processor-node-label" htmlFor="brightness-node-range">
            Brightness
          </label>
          <input
            id="brightness-node-range"
            className="processor-node-slider"
            type="range"
            min="0.4"
            max="2"
            step="0.05"
            value={brightness}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onBrightnessChange(Number(event.currentTarget.value));
            }}
          />
          <span className="processor-node-value">
            {Math.round(brightness * 100)}%
          </span>
        </div>
      </div>
      <figcaption className="node-footer preview-node-footer">
        <span className="caption-name">Brightness</span>
        <span className="preview-node-source">
          {sourceLabel ?? "No source connected"}
        </span>
      </figcaption>
      <button
        type="button"
        className={`processor-node-output ${outputConnected ? "is-connected" : ""}`}
        onPointerDown={onOutputPointerDown}
        aria-label="Connect brightness output"
      />
    </figure>
  );
}

export default BrightnessNode;
