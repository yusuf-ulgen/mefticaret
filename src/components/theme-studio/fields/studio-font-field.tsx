import { useEffect } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FieldShell } from "./field-shell";

export const STUDIO_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Poppins",
  "Montserrat",
  "Raleway",
  "Playfair Display",
  "Merriweather",
  "Source Sans 3",
  "Nunito",
  "Ubuntu",
  "Oswald",
  "Quicksand",
  "Josefin Sans",
  "Crimson Text",
  "DM Sans",
  "Space Grotesk",
  "Outfit",
  "Plus Jakarta Sans",
];

const loaded = new Set<string>();

/** Yazı tipini Google Fonts üzerinden bir kez yükler. */
export function loadStudioFont(font: string) {
  if (!font || loaded.has(font) || typeof document === "undefined") return;
  loaded.add(font);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}:wght@400;500;700&display=swap`;
  document.head.appendChild(link);
}

/** Yazı tipi seçici: seçenekler kendi yazı tipiyle gösterilir. */
export function FontPickerField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help?: string | undefined;
  value: string;
  onChange: (next: string) => void;
}) {
  useEffect(() => {
    for (const font of STUDIO_FONTS) loadStudioFont(font);
  }, []);

  return (
    <FieldShell id={id} label={label} help={help}>
      <Select {...(value ? { value } : {})} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 text-sm" style={{ fontFamily: value || undefined }}>
          <SelectValue placeholder="Yazı tipi seç" />
        </SelectTrigger>
        <SelectContent>
          {STUDIO_FONTS.map((font) => (
            <SelectItem key={font} value={font} className="text-sm" style={{ fontFamily: font }}>
              {font}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}
