import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { GROUP_LABELS, type StudioGroup, type StudioItem } from "./studio-model";

function Row({
  item,
  active,
  onSelect,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  item: StudioItem;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1 rounded-lg border px-1.5 py-1.5 text-sm",
        active ? "border-primary/60 bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/50",
        isDragging && "opacity-70 shadow-sm",
        !item.isEnabled && "opacity-60",
      )}
    >
      <button
        type="button"
        className="cursor-grab p-0.5 text-muted-foreground/70 hover:text-foreground"
        aria-label={`${item.section.definition.label} bölümünü taşı`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate text-left">
        <span className="block truncate font-medium">{item.section.definition.label}</span>
      </button>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={onToggle}
          aria-label={item.isEnabled ? "Bölümü gizle" : "Bölümü göster"}
        >
          {item.isEnabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </Button>
        {item.section.definition.repeatable ? (
          <Button size="icon" variant="ghost" className="size-7" onClick={onDuplicate} aria-label="Bölümü çoğalt">
            <Copy className="size-3.5" />
          </Button>
        ) : null}
        <Button size="icon" variant="ghost" className="size-7" onClick={onDelete} aria-label="Bölümü sil">
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </li>
  );
}

/** Bir grup (üst alan / gövde / alt alan) içindeki sürükle-bırak bölüm listesi. */
export function StudioSectionList({
  group,
  items,
  selectedId,
  onSelect,
  onReorder,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  group: StudioGroup;
  items: StudioItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map((item) => item.id);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    onReorder(next);
  };

  return (
    <section className="space-y-1">
      <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {GROUP_LABELS[group]}
      </h3>
      {items.length === 0 ? (
        <p className="px-2 pb-1 text-xs text-muted-foreground">Bu alanda bölüm yok.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  active={item.id === selectedId}
                  onSelect={() => onSelect(item.id)}
                  onToggle={() => onToggle(item.id)}
                  onDuplicate={() => onDuplicate(item.id)}
                  onDelete={() => onDelete(item.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
