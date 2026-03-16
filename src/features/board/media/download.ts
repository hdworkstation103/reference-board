import JSZip from "jszip";

import type { BoardImage, NodeMediaItem } from "../model";
import { getMediaItemsForNode } from "./nodeMedia";

const INVALID_FILENAME_CHARACTERS = new Set([
  "<",
  ">",
  ":",
  '"',
  "/",
  "\\",
  "|",
  "?",
  "*",
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/apng": "apng",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type FrameZipDownloadResult = {
  downloadedCount: number;
  failedEntries: string[];
};

type MediaExportJob = {
  mediaItem: NodeMediaItem;
  failureLabel: string;
  buildPath: (mimeType: string) => string;
};

type MediaExportResult =
  | {
      ok: true;
      path: string;
      blob: Blob;
    }
  | {
      ok: false;
      failureLabel: string;
    };

const padIndex = (value: number) => String(value).padStart(2, "0");

const sanitizeFileSegment = (value: string | undefined, fallback: string) => {
  const cleaned = (value ?? "")
    .trim()
    .split("")
    .map((character) =>
      INVALID_FILENAME_CHARACTERS.has(character) ||
      character.charCodeAt(0) < 32
        ? "-"
        : character,
    )
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "");

  return cleaned.length > 0 ? cleaned : fallback;
};

const splitBaseName = (value: string) => {
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === value.length - 1) {
    return { baseName: value, extension: "" };
  }

  return {
    baseName: value.slice(0, dotIndex),
    extension: value.slice(dotIndex + 1),
  };
};

const resolveMediaFileName = (
  rawName: string | undefined,
  fallbackBaseName: string,
  mimeType: string,
) => {
  const requestedName = sanitizeFileSegment(rawName, fallbackBaseName);
  const { baseName, extension: explicitExtension } = splitBaseName(requestedName);
  const extension =
    explicitExtension || MIME_EXTENSION_MAP[mimeType.toLowerCase()] || "bin";

  return `${baseName}.${extension}`;
};

const getMediaSource = (mediaItem: NodeMediaItem) =>
  mediaItem.sourceDataUrl ?? mediaItem.sourceUrl ?? mediaItem.src;

