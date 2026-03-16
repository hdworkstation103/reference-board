import type { BoardImage, NodeMediaItem } from "./board";
import type { GroupBounds, ItemRect } from "./layout";

export type MoveFrameState = {
  kind: "move-frame";
  frameId: number;
  startPointerX: number;
  startPointerY: number;
  startPositions: Record<number, { x: number; y: number }>;
};

export type DragState = {
  kind: "move";
  id: number;
  offsetX: number;
  offsetY: number;
};

export type ResizeState = {
  kind: "resize";
  id: number;
  startWidth: number;
  startPointerX: number;
};

export type GroupMoveState = {
  kind: "move-group";
  ids: number[];
  startPointerX: number;
  startPointerY: number;
  startPositions: Record<number, { x: number; y: number }>;
};

export type GroupResizeState = {
  kind: "resize-group";
  ids: number[];
  startPointerX: number;
  startBounds: GroupBounds;
  startItems: Record<number, { x: number; y: number; width: number }>;
  minScale: number;
};

export type ExtractSlideState = {
  kind: "extract-slide";
  sourceId: number;
  sourceRect: ItemRect;
  offsetX: number;
  offsetY: number;
  sourceWidth: number;
  sourceAspect: number;
  extractedIndex: number;
  extractedMedia: NodeMediaItem;
};

export type InteractionState =
  | DragState
  | ResizeState
  | GroupMoveState
  | GroupResizeState
  | ExtractSlideState
  | MoveFrameState;

export type ScaleModeState = {
  ids: number[];
  centerX: number;
  centerY: number;
  startDistance: number;
  previewScale: number;
  minScale: number;
  startItems: Record<number, { x: number; y: number; width: number }>;
};

export type MoveModeState = {
  ids: number[];
  startPointerX: number;
  startPointerY: number;
  offsetX: number;
  offsetY: number;
  startItems: Record<number, { x: number; y: number; width: number }>;
};

export type PanState = {
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
};

export type MarqueeState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

export type ContextMenuTarget =
  | {
      kind: "board";
      worldX: number;
      worldY: number;
    }
  | {
      kind: "node";
      nodeId: number;
      nodeName: string;
      nodeMediaKind: BoardImage["mediaKind"];
      canUntuckToFrame: boolean;
      previewFrameId: number | null;
      selectedIds: number[];
    }
  | {
      kind: "selection";
      anchorId: number;
      selectedIds: number[];
    }
  | {
      kind: "frame";
      frameId: number;
      frameName: string;
      memberIds: number[];
    };

export type ContextMenuState = {
  x: number;
  y: number;
  target: ContextMenuTarget;
};

export type ContextMenuItem = {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
};

export type ContextMenuSection = {
  title?: string;
  items: ContextMenuItem[];
};
