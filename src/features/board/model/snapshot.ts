import { MIN_IMAGE_WIDTH, NOTE_DEFAULT_ASPECT } from "../constants";
import { materializeBoardImageForPersistence } from "../media/io";
import type { BoardFrame, BoardImage, MediaTransformSettings, NodeMediaItem } from "./board";

type SnapshotMedia = {
  id: string;
  name: string;
  mediaKind: "image" | "video";
  isGif: boolean;
  sourceDataUrl?: string;
  sourceUrl?: string;
};

type SnapshotMediaNode = Pick<
  BoardImage,
  "id" | "paused" | "x" | "y" | "width" | "aspect" | "z"
> & {
  kind: "media";
  mediaIds: string[];
  activeMediaIndex: number;
  slideshowPlaying?: boolean;
};

type SnapshotNoteNode = Pick<
  BoardImage,
  "id" | "x" | "y" | "width" | "aspect" | "z"
> & {
  kind: "note";
  name: string;
  noteMarkdown: string;
  noteMode: "editing" | "viewing";
};

type SnapshotNode = SnapshotMediaNode | SnapshotNoteNode;

type PersistedGroup = {
  id: number;
  memberIds: number[];
};

type SnapshotFrameNode = {
  kind: "frame";
  id: number;
  name: string;
  memberIds: number[];
  collapsed: boolean;
  activeMemberIndex: number;
  slideshowPlaying: boolean;
  z: number;
};

type BoardSnapshotV4 = {
  version: 4;
  createdAt: string;
  media: Record<string, SnapshotMedia>;
  nodes: SnapshotNode[];
  groups: PersistedGroup[];
  darkMode: boolean;
};

type BoardSnapshotV5 = {
  version: 5;
  createdAt: string;
  media: Record<string, SnapshotMedia>;
  nodes: SnapshotNode[];
  frames: SnapshotFrameNode[];
  darkMode: boolean;
};

type BoardSnapshotV6 = {
  version: 6;
  createdAt: string;
  media: Record<string, SnapshotMedia>;
  nodes: SnapshotNode[];
  frames: SnapshotFrameNode[];
  mediaTransforms: Record<number, MediaTransformSettings>;
  darkMode: boolean;
};

export type ParsedSnapshot = {
  darkMode: boolean;
  loadedFrames: BoardFrame[];
  loadedImages: BoardImage[];
  loadedMediaTransforms: Record<number, MediaTransformSettings>;
  nextFrameId: number;
  nextId: number;
  nextZ: number;
};

const getSnapshotMediaSignature = (mediaItem: NodeMediaItem) => {
  const sourceDataUrl = mediaItem.sourceDataUrl || mediaItem.src;
  const hasSource =
    typeof mediaItem.sourceUrl === "string" && mediaItem.sourceUrl.length > 0;

  return hasSource
    ? `${mediaItem.mediaKind}:source:${mediaItem.isGif ? "1" : "0"}:${mediaItem.sourceUrl}`
    : `${mediaItem.mediaKind}:data:${mediaItem.isGif ? "1" : "0"}:${sourceDataUrl}`;
};

const getNodeMediaItems = (image: BoardImage): NodeMediaItem[] =>
  image.mediaItems && image.mediaItems.length > 0
    ? image.mediaItems
    : [
        {
          src: image.src,
          sourceDataUrl: image.sourceDataUrl,
          sourceUrl: image.sourceUrl,
          name: image.name,
          mediaKind: image.mediaKind === "video" ? "video" : "image",
          isGif: image.isGif,
        },
      ];

