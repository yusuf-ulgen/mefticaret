import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadThemeAsset } from "@/lib/theme-media";

import { FieldShell } from "./field-shell";
import { useStudioFieldContext } from "./studio-context";

/** Görsel alanı: dosya yükleme veya adres girme + küçük önizleme. */
export function ImagePickerField({
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
  const context = useStudioFieldContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file || !context) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadThemeAsset(context.storeId, file);
      onChange(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Görsel yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <div className="space-y-2">
        {value ? (
          <div className="relative w-20">
            <img
              src={value}
              alt=""
              loading="lazy"
              className="size-20 rounded-md border border-border object-cover"
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute -right-2 -top-2 size-6"
              onClick={() => onChange("")}
              aria-label="Görseli kaldır"
            >
              <X className="size-3" />
            </Button>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading || !context}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />}
            Yükle
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void pick(event.target.files?.[0])}
          />
        </div>

        <Input
          id={id}
          value={value}
          placeholder="veya görsel adresi"
          onChange={(event) => onChange(event.target.value)}
          className="h-9 text-xs"
        />
      </div>
    </FieldShell>
  );
}
