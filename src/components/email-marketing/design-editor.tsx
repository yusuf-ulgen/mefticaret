import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Monitor, Plus, Smartphone, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BLOCK_KINDS,
  BLOCK_LABELS,
  MERGE_TAGS,
  defaultBlock,
  renderEmailHtml,
  type BlockKind,
  type EmailBlock,
  type ProductCard,
} from "@/lib/email-marketing";

/**
 * Sürükle-bırak e-posta editörü: solda blok listesi ve ayarlar,
 * sağda canlı önizleme (mobil / masaüstü).
 */

const SAMPLE_PRODUCTS: ProductCard[] = [
  { title: "Örnek ürün 1", price: "349,00 ₺", url: "#", imageUrl: null },
  { title: "Örnek ürün 2", price: "499,00 ₺", url: "#", imageUrl: null },
  { title: "Örnek ürün 3", price: "199,00 ₺", url: "#", imageUrl: null },
  { title: "Örnek ürün 4", price: "1.249,00 ₺", url: "#", imageUrl: null },
];

export type DesignDraft = {
  name: string;
  subject: string;
  previewText: string;
  accentColor: string;
  blocks: EmailBlock[];
};

function SortableBlock({
  block,
  active,
  onSelect,
  onRemove,
}: {
  block: EmailBlock;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${active ? "border-brand bg-brand/5" : "border-border bg-card"} ${isDragging ? "opacity-70" : ""}`}
    >
      <button type="button" aria-label="Bloğu taşı" className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="flex-1 truncate text-left text-sm">
        <span className="font-medium">{BLOCK_LABELS[block.kind]}</span>
        {block.text ? <span className="ml-2 text-xs text-muted-foreground">{block.text.slice(0, 28)}</span> : null}
      </button>
      <Button size="icon" variant="ghost" aria-label="Bloğu sil" onClick={onRemove}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function DesignEditor({
  value,
  onChange,
  storeName,
}: {
  value: DesignDraft;
  onChange: (next: DesignDraft) => void;
  storeName: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(value.blocks[0]?.id ?? null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [addKind, setAddKind] = useState<BlockKind>("text");

  const selected = value.blocks.find((block) => block.id === selectedId) ?? null;

  const patchBlock = (patch: Partial<EmailBlock>) => {
    if (!selected) return;
    onChange({
      ...value,
      blocks: value.blocks.map((block) => (block.id === selected.id ? { ...block, ...patch } : block)),
    });
  };

  const html = useMemo(
    () =>
      renderEmailHtml(
        { blocks: value.blocks, accentColor: value.accentColor, previewText: value.previewText },
        {
          vars: {
            "customer.first_name": "Ayşe",
            musteri_adi: "Ayşe",
            magaza_adi: storeName,
            magaza_linki: "#",
            "discount.code": "HOSGELDIN10",
            unsubscribe_url: "#",
            "product.last_viewed": "Örnek ürün 1",
          },
          products: SAMPLE_PRODUCTS,
          cartItems: SAMPLE_PRODUCTS.slice(0, 2),
        },
      ),
    [value.blocks, value.accentColor, value.previewText, storeName],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = value.blocks.findIndex((block) => block.id === active.id);
    const to = value.blocks.findIndex((block) => block.id === over.id);
    if (from < 0 || to < 0) return;
    const next = [...value.blocks];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onChange({ ...value, blocks: next });
  };

  const insertTag = (tag: string) => {
    if (!selected) return;
    patchBlock({ text: `${selected.text ?? ""}${tag}` });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="design-name">Tasarım adı</Label>
            <Input id="design-name" value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="design-accent">Vurgu rengi</Label>
            <Input
              id="design-accent"
              type="color"
              value={value.accentColor}
              onChange={(event) => onChange({ ...value, accentColor: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="design-subject">Konu başlığı</Label>
            <Input id="design-subject" value={value.subject} onChange={(event) => onChange({ ...value, subject: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="design-preview">Ön izleme metni</Label>
            <Input
              id="design-preview"
              value={value.previewText}
              onChange={(event) => onChange({ ...value, previewText: event.target.value })}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <Select value={addKind} onValueChange={(next) => setAddKind(next as BlockKind)}>
              <SelectTrigger className="h-9 flex-1" aria-label="Eklenecek blok">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {BLOCK_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                const block = defaultBlock(addKind);
                onChange({ ...value, blocks: [...value.blocks, block] });
                setSelectedId(block.id);
              }}
            >
              <Plus className="mr-2 size-4" /> Blok ekle
            </Button>
          </div>
          <DndContext collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
            <SortableContext items={value.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {value.blocks.map((block) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    active={block.id === selectedId}
                    onSelect={() => setSelectedId(block.id)}
                    onRemove={() => {
                      onChange({ ...value, blocks: value.blocks.filter((item) => item.id !== block.id) });
                      if (selectedId === block.id) setSelectedId(null);
                    }}
                  />
                ))}
                {value.blocks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Henüz blok eklenmedi.</p>
                ) : null}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {selected ? (
          <div className="space-y-3 rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-semibold">{BLOCK_LABELS[selected.kind]} ayarları</p>
            <div className="space-y-1.5">
              <Label htmlFor="block-text">Metin</Label>
              <Textarea
                id="block-text"
                rows={3}
                value={selected.text ?? ""}
                onChange={(event) => patchBlock({ text: event.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="block-subtext">Alt metin</Label>
                <Input id="block-subtext" value={selected.subtext ?? ""} onChange={(event) => patchBlock({ subtext: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="block-href">Bağlantı</Label>
                <Input id="block-href" value={selected.href ?? ""} onChange={(event) => patchBlock({ href: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="block-image">Görsel adresi</Label>
                <Input id="block-image" value={selected.imageUrl ?? ""} onChange={(event) => patchBlock({ imageUrl: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="block-code">İndirim kodu</Label>
                <Input id="block-code" value={selected.code ?? ""} onChange={(event) => patchBlock({ code: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="block-align">Hizalama</Label>
                <Select value={selected.align ?? "center"} onValueChange={(next) => patchBlock({ align: next as "left" | "center" | "right" })}>
                  <SelectTrigger id="block-align" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Sola</SelectItem>
                    <SelectItem value="center">Ortaya</SelectItem>
                    <SelectItem value="right">Sağa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="block-deadline">Geri sayım bitişi</Label>
                <Input
                  id="block-deadline"
                  type="datetime-local"
                  value={selected.deadline ?? ""}
                  onChange={(event) => patchBlock({ deadline: event.target.value })}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Dinamik alanlar</p>
              <div className="flex flex-wrap gap-1.5">
                {MERGE_TAGS.map((item) => (
                  <button key={item.tag} type="button" onClick={() => insertTag(item.tag)}>
                    <Badge variant="secondary" className="cursor-pointer">
                      {item.label}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Canlı önizleme</p>
          <div className="flex gap-1">
            <Button size="icon" variant={device === "desktop" ? "default" : "outline"} aria-label="Masaüstü önizleme" onClick={() => setDevice("desktop")}>
              <Monitor className="size-4" />
            </Button>
            <Button size="icon" variant={device === "mobile" ? "default" : "outline"} aria-label="Mobil önizleme" onClick={() => setDevice("mobile")}>
              <Smartphone className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex justify-center rounded-xl border border-border bg-muted/30 p-3">
          <iframe
            title="E-posta önizleme"
            srcDoc={html}
            className="h-[640px] w-full rounded-lg border border-border bg-white"
            style={device === "mobile" ? { maxWidth: 390 } : undefined}
          />
        </div>
      </div>
    </div>
  );
}
