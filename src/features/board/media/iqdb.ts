import type { BoardImage } from "../model";

const IQDB_UPLOAD_URL = "https://www.iqdb.org/";
const IQDB_DEFAULT_SERVICES = ["1", "2", "3", "4", "5", "6", "11", "13"];
const INVALID_FILENAME_CHARACTERS = new Set(['<', '>', ':', '"', '/', "\\", "|", "?", "*"]);

type SearchIqdbOptions = {
  image: BoardImage;
  imageElement?: HTMLImageElement | null;
  videoElement?: HTMLVideoElement | null;
};

const sanitizeBaseName = (value: string | undefined) => {
  const cleaned = (value ?? "image")
    .trim()
    .replace(/\.[^.]+$/u, "")
    .split("")
    .map((character) =>
      INVALID_FILENAME_CHARACTERS.has(character) || character.charCodeAt(0) < 32
        ? "-"
        : character,
    )
    .join("")
    .replace(/\s+/gu, " ")
    .replace(/[. ]+$/u, "");

  return cleaned.length > 0 ? cleaned : "image";
};

const buildPngFileName = (value: string | undefined) =>
  `${sanitizeBaseName(value)}.png`;

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Failed to encode PNG"));
    }, "image/png");
  });

const readBlob = async (source: string) => {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Failed to read media (${response.status})`);
  }

  return response.blob();
};

const readFirstAvailableBlob = async (sources: Array<string | undefined>) => {
  let lastError: unknown = null;

  for (const source of sources) {
    if (!source) {
      continue;
    }

    try {
      return await readBlob(source);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Missing media source");
};

const loadImageElement = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Failed to load image"));
    element.src = source;
  });

const drawImageToPngFile = async (
  source: CanvasImageSource,
  width: number,
  height: number,
  name: string,
) => {
  if (!width || !height) {
    throw new Error("Media is missing dimensions");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create canvas context");
  }

  context.drawImage(source, 0, 0, width, height);
  const blob = await canvasToBlob(canvas);
  return new File([blob], buildPngFileName(name), { type: "image/png" });
};

const createPngFileForImage = async (
  image: BoardImage,
  sourceBlob: Blob,
  imageElement?: HTMLImageElement | null,
) => {
  if (
    image.isGif &&
    !image.gifFreezeSrc &&
    imageElement?.naturalWidth &&
    imageElement?.naturalHeight
  ) {
    return drawImageToPngFile(
      imageElement,
      imageElement.naturalWidth,
      imageElement.naturalHeight,
      image.name,
    );
  }

  const objectUrl = URL.createObjectURL(sourceBlob);

  try {
    const loadedImage = await loadImageElement(objectUrl);
    return drawImageToPngFile(
      loadedImage,
      loadedImage.naturalWidth,
      loadedImage.naturalHeight,
      image.name,
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const createPngFileForVideo = async (
  image: BoardImage,
  videoElement?: HTMLVideoElement | null,
) => {
  if (!videoElement?.videoWidth || !videoElement.videoHeight) {
    throw new Error("Video frame is not ready");
  }

  return drawImageToPngFile(
    videoElement,
    videoElement.videoWidth,
    videoElement.videoHeight,
    image.name,
  );
};

const createIqdbUploadFile = async ({
  image,
  imageElement,
  videoElement,
}: SearchIqdbOptions) => {
  if (image.mediaKind === "note") {
    throw new Error("Notes cannot be searched in IQDB");
  }

  const blob = await readFirstAvailableBlob([
    image.sourceDataUrl,
    image.src,
    image.sourceUrl,
  ]);

  if (blob.type === "image/png") {
    return new File([blob], buildPngFileName(image.name), {
      type: "image/png",
    });
  }

  if (image.mediaKind === "video") {
    return createPngFileForVideo(image, videoElement);
  }

  return createPngFileForImage(image, blob, imageElement);
};

const submitIqdbUpload = (file: File, targetName: string) => {
  const form = document.createElement("form");
  form.method = "post";
  form.action = IQDB_UPLOAD_URL;
  form.enctype = "multipart/form-data";
  form.target = targetName;
  form.style.display = "none";

  const maxFileSize = document.createElement("input");
  maxFileSize.type = "hidden";
  maxFileSize.name = "MAX_FILE_SIZE";
  maxFileSize.value = "8388608";
  form.append(maxFileSize);

  for (const serviceId of IQDB_DEFAULT_SERVICES) {
    const service = document.createElement("input");
    service.type = "hidden";
    service.name = "service[]";
    service.value = serviceId;
    form.append(service);
  }

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.name = "file";

  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  form.append(fileInput);

  document.body.append(form);
  form.submit();
  form.remove();
};

const openPendingIqdbTab = () => {
  const targetName = `iqdb-search-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const tab = window.open("", targetName);

  if (!tab) {
    throw new Error("Unable to open IQDB tab");
  }

  tab.document.title = "IQDB Search";
  tab.document.body.innerHTML =
    "<p style=\"font-family: sans-serif; padding: 24px;\">Preparing IQDB search...</p>";

  return { targetName, tab };
};

export const openIqdbSearchForNode = async (options: SearchIqdbOptions) => {
  const { targetName, tab } = openPendingIqdbTab();

  try {
    const file = await createIqdbUploadFile(options);
    submitIqdbUpload(file, targetName);
  } catch (error) {
    tab.close();
    throw error;
  }
};
