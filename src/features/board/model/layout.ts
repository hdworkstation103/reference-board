import type { BoardFrame } from "./board";

export type ItemRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type GroupBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type GroupOverlayState = {
  bounds: GroupBounds;
  active: boolean;
};

export type PersistentGroupView = {
  id: number;
  memberIds: number[];
  bounds: GroupBounds;
};

export type FrameView = {
  id: number;
  frame: BoardFrame;
  bounds: GroupBounds;
};
