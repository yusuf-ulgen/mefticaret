import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { assetTypeFor, themeManifestSchema, themeReadme, THEME_ZIP_LIMITS, type ThemeAsset, type ThemeManifest } from "@/lib/theme-system-v2";

/** Tarayıcı tarafı zip üretimi / çözümü (sunucu içeriği ayrıca doğrular). */

export function buildThemeZip(input: { manifest: { name: string } & Record<string, unknown>; assets: Array<{ key: string; type: string; value: string | null; url: string | null }>; css: string }): Blob {
  const files: Record<string, Uint8Array> = {
    "theme.json": strToU8(JSON.stringify(input.manifest, null, 2)),
    "README.md": strToU8(themeReadme(input.manifest.name)),
    "assets/theme.generated.css": strToU8(input.css),
  };
  for (const a of input.assets) {
    if (a.value != null) files[`assets/${a.key}`] = strToU8(a.value);
    else if (a.url) files[`assets/${a.key}.url`] = strToU8(a.url);
  }
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer], { type: "application/zip" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export type ParsedThemeZip = { manifest: ThemeManifest; assets: ThemeAsset[]; warnings: string[] };

export async function parseThemeZip(file: File): Promise<ParsedThemeZip> {
  if (file.size > THEME_ZIP_LIMITS.maxBytes) throw new Error("Zip dosyası en fazla 5 MB olabilir.");
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("Zip dosyası okunamadı.");
  }
  const names = Object.keys(entries).filter((n) => !n.endsWith("/") && !n.startsWith("__MACOSX"));
  if (names.length > THEME_ZIP_LIMITS.maxFiles) throw new Error(`Zip en fazla ${THEME_ZIP_LIMITS.maxFiles} dosya içerebilir.`);
  const root = names.find((n) => n === "theme.json" || n.endsWith("/theme.json"));
  if (!root) throw new Error("theme.json bulunamadı.");
  const prefix = root.slice(0, -"theme.json".length);
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(entries[root]!));
  } catch {
    throw new Error("theme.json geçerli bir JSON değil.");
  }
  const parsed = themeManifestSchema.safeParse(json);
  if (!parsed.success) throw new Error(`theme.json şeması hatalı: ${parsed.error.issues[0]?.path.join(".") ?? ""} ${parsed.error.issues[0]?.message ?? ""}`);
  const assets: ThemeAsset[] = [];
  const warnings: string[] = [];
  for (const name of names) {
    if (!name.startsWith(`${prefix}assets/`)) continue;
    let key = name.slice(`${prefix}assets/`.length);
    if (key === "theme.generated.css") continue;
    const isUrl = key.endsWith(".url");
    if (isUrl) key = key.slice(0, -4);
    const type = assetTypeFor(key);
    if (!type || !/^[A-Za-z0-9._/-]{1,120}$/.test(key)) { warnings.push(`${key} atlandı (desteklenmeyen dosya).`); continue; }
    const text = strFromU8(entries[name]!);
    if (type === "css" || type === "js") {
      if (text.length > THEME_ZIP_LIMITS.maxAssetChars) { warnings.push(`${key} çok büyük, atlandı.`); continue; }
      assets.push({ key, type, value: text });
      if (type === "js") warnings.push(`${key}: JS dosyaları saklanır ama vitrine otomatik eklenmez.`);
    } else if (isUrl && /^https:\/\//.test(text.trim())) assets.push({ key, type, url: text.trim() });
    else warnings.push(`${key}: ikili görsel/font dosyaları zip'ten yüklenmez; medya kütüphanesinden ekleyin.`);
  }
  return { manifest: parsed.data, assets, warnings };
}