const buildSnapshotNode = (
  image: BoardImage,
  media: Record<string, SnapshotMedia>,
  mediaIdBySignature: Map<string, string>,
): SnapshotNode => {
  if (image.mediaKind === "note") {
    return {
      kind: "note",
      id: image.id,
      name: image.name,
      noteMarkdown: image.noteMarkdown ?? "",
      noteMode: image.noteMode === "editing" ? "editing" : "viewing",
      x: image.x,
      y: image.y,
      width: image.width,
      aspect: image.aspect,
      z: image.z,
    };
  }

  const mediaIds = getNodeMediaItems(image).map((mediaItem) => {
    const signature = getSnapshotMediaSignature(mediaItem);
    let mediaId = mediaIdBySignature.get(signature);

    if (!mediaId) {
      const hasSource =
        typeof mediaItem.sourceUrl === "string" && mediaItem.sourceUrl.length > 0;
      mediaId = `m${mediaIdBySignature.size + 1}`;
      mediaIdBySignature.set(signature, mediaId);
      media[mediaId] = {
        id: mediaId,
        name: mediaItem.name,
        mediaKind: mediaItem.mediaKind,
        isGif: mediaItem.isGif,
        sourceDataUrl: hasSource ? undefined : mediaItem.sourceDataUrl || mediaItem.src,
        sourceUrl: hasSource ? mediaItem.sourceUrl : undefined,
      };
    }

    return mediaId;
  });

  return {
    kind: "media",
    id: image.id,
    mediaIds,
    activeMediaIndex: Math.max(
      0,
      Math.min(image.activeMediaIndex ?? 0, mediaIds.length - 1),
    ),
    slideshowPlaying: Boolean(image.slideshowPlaying),
    paused: image.paused,
    x: image.x,
    y: image.y,
    width: image.width,
    aspect: image.aspect,
    z: image.z,
  };
};

const buildSnapshotFrame = (frame: BoardFrame): SnapshotFrameNode => ({
  kind: "frame",
  id: frame.id,
  name: frame.name,
  memberIds: [...frame.memberIds],
  collapsed: frame.collapsed,
  activeMemberIndex: frame.activeMemberIndex,
  slideshowPlaying: frame.slideshowPlaying,
  z: frame.z,
});

const parseMediaEntry = (
  mediaEntry: Partial<SnapshotMedia>,
): NodeMediaItem | null => {
  if (
    typeof mediaEntry.name !== "string" ||
    (mediaEntry.mediaKind !== "image" && mediaEntry.mediaKind !== "video")
  ) {
    return null;
  }

  const preferredSrc =
    typeof mediaEntry.sourceUrl === "string" && mediaEntry.sourceUrl.length > 0
      ? mediaEntry.sourceUrl
      : typeof mediaEntry.sourceDataUrl === "string"
        ? mediaEntry.sourceDataUrl
        : "";

  return {
    src: preferredSrc,
    sourceDataUrl:
      typeof mediaEntry.sourceDataUrl === "string"
        ? mediaEntry.sourceDataUrl
        : undefined,
    sourceUrl:
      typeof mediaEntry.sourceUrl === "string" ? mediaEntry.sourceUrl : undefined,
    name: mediaEntry.name,
    mediaKind: mediaEntry.mediaKind,
    isGif: Boolean(mediaEntry.isGif),
  };
};

