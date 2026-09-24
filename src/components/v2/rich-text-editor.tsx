import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

/** TipTap tabanlı zengin metin editörü (HTML çıktı). Mobilde büyük dokunma hedefleri. */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Ürün açıklaması…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Link.configure({ openOnClick: false, autolink: true })],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[160px] px-3 py-2 focus:outline-none dark:prose-invert [&_p]:my-1",
        "aria-label": placeholder,
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  const btn = (active: boolean, label: string, onClick: () => void, Icon: typeof Bold) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex flex-wrap gap-0.5 border-b border-border p-1">
        {editor && (
          <>
            {btn(editor.isActive("bold"), "Kalın", () => editor.chain().focus().toggleBold().run(), Bold)}
            {btn(editor.isActive("italic"), "İtalik", () => editor.chain().focus().toggleItalic().run(), Italic)}
            {btn(editor.isActive("heading", { level: 2 }), "Başlık", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2)}
            {btn(editor.isActive("bulletList"), "Madde listesi", () => editor.chain().focus().toggleBulletList().run(), List)}
            {btn(editor.isActive("orderedList"), "Numaralı liste", () => editor.chain().focus().toggleOrderedList().run(), ListOrdered)}
            {btn(editor.isActive("blockquote"), "Alıntı", () => editor.chain().focus().toggleBlockquote().run(), Quote)}
            {btn(editor.isActive("link"), "Bağlantı", () => {
              const prev = editor.getAttributes("link").href as string | undefined;
              const url = window.prompt("Bağlantı adresi", prev ?? "https://");
              if (url === null) return;
              if (!url) editor.chain().focus().unsetLink().run();
              else if (/^https?:\/\//i.test(url)) editor.chain().focus().setLink({ href: url }).run();
            }, Link2)}
            <span className="mx-1 w-px bg-border" />
            {btn(false, "Geri al", () => editor.chain().focus().undo().run(), Undo2)}
            {btn(false, "Yinele", () => editor.chain().focus().redo().run(), Redo2)}
          </>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
