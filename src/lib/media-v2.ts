/**
 * Medya Sistemi v2 — tarayıcı tarafı işleme hattı.
 * Doğrulama → (HEIC→JPEG) → yeniden kodlama (EXIF/GPS silinir) → WebP →
 * küçük görseller → blurhash + renk paleti → isteğe bağlı filigran → depo.
 * Video için süre/çözünürlük ve kapak karesi çıkarılır. Sunucu kota/paket
 * kontrolünü `registerMediaAsset` içinde tekrar yapar.
 */
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BUCKET, buildObjectKey, sanitizeFileName, type MediaVariant } from "@/lib/media-storage";

export type MediaKindV2 = "image" | "video" | "document" | "audio" | "model" | "other";

export const MEDIA_KIND_LABELS_V2: Record<MediaKindV2, string> = {
  image: "Görsel",
  video: "Video",
  document: "Belge",
  audio: "Ses",
  model: "3D Model",
  other: "Diğer",
};

const MB = 1024 * 1024;
const LIMITS: Record<MediaKindV2, number> = {
  image: 50 * MB,
  video: 2048 * MB,
  document: 100 * MB,
  audio: 50 * MB,
  model: 100 * MB,
  other: 100 * MB,
};
const RAW_LIMIT = 200 * MB;

const EXT: Record<string, { kind: MediaKindV2; mime: string; raw?: boolean }> = {
  jpg: { kind: "image", mime: "image/jpeg" }, jpeg: { kind: "image", mime: "image/jpeg" },
  jfif: { kind: "image", mime: "image/jpeg" }, png: { kind: "image", mime: "image/png" },
  webp: { kind: "image", mime: "image/webp" }, gif: { kind: "image", mime: "image/gif" },
  bmp: { kind: "image", mime: "image/bmp" }, tif: { kind: "image", mime: "image/tiff" },
  tiff: { kind: "image", mime: "image/tiff" }, heic: { kind: "image", mime: "image/heic" },
  heif: { kind: "image", mime: "image/heif" }, avif: { kind: "image", mime: "image/avif" },
  ico: { kind: "image", mime: "image/x-icon" }, tga: { kind: "image", mime: "image/x-tga" },
  svg: { kind: "image", mime: "image/svg+xml" }, ai: { kind: "image", mime: "application/postscript" },
  eps: { kind: "image", mime: "application/postscript" },
  raw: { kind: "image", mime: "image/x-raw", raw: true }, cr2: { kind: "image", mime: "image/x-canon-cr2", raw: true },
  cr3: { kind: "image", mime: "image/x-canon-cr3", raw: true }, nef: { kind: "image", mime: "image/x-nikon-nef", raw: true },
  arw: { kind: "image", mime: "image/x-sony-arw", raw: true }, dng: { kind: "image", mime: "image/x-adobe-dng", raw: true },
  orf: { kind: "image", mime: "image/x-olympus-orf", raw: true },
  mp4: { kind: "video", mime: "video/mp4" }, webm: { kind: "video", mime: "video/webm" },
  mov: { kind: "video", mime: "video/quicktime" }, avi: { kind: "video", mime: "video/x-msvideo" },
  mkv: { kind: "video", mime: "video/x-matroska" }, wmv: { kind: "video", mime: "video/x-ms-wmv" },
  flv: { kind: "video", mime: "video/x-flv" }, "3gp": { kind: "video", mime: "video/3gpp" },
  ogv: { kind: "video", mime: "video/ogg" }, m4v: { kind: "video", mime: "video/x-m4v" },
  ts: { kind: "video", mime: "video/mp2t" }, mts: { kind: "video", mime: "video/mp2t" },
  mpeg: { kind: "video", mime: "video/mpeg" }, mpg: { kind: "video", mime: "video/mpeg" },
  mp3: { kind: "audio", mime: "audio/mpeg" }, aac: { kind: "audio", mime: "audio/aac" },
  wav: { kind: "audio", mime: "audio/wav" }, flac: { kind: "audio", mime: "audio/flac" },
  ogg: { kind: "audio", mime: "audio/ogg" }, m4a: { kind: "audio", mime: "audio/mp4" },
  pdf: { kind: "document", mime: "application/pdf" },
  doc: { kind: "document", mime: "application/msword" },
  docx: { kind: "document", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xls: { kind: "document", mime: "application/vnd.ms-excel" },
  xlsx: { kind: "document", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  ppt: { kind: "document", mime: "application/vnd.ms-powerpoint" },
  pptx: { kind: "document", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  txt: { kind: "document", mime: "text/plain" }, csv: { kind: "document", mime: "text/csv" },
  zip: { kind: "document", mime: "application/zip" }, rar: { kind: "document", mime: "application/vnd.rar" },
  xml: { kind: "document", mime: "application/xml" }, json: { kind: "document", mime: "application/json" },
  glb: { kind: "model", mime: "model/gltf-binary" }, gltf: { kind: "model", mime: "model/gltf+json" },
  obj: { kind: "model", mime: "model/obj" }, stl: { kind: "model", mime: "model/stl" },
};

const BLOCKED = new Set(["exe", "msi", "bat", "cmd", "com", "scr", "sh", "ps1", "vbs", "jar", "apk", "dll", "app", "js", "php", "html", "htm"]);

export const ACCEPT_ATTRIBUTE_V2 = Object.keys(EXT).map((e) => `.${e}`).join(",");

/** Tarayıcının çözebildiği (canvas'a çizilebilen) türler. */
const DECODABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/bmp", "image/x-icon", "image/gif"]);

export type Watermark = {
  is_active: boolean;
  watermark_type: "text" | "image";
  text_content: string | null;
  imageUrl?: string | null;
  color: string;
  opacity: number;
  size_percent: number;
  position: string;
  margin_x: number;
  margin_y: number;
};

export type FileProgress = { name: string; status: "queued" | "processing" | "uploading" | "done" | "blocked" | "failed"; message?: string };

function extOf(name: string) {
  return (name.split(".").pop() ?? "").toLowerCase();
}

/** Dosya türü, boyut ve imza (çalıştırılabilir başlık) kontrolü. */
export async function validateMediaFile(file: File) {
  const ext = extOf(file.name);
  if (BLOCKED.has(ext)) throw new Error(`${file.name}: güvenlik nedeniyle engellendi`);
  const rule = EXT[ext];
  if (!rule) throw new Error(`${file.name}: desteklenmeyen dosya türü`);
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isExe = head[0] === 0x4d && head[1] === 0x5a;
  const isElf = head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46;
  if (isExe || isElf) throw new Error(`${file.name}: çalıştırılabilir dosya içeriği engellendi`);
  const limit = rule.raw ? RAW_LIMIT : LIMITS[rule.kind];
  if (file.size > limit) throw new Error(`${file.name}: en fazla ${Math.round(limit / MB)} MB olabilir`);
  return { ext, ...rule };
}

async function toBitmap(blob: Blob): Promise<ImageBitmap> {
  return await createImageBitmap(blob);
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function encode(c: HTMLCanvasElement, mime: string, q: number) {
  return new Promise<Blob | null>((r) => c.toBlob((b) => r(b), mime, q));
}

async function drawScaled(bmp: ImageBitmap, maxW: number, maxH: number, mode: "cover" | "contain") {
  const scale = mode === "cover" ? Math.max(maxW / bmp.width, maxH / bmp.height) : Math.min(1, maxW / bmp.width, maxH / bmp.height);
  const w = mode === "cover" ? maxW : Math.max(1, Math.round(bmp.width * scale));
  const h = mode === "cover" ? maxH : Math.max(1, Math.round(bmp.height * scale));
  const c = canvas(w, h);
  const ctx = c.getContext("2d")!;
  const dw = bmp.width * scale;
  const dh = bmp.height * scale;
  ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}

const hex = (n: number) => n.toString(16).padStart(2, "0");

/** 5 renklik palet + baskın renk + şeffaflık (basit kuantalama). */
function analyze(bmp: ImageBitmap) {
  const c = canvas(64, 64);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, 64, 64);
  const px = ctx.getImageData(0, 0, 64, 64).data;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  let transparent = false;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 250) transparent = true;
    if (px[i + 3]! < 128) continue;
    const key = `${px[i]! >> 5}-${px[i + 1]! >> 5}-${px[i + 2]! >> 5}`;
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += px[i]!; b.g += px[i + 1]!; b.b += px[i + 2]!;
    buckets.set(key, b);
  }
  const palette = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((b) => `#${hex(Math.round(b.r / b.n))}${hex(Math.round(b.g / b.n))}${hex(Math.round(b.b / b.n))}`);
  return { palette, dominant: palette[0] ?? null, transparent };
}

async function blurhashOf(bmp: ImageBitmap) {
  const { encode: bh } = await import("blurhash");
  const c = canvas(32, 32);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, 32, 32);
  return bh(ctx.getImageData(0, 0, 32, 32).data, 32, 32, 4, 3);
}