const parseSnapshotNode = (
  node: SnapshotNode,
  mediaMap: Record<string, Partial<SnapshotMedia>>,
): BoardImage | null => {
  if (
    typeof node?.id !== "number" ||
    typeof node?.x !== "number" ||
    typeof node?.y !== "number" ||
    typeof node?.width !== "number" ||
    typeof node?.aspect !== "number" ||
    typeof node?.z !== "number"
  ) {
    return null;
  }

  if (node.kind === "note") {
    if (typeof node.name !== "string" || typeof node.noteMarkdown !== "string") {
      return null;
    }

    return {
      id: node.id,
      src: "",
      sourceDataUrl: "",
      name: node.name,
      mediaKind: "note",
      isGif: false,
      paused: false,
      noteMarkdown: node.noteMarkdown,
      noteMode: node.noteMode === "editing" ? "editing" : "viewing",
      x: node.x,
      y: node.y,
      width: Math.max(MIN_IMAGE_WIDTH, node.width),
      aspect: node.aspect > 0 ? node.aspect : NOTE_DEFAULT_ASPECT,
      z: node.z,
    };
  }

  if (!Array.isArray(node.mediaIds)) {
    return null;
  }

  const mediaItems = node.mediaIds
    .map((mediaId) => mediaMap[mediaId])
    .filter((mediaEntry): mediaEntry is Partial<SnapshotMedia> => Boolean(mediaEntry))
    .map(parseMediaEntry)
    .filter((item): item is NodeMediaItem => item !== null);

  if (mediaItems.length === 0) {
    return null;
  }

  const activeMediaIndex = Math.max(
    0,
    Math.min(node.activeMediaIndex ?? 0, mediaItems.length - 1),
  );
  const activeMedia = mediaItems[activeMediaIndex];

  return {
    id: node.id,
    src: activeMedia.src,
    sourceDataUrl: activeMedia.sourceDataUrl,
    sourceUrl: activeMedia.sourceUrl,
    name: activeMedia.name,
    mediaKind: activeMedia.mediaKind,
    isGif: activeMedia.isGif,
    mediaItems,
    activeMediaIndex,
    slideshowPlaying: Boolean(node.slideshowPlaying),
    paused: Boolean(node.paused),
    x: node.x,
    y: node.y,
    width: Math.max(MIN_IMAGE_WIDTH, node.width),
    aspect: node.aspect > 0 ? node.aspect : 1,
    z: node.z,
  };
};

const parseSnapshotFrame = (
  frame: SnapshotFrameNode,
  validIds: Set<number>,
): BoardFrame | null => {
  if (
    typeof frame?.id !== "number" ||
    typeof frame?.name !== "string" ||
    typeof frame?.z !== "number"
  ) {
    return null;
  }

  const memberIds = Array.isArray(frame.memberIds)
    ? frame.memberIds.filter(
        (id): id is number => typeof id === "number" && validIds.has(id),
      )
    : [];

  if (memberIds.length === 0) {
    return null;
  }

  return {
    id: frame.id,
    name: frame.name,
    memberIds,
    collapsed: Boolean(frame.collapsed),
    activeMemberIndex: Math.max(
      0,
      Math.min(frame.activeMemberIndex ?? 0, memberIds.length - 1),
    ),
    slideshowPlaying: Boolean(frame.slideshowPlaying),
    z: frame.z,
  };
};

const parseLegacyGroup = (
  group: Partial<PersistedGroup>,
  index: number,
  validIds: Set<number>,
  maxImageZ: number,
): BoardFrame | null => {
  const memberIds = Array.isArray(group?.memberIds)
    ? group.memberIds.filter(
        (id): id is number => typeof id === "number" && validIds.has(id),
      )
    : [];

  if (memberIds.length < 2) {
    return null;
  }

  return {
    id: typeof group?.id === "number" ? group.id : index + 1,
    name: `Frame ${index + 1}`,
    memberIds,
    collapsed: false,
    activeMemberIndex: 0,
    slideshowPlaying: false,
    z: maxImageZ + index + 1,
  };
};

const parseMediaTransforms = (
  value: unknown,
  validIds: Set<number>,
): Record<number, MediaTransformSettings> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const next: Record<number, MediaTransformSettings> = {};
  for (const [key, entry] of Object.entries(value)) {
    const id = Number(key);
    if (!Number.isFinite(id) || !validIds.has(id) || !entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as Partial<MediaTransformSettings>;
    if (
      typeof candidate.flipHorizontal !== "boolean" ||
      typeof candidate.translateX !== "number" ||
      typeof candidate.translateY !== "number" ||
      typeof candidate.scaleX !== "number" ||
      typeof candidate.scaleY !== "number" ||
      typeof candidate.rotateDeg !== "number" ||
      typeof candidate.pivotX !== "number" ||
      typeof candidate.pivotY !== "number"
    ) {
      continue;
    }

    next[id] = {
      flipHorizontal: candidate.flipHorizontal,
      translateX: candidate.translateX,
      translateY: candidate.translateY,
      scaleX: candidate.scaleX,
      scaleY: candidate.scaleY,
      rotateDeg: candidate.rotateDeg,
      pivotX: candidate.pivotX,
      pivotY: candidate.pivotY,
    };
  }

  return next;
};

