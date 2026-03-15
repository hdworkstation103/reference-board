import { useEffect } from "react";
import { boardSettingsStore } from "../settings";
import SettingsPanel from "./SettingsPanel";

type SettingsPopoverProps = {
  open: boolean;
  onClose: () => void;
};

function SettingsPopover({ open, onClose }: SettingsPopoverProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="settings-popover-backdrop"
      onClick={() => {
        onClose();
      }}
    >
      <section
        className="settings-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-popover-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="settings-popover-chrome">
          <div>
            <h2 id="settings-popover-title" className="settings-popover-title">
              Settings
            </h2>
            <p className="settings-popover-subtitle">
              Global workspace settings registered by app features.
            </p>
          </div>
          <button
            type="button"
            className="settings-popover-close"
            aria-label="Close settings"
            onClick={() => {
              onClose();
            }}
          >
            Close
          </button>
        </div>
        <div className="settings-popover-body">
          <div className="settings-popover-actions">
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
          <SettingsPanel showHeader={false} />
        </div>
      </section>
    </div>
  );
}

export default SettingsPopover;
