import JSZip from "jszip";

import type { BoardImage, NodeMediaItem } from "../model";
import { getMediaItemsForNode } from "./nodeMedia";

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

const padIndex = (value: number) => String(value).padStart(2, "0");

const sanitizeFileSegment = (value: string | undefined, fallback: string) => {
  const cleaned = (value ?? "")
    .trim()
    .split("")
    .map((character) => {
      if (
        character === "<" ||
        character === ">" ||
        character === ":" ||
        character === '"' ||
        character === "/" ||
        character === "\\" ||
        character === "|" ||
        character === "?" ||
        character === "*" ||
        character.charCodeAt(0) < 32
      ) {
        return "-";
      }

      return character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "");

  return cleaned.length > 0 ? cleaned : fallback;
};

const splitFileName = (value: string) => {
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === value.length - 1) {
    return { name: value, extension: "" };
  }

  return {
    name: value.slice(0, dotIndex),
    extension: value.slice(dotIndex + 1),
  };
};

const getExtensionFromMimeType = (mimeType: string) =>
  MIME_EXTENSION_MAP[mimeType.toLowerCase()] ?? "";

const ensureExtension = (name: string, extension: string) =>
  extension.length > 0 && !name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
    ? `${name}.${extension}`
    : name;

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

const getMediaFileName = (
  mediaItem: NodeMediaItem,
  fallbackBaseName: string,
  blob: Blob,
) => {
  const requestedName = sanitizeFileSegment(mediaItem.name, fallbackBaseName);
  const parsed = splitFileName(requestedName);
  const extension =
    parsed.extension || getExtensionFromMimeType(blob.type) || "bin";

  return ensureExtension(parsed.name || fallbackBaseName, extension);
};

const getFrameRootName = (frameName: string) =>
  sanitizeFileSegment(frameName, "frame");

export const downloadFrameAsZip = async (
  frameName: string,
  items: BoardImage[],
) => {
  const zip = new JSZip();
  const rootFolder = getFrameRootName(frameName);
  let downloadedCount = 0;
  const failedEntries: string[] = [];

  for (const [itemIndex, item] of items.entries()) {
    const itemPrefix = `${padIndex(itemIndex + 1)}-${sanitizeFileSegment(
      item.name,
      `node-${itemIndex + 1}`,
    )}`;

    if (item.mediaKind === "note") {
      zip.file(
        `${rootFolder}/${ensureExtension(itemPrefix, "md")}`,
        item.noteMarkdown ?? "",
      );
      downloadedCount += 1;
      continue;
    }

    const mediaItems = getMediaItemsForNode(item);

    if (mediaItems.length === 1) {
      const [mediaItem] = mediaItems;

      try {
        const blob = await readMediaBlob(mediaItem);
        zip.file(
          `${rootFolder}/${padIndex(itemIndex + 1)}-${getMediaFileName(
            mediaItem,
            sanitizeFileSegment(item.name, `media-${itemIndex + 1}`),
            blob,
          )}`,
          blob,
        );
        downloadedCount += 1;
      } catch {
        failedEntries.push(item.name);
      }

      continue;
    }

    for (const [mediaIndex, mediaItem] of mediaItems.entries()) {
      try {
        const blob = await readMediaBlob(mediaItem);
        zip.file(
          `${rootFolder}/${itemPrefix}/${padIndex(mediaIndex + 1)}-${getMediaFileName(
            mediaItem,
            `media-${mediaIndex + 1}`,
            blob,
          )}`,
          blob,
        );
        downloadedCount += 1;
      } catch {
        failedEntries.push(`${item.name} / ${mediaItem.name}`);
      }
    }
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
  URL.revokeObjectURL(href);

  return { downloadedCount, failedEntries } satisfies FrameZipDownloadResult;
};
