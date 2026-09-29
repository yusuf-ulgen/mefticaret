import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_BUCKET,
  DEFAULT_STORAGE_PROVIDER,
  RESPONSIVE_WIDTHS,
  buildObjectKey,
  sanitizeFileName,
  type MediaVariant,
} from "@/lib/media-storage";

export type MediaKind = "image" | "video" | "document" | "audio" | "model" | "other";

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  image: "Görsel",
  video: "Video",
  document: "Doküman",
  audio: "Ses",
  model: "3D Model",
  other: "Diğer",
};

/** Desteklenen dosya türleri ve tür başına boyut sınırları. */
export const ACCEPTED_TYPES: Record<string, { kind: MediaKind; maxBytes: number }> = {
  "image/jpeg": { kind: "image", maxBytes: 15 * 1024 * 1024 },
  "image/png": { kind: "image", maxBytes: 15 * 1024 * 1024 },
  "image/webp": { kind: "image", maxBytes: 15 * 1024 * 1024 },
  "image/avif": { kind: "image", maxBytes: 15 * 1024 * 1024 },
  "image/gif": { kind: "image", maxBytes: 15 * 1024 * 1024 },
  "image/svg+xml": { kind: "image", maxBytes: 2 * 1024 * 1024 },
  "video/mp4": { kind: "video", maxBytes: 200 * 1024 * 1024 },
  "video/webm": { kind: "video", maxBytes: 200 * 1024 * 1024 },
  "video/quicktime": { kind: "video", maxBytes: 200 * 1024 * 1024 },
  "application/pdf": { kind: "document", maxBytes: 40 * 1024 * 1024 },
};

export const ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED_TYPES).join(",");

/** Tarayıcıda canvas ile yeniden boyutlandırılabilen türler. */
const RASTER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export type UploadOptions = {
  /** Görselleri WebP'ye çevir (SVG ve GIF hariç). */
  convertToWebp: boolean;
  /** Responsive varyantlar üret. */
  responsive: boolean;
  /** WebP/JPEG kalitesi (0-1). */
  quality: number;
};

export const DEFAULT_UPLOAD_OPTIONS: UploadOptions = {
  convertToWebp: true,
  responsive: true,
  quality: 0.82,
};

export type PreparedUpload = {
  assetId: string;
  fileName: string;
  mimeType: string;
  kind: MediaKind;
  extension: string;
  storagePath: string;
  sizeBytes: number;
  originalSizeBytes: number;
  width: number | null;
  height: number | null;
  optimized: boolean;
  convertedToWebp: boolean;
  variants: MediaVariant[];
};

function extensionFor(mime: string, fallbackName: string) {
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/avif") return "avif";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "application/pdf") return "pdf";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  return (fallbackName.split(".").pop() ?? "bin").toLowerCase().slice(0, 5);
}

async function loadBitmap(file: File) {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image as unknown as ImageBitmap;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderTo(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, width, height);
  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((blob) => resolve(blob), mime, quality),
  );
}

/**
 * Dosyayı doğrular, görselse optimize edip (isteğe bağlı WebP) responsive
 * varyantlarını üretir ve depoya yükler. Depo yolları sağlayıcıdan bağımsız
 * olarak `buildObjectKey` ile üretilir.
 */
export async function uploadMediaFile(
  storeId: string,
  file: File,
  options: UploadOptions = DEFAULT_UPLOAD_OPTIONS,
): Promise<PreparedUpload> {
  const rule = ACCEPTED_TYPES[file.type];
  if (!rule) {
    throw new Error(`${file.name}: desteklenmeyen dosya türü (JPG, PNG, WEBP, SVG, video, PDF)`);
  }
  if (file.size > rule.maxBytes) {
    throw new Error(
      `${file.name}: dosya en fazla ${Math.round(rule.maxBytes / (1024 * 1024))} MB olabilir`,
    );
  }

  const assetId = crypto.randomUUID();
  const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""));

  let mainBlob: Blob = file;
  let mainMime = file.type;
  let width: number | null = null;
  let height: number | null = null;
  let optimized = false;
  let convertedToWebp = false;
  const variants: MediaVariant[] = [];

  if (rule.kind === "image" && RASTER_TYPES.includes(file.type)) {
    const bitmap = await loadBitmap(file);
    width = bitmap.width;
    height = bitmap.height;

    const targetMime = options.convertToWebp ? "image/webp" : file.type;
    const optimizedBlob = await renderTo(bitmap, width, height, targetMime, options.quality);
    if (optimizedBlob && optimizedBlob.size > 0) {
      const smaller = optimizedBlob.size < file.size || targetMime !== file.type;
      if (smaller) {
        mainBlob = optimizedBlob;
        mainMime = targetMime;
        optimized = true;
        convertedToWebp = targetMime === "image/webp" && file.type !== "image/webp";
      }
    }

    if (options.responsive) {
      for (const targetWidth of RESPONSIVE_WIDTHS) {
        if (targetWidth >= width) continue;
        const targetHeight = Math.max(1, Math.round((height / width) * targetWidth));
        const blob = await renderTo(
          bitmap,
          targetWidth,
          targetHeight,
          options.convertToWebp ? "image/webp" : file.type,
          options.quality,
        );
        if (!blob) continue;
        const variantMime = options.convertToWebp ? "image/webp" : file.type;
        const variantPath = buildObjectKey({
          storeId,
          assetId,
          fileName: `${baseName}.${extensionFor(variantMime, file.name)}`,
          variant: `w${targetWidth}`,
        });
        const { error } = await supabase.storage.from(DEFAULT_BUCKET).upload(variantPath, blob, {
          cacheControl: "31536000",
          contentType: variantMime,
          upsert: false,
        });
        if (error) throw new Error(error.message);
        variants.push({
          width: targetWidth,
          height: targetHeight,
          path: variantPath,
          size_bytes: blob.size,
          mime_type: variantMime,
        });
      }
    }
  }

  const extension = extensionFor(mainMime, file.name);
  const fileName = `${baseName}.${extension}`;
  const storagePath = buildObjectKey({ storeId, assetId, fileName });

  const { error } = await supabase.storage.from(DEFAULT_BUCKET).upload(storagePath, mainBlob, {
    cacheControl: "31536000",
    contentType: mainMime,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return {
    assetId,
    fileName,
    mimeType: mainMime,
    kind: rule.kind,
    extension,
    storagePath,
    sizeBytes: mainBlob.size,
    originalSizeBytes: file.size,
    width,
    height,
    optimized,
    convertedToWebp,
    variants,
  };
}

export const UPLOAD_PROVIDER = DEFAULT_STORAGE_PROVIDER;
export const UPLOAD_BUCKET = DEFAULT_BUCKET;

/** Bayt değerini okunabilir metne çevirir. */
export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
