import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResolvedSection } from "@/lib/theme-sections";

export type DraftSection = {
  id: string;
  isEnabled: boolean;
  section: ResolvedSection;
};

/** Sol panel: sürükle-bırak sıralanabilir bölüm ağacı. */
export function SectionTree({
  items,
  selectedId,
  onSelect,
  onReorder,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  items: DraftSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [dragId, setDragId] = useDragState();

  const handleStart = (event: DragStartEvent) => setDragId(String(event.active.id));
  const handleEnd = (event: DragEndEvent) => {
    setDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map((item) => item.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    onReorder(ids);
  };

  const dragged = items.find((item) => item.id === dragId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setDragId(null)}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={onSelect}
              onToggle={onToggle}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </SortableContext>
      <DragOverlay>
        {dragged ? (
          <div className="rounded-md border border-primary bg-background px-3 py-2 text-sm font-medium shadow-lg">
            {dragged.section.definition.label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function useDragState() {
  const [value, setValue] = useState<string | null>(null);
  return [value, setValue] as const;
}

function SortableRow({
  item,
  selected,
  onSelect,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  item: DraftSection;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 rounded-md border-l-2 bg-background py-1 pr-1",
        selected ? "border-l-primary bg-muted/60" : "border-l-transparent hover:bg-muted/40",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        aria-label="Sürükleyerek sırala"
        className="cursor-grab px-1 text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className="min-w-0 text-left"
        aria-current={selected ? "true" : undefined}
      >
        <span className={cn("block truncate text-sm", !item.isEnabled && "text-muted-foreground line-through")}>
          {item.section.definition.label}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {item.section.definition.slot === "chrome" ? "Tüm sayfalar" : "Ana sayfa"}
        </span>
      </button>
      <div className="flex items-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={item.isEnabled ? "Bölümü gizle" : "Bölümü göster"}
          onClick={() => onToggle(item.id)}
        >
          {item.isEnabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Bölümü çoğalt"
          disabled={!item.section.definition.repeatable}
          onClick={() => onDuplicate(item.id)}
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Bölümü sil"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}
