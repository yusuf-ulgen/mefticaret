import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadBlogCover } from "@/lib/blog-cover.functions";

/**
 * Blog kapak görseli: dosya seçilir, tarayıcıda 1200x630 sosyal paylaşım
 * oranına otomatik kırpılıp küçültülür, ardından sunucuya yüklenir.
 */

const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 630;

async function resizeToCover(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi");

  const scale = Math.max(TARGET_WIDTH / bitmap.width, TARGET_HEIGHT / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (TARGET_WIDTH - width) / 2, (TARGET_HEIGHT - height) / 2, width, height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.85);
}

export function CoverImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadBlogCover);
  const [busy, setBusy] = useState(false);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      setBusy(true);
      const dataUrl = await resizeToCover(file);
      return upload({ data: { dataUrl, fileName: file.name } });
    },
    onSuccess: (result) => {
      onChange(result.url);
      toast.success("Kapak görseli yüklendi (1200×630)");
    },
    onError: (error: Error) => toast.error(error.message || "Görsel yüklenemedi"),
    onSettled: () => setBusy(false),
  });

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative overflow-hidden rounded-lg border">
          <img src={value} alt="Kapak önizlemesi" className="aspect-[1200/630] w-full object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2"
            aria-label="Kapağı kaldır"
            onClick={() => onChange("")}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (file.size > 15_000_000) {
              toast.error("Dosya çok büyük (en fazla 15 MB)");
              return;
            }
            mutation.mutate(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {busy ? "Yükleniyor…" : "Görsel yükle"}
        </Button>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="veya görsel adresi yapıştır"
          className="h-9 min-w-52 flex-1"
          aria-label="Kapak görseli adresi"
        />
      </div>
    </div>
  );
}
