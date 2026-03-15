import { memo, useEffect, useRef, useState } from "react";
import { WORLD_ORIGIN } from "../constants";
import type { BoardFrame, BoardImage, GroupBounds } from "../model";

type FrameNodeProps = {
  frame: BoardFrame;
  bounds: GroupBounds;
  selected: boolean;
  renameRequested: boolean;
  displayZIndex: number;
  activeItem: BoardImage | null;
  previewItems: BoardImage[];
  hiddenCount: number;
  onMovePointerDown: (event: React.PointerEvent, frameId: number) => void;
  onContextMenu: (event: React.MouseEvent, frameId: number) => void;
  onSelect: (frameId: number) => void;
  onRename: (frameId: number, name: string) => void;
  onRenameStateChange: (frameId: number, active: boolean) => void;
  onToggleCollapsed: (frameId: number) => void;
};

type FrameTitleProps = {
  frame: BoardFrame;
  isRenaming: boolean;
  draftName: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onDraftNameChange: (value: string) => void;
  onBeginRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
};

type FrameActionButtonProps = {
  children: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

function FramePreview({ item }: { item: BoardImage | null }) {
  if (!item) {
    return <div className="frame-node-empty">Empty frame</div>;
  }

  if (item.mediaKind === "note") {
    return (
      <div className="frame-node-note-preview">
        {(item.noteMarkdown ?? "Note").slice(0, 160)}
      </div>
    );
  }

  if (item.mediaKind === "video") {
    return (
      <video
        className="frame-node-preview-media"
        src={item.src}
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <img
      className="frame-node-preview-media"
      src={item.src}
      alt={item.name}
      draggable={false}
    />
  );
}

function getSourceLabel(item: BoardImage) {
  if (item.sourceUrl) {
    try {
      return new URL(item.sourceUrl).hostname;
    } catch {
      return item.sourceUrl;
    }
  }

  if (item.sourceDataUrl) {
    return "Embedded";
  }

  return item.mediaKind === "note" ? "Note" : "Local media";
}

function TuckedPreviewRow({ item }: { item: BoardImage }) {
  const thumbnail = item.mediaKind === "note" ? (
    <div className="frame-node-list-thumb frame-node-list-thumb-note">Note</div>
  ) : item.mediaKind === "video" ? (
    <video
      className="frame-node-list-thumb"
      src={item.src}
      muted
      playsInline
      preload="metadata"
    />
  ) : (
    <img
      className="frame-node-list-thumb"
      src={item.isGif && item.paused && item.gifFreezeSrc ? item.gifFreezeSrc : item.src}
      alt={item.name}
      draggable={false}
    />
  );

  return (
    <div className="frame-node-list-row">
      {thumbnail}
      <div className="frame-node-list-copy">
        <div className="frame-node-list-name">{item.name}</div>
        <div className="frame-node-list-source">{getSourceLabel(item)}</div>
      </div>
    </div>
  );
}

function TuckedPreviewList({
  items,
  hiddenCount,
  activeItem,
}: {
  items: BoardImage[];
  hiddenCount: number;
  activeItem: BoardImage | null;
}) {
  if (items.length === 0) {
    return (
      <div className="frame-node-preview-shell">
        <FramePreview item={activeItem} />
      </div>
    );
  }

  const overflowCount = Math.max(0, hiddenCount - items.length);

  return (
    <div className="frame-node-list">
      {items.map((item) => (
        <TuckedPreviewRow key={item.id} item={item} />
      ))}
      {overflowCount > 0 && (
        <div className="frame-node-list-more">+{overflowCount} more tucked</div>
      )}
    </div>
  );
}

function FrameActionButton({ children, onClick }: FrameActionButtonProps) {
  return (
    <button
      type="button"
      className="frame-node-chip"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function FrameTitle({
  frame,
  isRenaming,
  draftName,
  renameInputRef,
  onDraftNameChange,
  onBeginRename,
  onCommitRename,
  onCancelRename,
}: FrameTitleProps) {
  if (isRenaming) {
    return (
      <input
        ref={renameInputRef}
        className="frame-node-title-input"
        value={draftName}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onChange={(event) => {
          onDraftNameChange(event.currentTarget.value);
        }}
        onBlur={onCommitRename}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommitRename();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onCancelRename();
          }
        }}
      />
    );
  }

  return (
    <span
      className="frame-node-title"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onBeginRename();
      }}
    >
      {frame.name}
    </span>
  );
}