async function loadImage(url: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return img;
}

/** Filigranı tuvale uygular. */
export async function applyWatermark(c: HTMLCanvasElement, wm: Watermark) {
  const ctx = c.getContext("2d")!;
  ctx.save();
  ctx.globalAlpha = wm.opacity;
  const targetW = (c.width * wm.size_percent) / 100;
  let mark: { w: number; h: number; draw: (x: number, y: number) => void };
  if (wm.watermark_type === "image" && wm.imageUrl) {
    const img = await loadImage(wm.imageUrl);
    const h = (img.height / img.width) * targetW;
    mark = { w: targetW, h, draw: (x, y) => ctx.drawImage(img, x, y, targetW, h) };
  } else {
    const text = wm.text_content ?? "";
    let size = 12;
    ctx.font = `600 ${size}px sans-serif`;
    const base = ctx.measureText(text).width || 1;
    size = Math.max(10, (12 * targetW) / base);
    ctx.font = `600 ${size}px sans-serif`;
    ctx.fillStyle = wm.color;
    ctx.textBaseline = "top";
    mark = { w: ctx.measureText(text).width, h: size, draw: (x, y) => ctx.fillText(text, x, y) };
  }
  if (wm.position === "tile") {
    for (let y = wm.margin_y; y < c.height; y += mark.h * 3) for (let x = wm.margin_x; x < c.width; x += mark.w * 1.6) mark.draw(x, y);
  } else {
    const [v, h] = wm.position === "center" ? ["center", "center"] : wm.position.split("_");
    const x = h === "left" ? wm.margin_x : h === "right" ? c.width - mark.w - wm.margin_x : (c.width - mark.w) / 2;
    const y = v === "top" ? wm.margin_y : v === "bottom" ? c.height - mark.h - wm.margin_y : (c.height - mark.h) / 2;
    mark.draw(x, y);
  }
  ctx.restore();
}

