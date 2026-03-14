import { useDeferredValue, useState } from "react";
import { MEDIA_SHINE_SHADER_FS } from "../constants";
import ShaderSurface, { type ShaderSurfaceStatus } from "./ShaderSurface";

type ShaderSandboxProps = {
  darkMode: boolean;
};

function ShaderSandbox({ darkMode }: ShaderSandboxProps) {
  const [source, setSource] = useState(MEDIA_SHINE_SHADER_FS.trim());
  const deferredSource = useDeferredValue(source);
  const [status, setStatus] = useState<ShaderSurfaceStatus>({
    ready: false,
    validationError: null,
    runtimeError: null,
    runtimeWarning: null,
  });

  const isValid = status.ready && !status.validationError && !status.runtimeError;

  return (
    <section className="shader-sandbox-page">
      <div className="shader-sandbox-layout">
        <div className="shader-sandbox-panel">
          <div className="shader-sandbox-header">
            <div>
              <h2 className="shader-sandbox-title">Shader Sandbox</h2>
              <p className="shader-sandbox-subtitle">
                Paste a fragment shader in `react-shaders` `mainImage` format.
              </p>
            </div>
            <button
              type="button"
              className="shader-sandbox-reset"
              onClick={() => {
                setSource(MEDIA_SHINE_SHADER_FS.trim());
              }}
            >
              Reset to Shine Shader
            </button>
          </div>

          <label
            className="shader-sandbox-editor-label"
            htmlFor="shader-sandbox-editor"
          >
            Fragment Shader
          </label>
          <textarea
            id="shader-sandbox-editor"
            className="shader-sandbox-editor"
            spellCheck={false}
            value={source}
            onChange={(event) => {
              setSource(event.currentTarget.value);
            }}
          />

          <div
            className={`shader-sandbox-status ${isValid ? "is-valid" : "is-invalid"}`}
          >
            <div className="shader-sandbox-status-label">
              {isValid ? "Shader compiled successfully." : "Shader compile failed."}
            </div>
            <pre className="shader-sandbox-log">
              {status.validationError ??
                status.runtimeError ??
                status.runtimeWarning ??
                (status.ready ? "No validation errors." : "Validating shader...")}
            </pre>
          </div>
        </div>

        <div className="shader-sandbox-preview-panel">
          <div className="shader-sandbox-preview-header">
            <div className="shader-sandbox-preview-title">Preview</div>
            <div className="shader-sandbox-preview-note">
              {darkMode ? "Dark theme" : "Light theme"}
            </div>
          </div>
          <div className="shader-sandbox-preview-frame">
            <div className="shader-sandbox-preview-media">
              <img
                src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"
                alt="Shader sandbox preview"
                draggable={false}
              />
              <ShaderSurface
                fs={deferredSource}
                className="media-shine-layer shader-sandbox-preview-shader"
                onStatusChange={setStatus}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ShaderSandbox;
