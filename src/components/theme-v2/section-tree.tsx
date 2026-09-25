import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { V2_BLOCKS, V2_SECTIONS, type V2BlockType, type V2Section } from "@/lib/theme-v2";
import { cn } from "@/lib/utils";

type Props = {
  sections: V2Section[];
  selectedId: string | null;
  allowHtml: boolean;
  onSelect: (id: string) => void;
  onReorderSections: (from: number, to: number) => void;
  onReorderBlocks: (sectionId: string, from: number, to: number) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string, label: string) => void;
  onAddBlock: (sectionId: string, type: V2BlockType) => void;
  onAddSection: () => void;
};

function useDnd() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Mobilde uzun basış sürüklemeyi başlatır; kaydırma bozulmaz.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function Row({ id, label, depth, selected, visible, onSelect, onToggle, onDelete, extra, expand }: {
  id: string; label: string; depth: 0 | 1; selected: boolean; visible: boolean;
  onSelect: () => void; onToggle: () => void; onDelete: () => void;
  extra?: React.ReactNode; expand?: { open: boolean; toggle: () => void } | undefined;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex min-h-11 items-center gap-1 rounded-lg pr-1 text-sm transition",
        depth === 1 && "ml-6",
        selected ? "bg-primary/10 text-primary" : "hover:bg-muted",
        isDragging && "z-10 bg-card shadow-md",
        !visible && "opacity-50",
      )}
    >
      <button type="button" className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing" aria-label="Sürükle" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      {expand ? (
        <button type="button" onClick={expand.toggle} className="flex size-8 shrink-0 items-center justify-center text-muted-foreground" aria-label={expand.open ? "Daralt" : "Genişlet"}>
          {expand.open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      ) : null}
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate py-2 text-left">{label}</button>
      {extra}
      <button type="button" onClick={onToggle} className="flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={visible ? "Gizle" : "Göster"}>
        {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
      <button type="button" onClick={onDelete} className="flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive" aria-label="Sil">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function BlockList({ section, props }: { section: V2Section; props: Props }) {
  const sensors = useDnd();
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = section.blocks.findIndex((b) => b.id === e.active.id);
    const to = section.blocks.findIndex((b) => b.id === e.over!.id);
    if (from >= 0 && to >= 0) props.onReorderBlocks(section.id, from, to);
  };
  const def = V2_SECTIONS[section.type];
  const allowed = def.blocks.filter((b) => b !== "custom_html" || props.allowHtml);
  return (
    <div className="space-y-0.5 pb-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
        <SortableContext items={section.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {section.blocks.map((b) => (
            <Row key={b.id} id={b.id} depth={1} label={V2_BLOCKS[b.type].label + (b.type === "heading" && b.settings.text ? ` · ${String(b.settings.text).slice(0, 24)}` : "")}
              selected={props.selectedId === b.id} visible={b.visible}
              onSelect={() => props.onSelect(b.id)} onToggle={() => props.onToggle(b.id)} onDelete={() => props.onDelete(b.id, V2_BLOCKS[b.type].label)} />
          ))}
        </SortableContext>
      </DndContext>
      {allowed.length && section.blocks.length < def.maxBlocks ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="ml-6 flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-primary hover:bg-primary/5">
              <Plus className="size-3.5" /> Blok ekle
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            {allowed.map((type) => (
              <DropdownMenuItem key={type} className="min-h-10" onSelect={() => props.onAddBlock(section.id, type)}>
                {V2_BLOCKS[type].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

/** Sol panel: bölümler ve altlarındaki bloklar (iki seviyeli sürükle-sırala). */
export function SectionTree(props: Props) {
  const sensors = useDnd();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = props.sections.findIndex((s) => s.id === e.active.id);
    const to = props.sections.findIndex((s) => s.id === e.over!.id);
    if (from >= 0 && to >= 0) props.onReorderSections(from, to);
  };
  return (
    <div className="space-y-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
        <SortableContext items={props.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {props.sections.map((s) => {
            const def = V2_SECTIONS[s.type];
            const open = !collapsed[s.id];
            return (
              <div key={s.id}>
                <Row id={s.id} depth={0} label={def.label} selected={props.selectedId === s.id} visible={s.visible}
                  onSelect={() => props.onSelect(s.id)} onToggle={() => props.onToggle(s.id)} onDelete={() => props.onDelete(s.id, def.label)}
                  expand={def.maxBlocks > 0 ? { open, toggle: () => setCollapsed((c) => ({ ...c, [s.id]: open })) } : undefined} />
                {def.maxBlocks > 0 && open ? <BlockList section={s} props={props} /> : null}
              </div>
            );
          })}
        </SortableContext>
      </DndContext>
      {props.sections.length === 0 ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">Henüz bölüm yok.</p> : null}
      <Button variant="outline" className="mt-2 h-11 w-full" onClick={props.onAddSection}>
        <Plus className="mr-1.5 size-4" /> Bölüm ekle
      </Button>
    </div>
  );
}

export { arrayMove };
