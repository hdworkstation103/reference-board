import type { GraphConnection } from "../graph";

export type NodeMediaItem = {
  src: string;
  sourceDataUrl?: string;
  sourceUrl?: string;
  name: string;
  mediaKind: "image" | "video";
  isGif: boolean;
};

export type BoardImage = {
  id: number;
  graphNodeId?: string;
  src: string;
  sourceDataUrl?: string;
  sourceUrl?: string;
  name: string;
  mediaKind: "image" | "video" | "note";
  isGif: boolean;
  paused: boolean;
  gifFreezeSrc?: string;
  mediaItems?: NodeMediaItem[];
  activeMediaIndex?: number;
  slideshowPlaying?: boolean;
  noteMarkdown?: string;
  noteMode?: "editing" | "viewing";
  x: number;
  y: number;
  width: number;
  aspect: number;
  z: number;
};

export type BoardFrame = {
  id: number;
  name: string;
  memberIds: number[];
  collapsed: boolean;
  activeMemberIndex: number;
  slideshowPlaying: boolean;
  z: number;
};

export type MediaTransformSettings = {
  flipHorizontal: boolean;
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotateDeg: number;
  pivotX: number;
  pivotY: number;
};

export type PreparedMedia = Pick<
  BoardImage,
  | "id"
  | "src"
  | "sourceDataUrl"
  | "name"
  | "mediaKind"
  | "isGif"
  | "paused"
  | "z"
>;

export type MediaTimeline = {
  current: number;
  duration: number;
};

export type GraphNodeParamValue = string | number | boolean;

export type GraphNodeInstance = {
  id: string;
  definitionId: string;
  x: number;
  y: number;
  width: number;
  z: number;
  params?: Record<string, GraphNodeParamValue>;
};

export type BoardDocument = {
  images: BoardImage[];
  frames: BoardFrame[];
  graphNodes: GraphNodeInstance[];
  connections: GraphConnection[];
  mediaTransforms: Record<number, MediaTransformSettings>;
  darkMode: boolean;
};