function FrameNode({
  frame,
  bounds,
  selected,
  renameRequested,
  displayZIndex,
  activeItem,
  previewItems,
  hiddenCount,
  onMovePointerDown,
  onContextMenu,
  onSelect,
  onRename,
  onRenameStateChange,
  onToggleCollapsed,
}: FrameNodeProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(frame.name);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isRenaming) {
      setDraftName(frame.name);
    }
  }, [frame.name, isRenaming]);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    onRenameStateChange(frame.id, isRenaming);
  }, [frame.id, isRenaming, onRenameStateChange]);

  useEffect(() => {
    if (renameRequested) {
      setIsRenaming(true);
    }
  }, [renameRequested]);

  const commitRename = () => {
    const nextName = draftName.trim();
    if (nextName.length > 0 && nextName !== frame.name) {
      onRename(frame.id, nextName);
    }
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setDraftName(frame.name);
    setIsRenaming(false);
  };

  const sectionStyle = {
    left: `${bounds.left + WORLD_ORIGIN}px`,
    top: `${bounds.top + WORLD_ORIGIN}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    zIndex: displayZIndex,
  };

  const title = (
    <FrameTitle
      frame={frame}
      isRenaming={isRenaming}
      draftName={draftName}
      renameInputRef={renameInputRef}
      onDraftNameChange={setDraftName}
      onBeginRename={() => setIsRenaming(true)}
      onCommitRename={commitRename}
      onCancelRename={cancelRename}
    />
  );

  if (frame.collapsed) {
    return (
      <section
        className={`frame-node frame-node-collapsed ${selected ? "is-selected" : ""}`}
        style={sectionStyle}
        onPointerDown={(event) => {
          onSelect(frame.id);
          if (event.button === 0) {
            onMovePointerDown(event, frame.id);
          }
        }}
        onContextMenu={(event) => onContextMenu(event, frame.id)}
      >
        <header
          className="frame-node-toolbar"
          onPointerDown={(event) => onMovePointerDown(event, frame.id)}
        >
          {title}
          <FrameActionButton
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapsed(frame.id);
            }}
          >
            Untuck
          </FrameActionButton>
        </header>
        <TuckedPreviewList
          items={previewItems}
          hiddenCount={hiddenCount}
          activeItem={activeItem}
        />
        <footer className="frame-node-footer">
          <span className="frame-node-count">{hiddenCount} tucked</span>
          <span className="frame-node-count">Tucked view</span>
        </footer>
      </section>
    );
  }

  return (
    <section
      className={`frame-node frame-node-expanded ${selected ? "is-selected" : ""}`}
      style={sectionStyle}
      onPointerDown={() => onSelect(frame.id)}
      onContextMenu={(event) => onContextMenu(event, frame.id)}
    >
      <header
        className="frame-node-toolbar"
        onPointerDown={(event) => onMovePointerDown(event, frame.id)}
      >
        {title}
        <div className="frame-node-controls">
          <span className="frame-node-count">{frame.memberIds.length} nodes</span>
          <FrameActionButton
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapsed(frame.id);
            }}
          >
            Tuck
          </FrameActionButton>
        </div>
      </header>
    </section>
  );
}

export default memo(FrameNode, (prevProps, nextProps) =>
  prevProps.frame === nextProps.frame &&
  prevProps.bounds.left === nextProps.bounds.left &&
  prevProps.bounds.top === nextProps.bounds.top &&
  prevProps.bounds.width === nextProps.bounds.width &&
  prevProps.bounds.height === nextProps.bounds.height &&
  prevProps.selected === nextProps.selected &&
  prevProps.renameRequested === nextProps.renameRequested &&
  prevProps.displayZIndex === nextProps.displayZIndex &&
  prevProps.activeItem === nextProps.activeItem &&
  prevProps.previewItems === nextProps.previewItems &&
  prevProps.hiddenCount === nextProps.hiddenCount,
);