const readMediaBlob = async (mediaItem: NodeMediaItem) => {
  const source = getMediaSource(mediaItem);
  if (!source) {
    throw new Error("Missing media source");
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Failed to fetch media (${response.status})`);
  }

  return response.blob();
};

const getFrameRootName = (frameName: string) =>
  sanitizeFileSegment(frameName, "frame");

const buildItemPrefix = (itemIndex: number, item: BoardImage) =>
  `${padIndex(itemIndex + 1)}-${sanitizeFileSegment(
    item.name,
    `node-${itemIndex + 1}`,
  )}`;

const buildNotePath = (rootFolder: string, itemIndex: number, item: BoardImage) =>
  `${rootFolder}/${buildItemPrefix(itemIndex, item)}.md`;

const buildSingleMediaPath = (
  rootFolder: string,
  itemIndex: number,
  item: BoardImage,
  mediaItem: NodeMediaItem,
  mimeType: string,
) =>
  `${rootFolder}/${padIndex(itemIndex + 1)}-${resolveMediaFileName(
    mediaItem.name,
    sanitizeFileSegment(item.name, `media-${itemIndex + 1}`),
    mimeType,
  )}`;

const buildMultiMediaPath = (
  rootFolder: string,
  itemPrefix: string,
  mediaIndex: number,
  mediaItem: NodeMediaItem,
  mimeType: string,
) =>
  `${rootFolder}/${itemPrefix}/${padIndex(mediaIndex + 1)}-${resolveMediaFileName(
    mediaItem.name,
    `media-${mediaIndex + 1}`,
    mimeType,
  )}`;

const formatFailedEntryLabel = (
  item: BoardImage,
  mediaItem?: NodeMediaItem,
) => {
  const itemLabel = sanitizeFileSegment(item.name, `node-${item.id}`);
  if (!mediaItem) {
    return itemLabel;
  }

  return `${itemLabel} / ${sanitizeFileSegment(mediaItem.name, `media-${item.id}`)}`;
};

const ensureUniquePath = (path: string, usedPaths: Set<string>) => {
  const slashIndex = path.lastIndexOf("/");
  const directory = slashIndex >= 0 ? path.slice(0, slashIndex + 1) : "";
  const fileName = slashIndex >= 0 ? path.slice(slashIndex + 1) : path;
  const { baseName, extension } = splitBaseName(fileName);

  let candidate = path;
  let duplicateIndex = 2;

  while (usedPaths.has(candidate)) {
    const suffix = ` (${duplicateIndex})`;
    candidate = `${directory}${baseName}${suffix}${
      extension.length > 0 ? `.${extension}` : ""
    }`;
    duplicateIndex += 1;
  }

  usedPaths.add(candidate);
  return candidate;
};

const buildMediaJobs = (rootFolder: string, items: BoardImage[]) => {
  const usedPaths = new Set<string>();
  const mediaJobs: MediaExportJob[] = [];
  const notes: Array<{ path: string; content: string }> = [];

  for (const [itemIndex, item] of items.entries()) {
    if (item.mediaKind === "note") {
      notes.push({
        path: ensureUniquePath(buildNotePath(rootFolder, itemIndex, item), usedPaths),
        content: item.noteMarkdown ?? "",
      });
      continue;
    }

    const mediaItems = getMediaItemsForNode(item);

    if (mediaItems.length === 1) {
      const [mediaItem] = mediaItems;
      mediaJobs.push({
        mediaItem,
        failureLabel: formatFailedEntryLabel(item),
        buildPath: (mimeType: string) =>
          ensureUniquePath(
            buildSingleMediaPath(rootFolder, itemIndex, item, mediaItem, mimeType),
            usedPaths,
          ),
      });
      continue;
    }

    const itemPrefix = buildItemPrefix(itemIndex, item);
    for (const [mediaIndex, mediaItem] of mediaItems.entries()) {
      mediaJobs.push({
        mediaItem,
        failureLabel: formatFailedEntryLabel(item, mediaItem),
        buildPath: (mimeType: string) =>
          ensureUniquePath(
            buildMultiMediaPath(
              rootFolder,
              itemPrefix,
              mediaIndex,
              mediaItem,
              mimeType,
            ),
            usedPaths,
          ),
      });
    }
  }

  return { notes, mediaJobs };
};

const mapWithConcurrency = async <TItem, TResult>(
  items: TItem[],
  limit: number,
  worker: (item: TItem) => Promise<TResult>,
) => {
  if (items.length === 0) {
    return [] as TResult[];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );

  return results;
};

export const downloadFrameAsZip = async (
  frameName: string,
  items: BoardImage[],
) => {
  const zip = new JSZip();
  const rootFolder = getFrameRootName(frameName);
  const { notes, mediaJobs } = buildMediaJobs(rootFolder, items);
  let downloadedCount = 0;
  const failedEntries: string[] = [];

  for (const note of notes) {
    zip.file(note.path, note.content);
    downloadedCount += 1;
  }

  const mediaResults = await mapWithConcurrency(
    mediaJobs,
    4,
    async (job): Promise<MediaExportResult> => {
      try {
        const blob = await readMediaBlob(job.mediaItem);
        return { ok: true, path: job.buildPath(blob.type), blob };
      } catch {
        return { ok: false, failureLabel: job.failureLabel };
      }
    },
  );

  for (const result of mediaResults) {
    if (!result.ok) {
      failedEntries.push(result.failureLabel);
      continue;
    }

    zip.file(result.path, result.blob);
    downloadedCount += 1;
  }

  if (downloadedCount === 0) {
    return { downloadedCount, failedEntries } satisfies FrameZipDownloadResult;
  }

  const archiveBlob = await zip.generateAsync({ type: "blob" });
  const href = URL.createObjectURL(archiveBlob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `${rootFolder}.zip`;
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 0);

  return { downloadedCount, failedEntries } satisfies FrameZipDownloadResult;
};