async function put(path: string, blob: Blob, contentType: string) {
  const { error } = await supabase.storage.from(DEFAULT_BUCKET).upload(path, blob, {
    cacheControl: "31536000",
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
}

function videoInfo(file: File) {
  return new Promise<{ duration: number | null; width: number | null; height: number | null; poster: Blob | null }>((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "metadata";
    v.src = url;
    const done = (poster: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve({ duration: Number.isFinite(v.duration) ? Math.round(v.duration) : null, width: v.videoWidth || null, height: v.videoHeight || null, poster });
    };
    v.onerror = () => done(null);
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(1, (v.duration || 1) / 2);
    };
    v.onseeked = async () => {
      try {
        const c = canvas(Math.min(1280, v.videoWidth), Math.round(Math.min(1280, v.videoWidth) * (v.videoHeight / v.videoWidth)));
        c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
        done(await encode(c, "image/webp", 0.8));
      } catch {
        done(null);
      }
    };
    setTimeout(() => done(null), 15000);
  });
}

/** Mevcut bir tuvalden (düzenleyici çıktısı) yükleme için Blob üretir. */
export function canvasToFile(c: HTMLCanvasElement, name: string) {
  return encode(c, "image/png", 0.95).then((b) => new File([b!], name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" }));
}

/**
 * Tek dosyayı işler, depoya yükler ve `registerMediaAsset` için yük döndürür.
 */
export async function processAndUpload(
  storeId: string,
  file: File,
  opts: { watermark: Watermark | null; quality?: number; sourceAssetId?: string | null },
) {
  const info = await validateMediaFile(file);
  const assetId = crypto.randomUUID();
  const base = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""));
  const key = (name: string, variant?: string) => buildObjectKey(variant ? { storeId, assetId, fileName: name, variant } : { storeId, assetId, fileName: name });
  const q = opts.quality ?? 0.85;

  let main: Blob = file;
  let mainMime = info.mime;
  let width: number | null = null;
  let height: number | null = null;
  let optimized = false;
  let webp = false;
  let stripped = false;
  let watermarked = false;
  const thumbs: { sm: string | null; md: string | null; lg: string | null } = { sm: null, md: null, lg: null };
  let poster: string | null = null;
  let blurhash: string | null = null;
  let analysis = { palette: [] as string[], dominant: null as string | null, transparent: false };
  let duration: number | null = null;
  let extra = 0;
  const variants: MediaVariant[] = [];
  const animated = info.ext === "gif";

  let decodable: Blob | null = DECODABLE.has(info.mime) && !animated ? file : null;
  if (info.ext === "heic" || info.ext === "heif") {
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    decodable = Array.isArray(out) ? out[0]! : out;
  }

  if (info.kind === "image" && decodable) {
    const bmp = await toBitmap(decodable);
    width = bmp.width;
    height = bmp.height;
    analysis = analyze(bmp);
    blurhash = await blurhashOf(bmp).catch(() => null);
    const full = canvas(bmp.width, bmp.height);
    full.getContext("2d")!.drawImage(bmp, 0, 0);
    if (opts.watermark?.is_active) {
      await applyWatermark(full, opts.watermark);
      watermarked = true;
    }
    const webpBlob = await encode(full, "image/webp", q);
    if (webpBlob && (webpBlob.size < file.size || watermarked || decodable !== file)) {
      main = webpBlob;
      mainMime = "image/webp";
      webp = true;
      optimized = true;
    }
    stripped = true;
    const finalBmp = watermarked ? await toBitmap(await encode(full, "image/png", 1).then((b) => b!)) : bmp;
    for (const [size, name, mode] of [[150, "sm", "cover"], [400, "md", "cover"], [800, "lg", "contain"]] as const) {
      const c = await drawScaled(finalBmp, size, size, mode);
      const b = await encode(c, "image/webp", 0.8);
      if (!b) continue;
      const p = key(`${base}.webp`, `t${name}`);
      await put(p, b, "image/webp");
      thumbs[name] = p;
      extra += b.size;
    }
    for (const w of [640, 1200]) {
      if (w >= finalBmp.width) continue;
      const c = await drawScaled(finalBmp, w, 99999, "contain");
      const b = await encode(c, "image/webp", q);
      if (!b) continue;
      const p = key(`${base}.webp`, `w${w}`);
      await put(p, b, "image/webp");
      variants.push({ width: c.width, height: c.height, path: p, size_bytes: b.size, mime_type: "image/webp" });
    }
  } else if (info.kind === "video") {
    const v = await videoInfo(file);
    duration = v.duration;
    width = v.width;
    height = v.height;
    if (v.poster) {
      const p = key(`${base}.webp`, "poster");
      await put(p, v.poster, "image/webp");
      poster = p;
      extra += v.poster.size;
      const bmp = await toBitmap(v.poster);
      const c = await drawScaled(bmp, 400, 400, "cover");
      const tb = await encode(c, "image/webp", 0.8);
      if (tb) {
        const tp = key(`${base}.webp`, "tmd");
        await put(tp, tb, "image/webp");
        thumbs.md = tp;
        extra += tb.size;
      }
    }
  }

  const ext = mainMime === "image/webp" && webp ? "webp" : info.ext;
  const fileName = `${base}.${ext}`;
  const storagePath = key(fileName);
  await put(storagePath, main, mainMime);

  return {
    fileName,
    mimeType: mainMime,
    kind: info.kind,
    extension: ext,
    storagePath,
    sizeBytes: main.size,
    originalSizeBytes: file.size,
    width,
    height,
    optimized,
    convertedToWebp: webp && info.mime !== "image/webp",
    variants,
    v2: {
      originalFilename: file.name.slice(0, 300),
      originalFormat: info.ext,
      thumbSm: thumbs.sm,
      thumbMd: thumbs.md,
      thumbLg: thumbs.lg,
      poster,
      blurhash,
      dominantColor: analysis.dominant,
      palette: analysis.palette,
      hasTransparency: analysis.transparent,
      isAnimated: animated,
      metadataStripped: stripped,
      watermarkApplied: watermarked,
      durationSeconds: duration,
      sourceAssetId: opts.sourceAssetId ?? null,
      extraBytes: extra,
    },
  };
}
