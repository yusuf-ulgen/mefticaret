/**
 * Blog Sistemi v2 zengin düzenleyicisi (Tiptap). Sabit/kompakt araç çubuğu,
 * "/" komutları, görsel yükleme, video, tablo, bilgi kutuları, ürün/koleksiyon
 * kartları ve otomatik içindekiler.
 */

import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Youtube from "@tiptap/extension-youtube";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Anchor,
  Bold,
  CheckCircle2,
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTree,
  Loader2,
  Minus,
  Package,
  Quote,
  Redo2,
  ShoppingBag,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { toast } from "sonner";

import { EmbedPicker } from "@/components/blog/embed-picker";
import { Callout, EmbedCard, TocBlock, type EmbedAttrs } from "@/components/blog/blog-editor-nodes";
import { uploadStoreBlogImage } from "@/lib/blog-v2.functions";
import { cn } from "@/lib/utils";

export async function resizeImage(file: File, maxWidth = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

type Command = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  run: (editor: Editor) => void;
};

export function BlogEditor({
  storeId,
  storeSlug,
  value,
  onChange,
}: {
  storeId: string;
  storeSlug: string | null;
  value: string;
  onChange: (html: string) => void;
}) {
  const upload = useServerFn(uploadStoreBlogImage);
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [picker, setPicker] = useState<"product" | "collection" | null>(null);
  const [slash, setSlash] = useState<{ query: string; top: number; left: number; from: number } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder: "Yazınızı buraya yazın veya yapıştırın. / yazarak blok ekleyebilirsiniz." }),
      Image.configure({ HTMLAttributes: { loading: "lazy" } }),
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Callout,
      EmbedCard,
      TocBlock,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "blog-prose min-h-[320px] px-3 py-3 focus:outline-none sm:px-5",
        "aria-label": "Yazı içeriği",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.isEmpty ? "" : e.getHTML());
      detectSlash(e);
    },
    onSelectionUpdate: ({ editor: e }) => detectSlash(e),
  });

  function detectSlash(e: Editor) {
    const { $from, empty } = e.state.selection;
    if (!empty) return setSlash(null);
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
    const match = /(?:^|\s)\/([a-z0-9]*)$/i.exec(before);
    if (!match || !wrapRef.current) return setSlash(null);
    const coords = e.view.coordsAtPos($from.pos);
    const box = wrapRef.current.getBoundingClientRect();
    setSlash({
      query: (match[1] ?? "").toLowerCase(),
      top: coords.bottom - box.top + 4,
      left: Math.min(coords.left - box.left, box.width - 240),
      from: $from.pos - (match[1]?.length ?? 0) - 1,
    });
    setSlashIndex(0);
  }

  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  const insertImage = async (file: File) => {
    if (!editor) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error("Yalnız JPG, PNG veya WEBP yükleyebilirsiniz");
    if (file.size > 15_000_000) return toast.error("Dosya çok büyük (en fazla 15 MB)");
    setUploading(true);
    try {
      const dataUrl = await resizeImage(file);
      const result = await upload({ data: { storeId, dataUrl, fileName: file.name } });
      const alt = window.prompt("Görsel alt metni (SEO ve erişilebilirlik için)", file.name.replace(/\.[a-z]+$/i, "")) ?? "";
      editor.chain().focus().setImage({ src: result.url, alt }).run();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görsel yüklenemedi");
    } finally {
      setUploading(false);
    }
  };

  const addVideo = (e: Editor) => {
    const url = window.prompt("YouTube veya Vimeo bağlantısı", "https://");
    if (!url) return;
    if (/youtu\.?be/.test(url)) e.chain().focus().setYoutubeVideo({ src: url }).run();
    else {
      const id = /vimeo\.com\/(\d+)/.exec(url)?.[1];
      if (!id) return toast.error("Geçerli bir YouTube veya Vimeo bağlantısı girin");
      e.chain().focus().insertContent(`<p><iframe src="https://player.vimeo.com/video/${id}" width="640" height="360" allowfullscreen="true"></iframe></p>`).run();
    }
  };

  const addLink = (e: Editor) => {
    const prev = e.getAttributes("link")["href"] as string | undefined;
    const url = window.prompt("Bağlantı adresi (iç bağlantı için /s/... ile başlayabilir)", prev ?? "https://");
    if (url === null) return;
    if (!url) e.chain().focus().unsetLink().run();
    else if (/^(https?:\/\/|\/|#)/i.test(url)) e.chain().focus().setLink({ href: url }).run();
    else toast.error("Bağlantı https://, / veya # ile başlamalı");
  };

  const addAnchor = (e: Editor) => {
    const id = window.prompt("Çapa adı (ör. kargo-bilgisi)");
    if (!id) return;
    const clean = id.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40);
    e.chain().focus().setLink({ href: `#${clean}` }).run();
  };

  const COMMANDS: Command[] = [
    { key: "h1", label: "Başlık 1", icon: Heading1, run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: "h2", label: "Başlık 2", icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "h3", label: "Başlık 3", icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: "bold", label: "Kalın metin", icon: Bold, run: (e) => e.chain().focus().toggleBold().run() },
    { key: "image", label: "Görsel", icon: ImagePlus, run: () => fileRef.current?.click() },
    { key: "video", label: "Video", icon: Video, run: addVideo },
    { key: "table", label: "Tablo", icon: TableIcon, run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { key: "quote", label: "Alıntı", icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run() },
    { key: "code", label: "Kod bloğu", icon: Code, run: (e) => e.chain().focus().toggleCodeBlock().run() },
    { key: "list", label: "Madde listesi", icon: List, run: (e) => e.chain().focus().toggleBulletList().run() },
    { key: "numbered", label: "Numaralı liste", icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run() },
    { key: "task", label: "Görev listesi", icon: CheckSquare, run: (e) => e.chain().focus().toggleTaskList().run() },
    { key: "divider", label: "Ayraç", icon: Minus, run: (e) => e.chain().focus().setHorizontalRule().run() },
    { key: "info", label: "Bilgi kutusu", icon: Info, run: (e) => e.chain().focus().setCallout("info").run() },
    { key: "warning", label: "Uyarı kutusu", icon: AlertTriangle, run: (e) => e.chain().focus().setCallout("warning").run() },
    { key: "success", label: "Başarı kutusu", icon: CheckCircle2, run: (e) => e.chain().focus().setCallout("success").run() },
    { key: "product", label: "Ürün kartı", icon: ShoppingBag, run: () => setPicker("product") },
    { key: "collection", label: "Koleksiyon", icon: Package, run: () => setPicker("collection") },
    { key: "toc", label: "İçindekiler", icon: ListTree, run: (e) => e.chain().focus().insertToc().run() },
  ];

  const filtered = slash ? COMMANDS.filter((c) => c.key.startsWith(slash.query) || c.label.toLocaleLowerCase("tr").includes(slash.query)) : [];

  const runSlash = (cmd: Command) => {
    if (!editor || !slash) return;
    editor.chain().focus().deleteRange({ from: slash.from, to: editor.state.selection.from }).run();
    setSlash(null);
    cmd.run(editor);
  };

  const btn = (active: boolean, label: string, onClick: () => void, Icon: ComponentType<{ className?: string }>) => (
    <button
      key={label}
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );

  return (
    <div ref={wrapRef} className="relative rounded-xl border border-input bg-background">
      <div className="sticky top-0 z-10 flex gap-0.5 overflow-x-auto rounded-t-xl border-b border-border bg-background/95 p-1 backdrop-blur sm:flex-wrap">
        {editor ? (
          <>
            {btn(editor.isActive("heading", { level: 1 }), "Başlık 1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1)}
            {btn(editor.isActive("heading", { level: 2 }), "Başlık 2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2)}
            {btn(editor.isActive("heading", { level: 3 }), "Başlık 3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), Heading3)}
            <span className="mx-1 w-px shrink-0 bg-border" />
            {btn(editor.isActive("bold"), "Kalın", () => editor.chain().focus().toggleBold().run(), Bold)}
            {btn(editor.isActive("italic"), "İtalik", () => editor.chain().focus().toggleItalic().run(), Italic)}
            {btn(editor.isActive("underline"), "Altı çizili", () => editor.chain().focus().toggleUnderline().run(), UnderlineIcon)}
            {btn(editor.isActive("blockquote"), "Alıntı", () => editor.chain().focus().toggleBlockquote().run(), Quote)}
            {btn(editor.isActive("codeBlock"), "Kod", () => editor.chain().focus().toggleCodeBlock().run(), Code)}
            <span className="mx-1 w-px shrink-0 bg-border" />
            {btn(editor.isActive("bulletList"), "Madde listesi", () => editor.chain().focus().toggleBulletList().run(), List)}
            {btn(editor.isActive("orderedList"), "Numaralı liste", () => editor.chain().focus().toggleOrderedList().run(), ListOrdered)}
            {btn(editor.isActive("taskList"), "Görev listesi", () => editor.chain().focus().toggleTaskList().run(), CheckSquare)}
            <span className="mx-1 w-px shrink-0 bg-border" />
            {btn(false, uploading ? "Yükleniyor" : "Görsel", () => fileRef.current?.click(), uploading ? Loader2 : ImagePlus)}
            {btn(false, "Video", () => addVideo(editor), Video)}
            {btn(editor.isActive("table"), "Tablo", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), TableIcon)}
            {btn(false, "Ayraç", () => editor.chain().focus().setHorizontalRule().run(), Minus)}
            <span className="mx-1 w-px shrink-0 bg-border" />
            {btn(false, "Bilgi kutusu", () => editor.chain().focus().setCallout("info").run(), Info)}
            {btn(false, "Uyarı kutusu", () => editor.chain().focus().setCallout("warning").run(), AlertTriangle)}
            {btn(false, "Başarı kutusu", () => editor.chain().focus().setCallout("success").run(), CheckCircle2)}
            {btn(false, "Ürün kartı", () => setPicker("product"), ShoppingBag)}
            {btn(false, "Koleksiyon", () => setPicker("collection"), Package)}
            {btn(false, "İçindekiler", () => editor.chain().focus().insertToc().run(), ListTree)}
            <span className="mx-1 w-px shrink-0 bg-border" />
            {btn(editor.isActive("link"), "Bağlantı", () => addLink(editor), Link2)}
            {btn(false, "Çapa bağlantısı", () => addAnchor(editor), Anchor)}
            <span className="mx-1 w-px shrink-0 bg-border" />
            {btn(false, "Geri al", () => editor.chain().focus().undo().run(), Undo2)}
            {btn(false, "Yinele", () => editor.chain().focus().redo().run(), Redo2)}
          </>
        ) : null}
      </div>

      {editor?.isActive("table") ? (
        <div className="flex flex-wrap gap-1 border-b p-1 text-xs">
          {[
            ["Satır ekle", () => editor.chain().focus().addRowAfter().run()],
            ["Sütun ekle", () => editor.chain().focus().addColumnAfter().run()],
            ["Satırı sil", () => editor.chain().focus().deleteRow().run()],
            ["Sütunu sil", () => editor.chain().focus().deleteColumn().run()],
            ["Tabloyu sil", () => editor.chain().focus().deleteTable().run()],
          ].map(([label, fn]) => (
            <button key={label as string} type="button" className="rounded-md border px-2 py-1 hover:bg-muted" onClick={fn as () => void}>
              {label as string}
            </button>
          ))}
        </div>
      ) : null}

      <EditorContent
        editor={editor}
        onKeyDown={(event) => {
          if (!slash || !filtered.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSlashIndex((i) => (i + 1) % filtered.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setSlashIndex((i) => (i - 1 + filtered.length) % filtered.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            runSlash(filtered[slashIndex]!);
          } else if (event.key === "Escape") setSlash(null);
        }}
      />

      {slash && filtered.length ? (
        <div
          className="absolute z-20 max-h-72 w-60 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
          style={{ top: slash.top, left: Math.max(4, slash.left) }}
          role="listbox"
        >
          {filtered.map((cmd, i) => (
            <button
              key={cmd.key}
              type="button"
              role="option"
              aria-selected={i === slashIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runSlash(cmd)}
              className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", i === slashIndex && "bg-muted")}
            >
              <cmd.icon className="size-4 text-muted-foreground" />
              <span className="flex-1">{cmd.label}</span>
              <span className="text-xs text-muted-foreground">/{cmd.key}</span>
            </button>
          ))}
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void insertImage(file);
        }}
      />

      <EmbedPicker
        storeId={storeId}
        storeSlug={storeSlug}
        kind={picker}
        onClose={() => setPicker(null)}
        onPick={(attrs: EmbedAttrs) => {
          editor?.chain().focus().insertEmbedCard(attrs).run();
          setPicker(null);
        }}
      />
    </div>
  );
}