export const buildSnapshot = (
  images: BoardImage[],
  frames: BoardFrame[],
  mediaTransforms: Record<number, MediaTransformSettings>,
  darkMode: boolean,
): BoardSnapshotV6 => {
  const media: Record<string, SnapshotMedia> = {};
  const mediaIdBySignature = new Map<string, string>();

  return {
    version: 6,
    createdAt: new Date().toISOString(),
    media,
    nodes: images.map((image) => buildSnapshotNode(image, media, mediaIdBySignature)),
    frames: frames.map(buildSnapshotFrame),
    mediaTransforms,
    darkMode,
  };
};

export const buildSnapshotWithMaterializedMedia = async (
  images: BoardImage[],
  frames: BoardFrame[],
  mediaTransforms: Record<number, MediaTransformSettings>,
  darkMode: boolean,
) => {
  const materializedImages = await Promise.all(
    images.map((image) => materializeBoardImageForPersistence(image)),
  );

  return buildSnapshot(materializedImages, frames, mediaTransforms, darkMode);
};

export const parseSnapshot = (text: string): ParsedSnapshot => {
  const parsed = JSON.parse(text) as
    | Partial<BoardSnapshotV4>
    | Partial<BoardSnapshotV5>
    | Partial<BoardSnapshotV6>;

  if (
    !parsed ||
    !parsed.media ||
    !Array.isArray(parsed.nodes) ||
    (parsed.version !== 4 && parsed.version !== 5 && parsed.version !== 6)
  ) {
    throw new Error("Unsupported snapshot format");
  }

  const mediaMap = parsed.media as Record<string, Partial<SnapshotMedia>>;
  const loadedImages = (parsed.nodes as SnapshotNode[])
    .map((node) => parseSnapshotNode(node, mediaMap))
    .filter((item): item is BoardImage => item !== null);

  const validIds = new Set(loadedImages.map((item) => item.id));
  const maxImageZ = loadedImages.reduce((max, item) => Math.max(max, item.z), 0);
  const parsedFrames = "frames" in parsed ? parsed.frames : undefined;
  const parsedGroups = "groups" in parsed ? parsed.groups : undefined;
  const parsedMediaTransforms =
    "mediaTransforms" in parsed ? parsed.mediaTransforms : undefined;

  const loadedFrames = Array.isArray(parsedFrames)
    ? parsedFrames
        .map((frame: SnapshotFrameNode) => parseSnapshotFrame(frame, validIds))
        .filter((frame): frame is BoardFrame => frame !== null)
    : Array.isArray(parsedGroups)
      ? parsedGroups
          .map((group: Partial<PersistedGroup>, index: number) =>
            parseLegacyGroup(group, index, validIds, maxImageZ),
          )
          .filter((frame): frame is BoardFrame => frame !== null)
      : [];

  const loadedMediaTransforms = parseMediaTransforms(parsedMediaTransforms, validIds);

  return {
    darkMode: Boolean(parsed.darkMode),
    loadedFrames,
    loadedImages,
    loadedMediaTransforms,
    nextFrameId:
      loadedFrames.reduce((max, frame) => Math.max(max, frame.id), 0) + 1,
    nextId: loadedImages.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    nextZ:
      Math.max(
        maxImageZ,
        loadedFrames.reduce(
          (max: number, frame: BoardFrame) => Math.max(max, frame.z),
          0,
        ),
      ) + 1,
  };
};
