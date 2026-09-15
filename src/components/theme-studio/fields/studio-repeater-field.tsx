import { useEffect, useMemo, useRef, useState } from "react";
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
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FieldShell } from "./field-shell";

/**
 * Satır bazlı blok düzenleyici. Değer, alt alta satırlar olarak saklanır;
 * her satırın kolonları " | " ile ayrılır. Kolon adları yardım metnindeki
 * "Her satır: A | B | C" kalıbından okunur.
 */
function parseColumns(help: string | undefined) {
  if (!help) return ["Değer"];
  const afterColon = help.includes(":") ? help.slice(help.indexOf(":") + 1) : help;
  const parts = afterColon
    .split("|")
    .map((part) => part.trim().replace(/[.]$/, ""))
    .filter(Boolean);
  if (parts.length > 1) return parts;
  return ["Değer"];
}

type Row = { id: string; cells: string[] };

function RowEditor({
  row,
  columns,
  onChange,
  onRemove,
}: {
  row: Row;
  columns: string[];
  onChange: (cells: string[]) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-border/70 bg-background p-2 ${isDragging ? "opacity-70 shadow-sm" : ""}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="cursor-grab text-muted-foreground"
          aria-label="Satırı taşı"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="grid min-w-0 flex-1 gap-1">
          {columns.map((column, index) => (
            <Input
              key={column + String(index)}
              value={row.cells[index] ?? ""}
              placeholder={column}
              aria-label={column}
              onChange={(event) => {
                const next = [...row.cells];
                while (next.length < columns.length) next.push("");
                next[index] = event.target.value;
                onChange(next);
              }}
              className="h-8 text-xs"
            />
          ))}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Satırı sil"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function serializeRows(rows: Row[]) {
  return rows
    .map((row) => row.cells.map((cell) => cell.trim()).join(" | ").replace(/(\s\|\s)+$/, ""))
    .filter((line) => line.replace(/\|/g, "").trim().length > 0)
    .join("\n");
}

export function RepeaterField({
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
  const columns = useMemo(() => parseColumns(help), [help]);

  // Satır kimlikleri içerikten türetilmez; aksi halde her tuş vuruşunda
  // React anahtarı değişip odak kaybolur. Boş satırlar da yerel durumda
  // korunur, böylece "Öğe ekle" gerçekten yeni bir satır açar.
  const nextId = useRef(0);
  const makeRows = (raw: string): Row[] =>
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        nextId.current += 1;
        return {
          id: `row-${String(nextId.current)}`,
          cells: line.split("|").map((cell) => cell.trim()),
        };
      });

  const [rows, setRows] = useState<Row[]>(() => makeRows(value));
  const lastValue = useRef(value);

  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    setRows(makeRows(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commit = (next: Row[]) => {
    setRows(next);
    const serialized = serializeRows(next);
    lastValue.current = serialized;
    onChange(serialized);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((row) => row.id === active.id);
    const to = rows.findIndex((row) => row.id === over.id);
    if (from < 0 || to < 0) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    commit(next);
  };

  return (
    <FieldShell
      id={id}
      label={label}
      aside={<span className="text-[11px] text-muted-foreground">{rows.length} öğe</span>}
    >
      <div className="space-y-1.5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
            {rows.map((row, index) => (
              <RowEditor
                key={row.id}
                row={row}
                columns={columns}
                onChange={(cells) => {
                  const next = [...rows];
                  next[index] = { ...row, cells };
                  commit(next);
                }}
                onRemove={() => commit(rows.filter((_, position) => position !== index))}
              />
            ))}
          </SortableContext>
        </DndContext>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => {
            nextId.current += 1;
            commit([...rows, { id: `row-${String(nextId.current)}`, cells: columns.map(() => "") }]);
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          Öğe ekle
        </Button>
        {help ? <p className="text-[11px] leading-snug text-muted-foreground">{help}</p> : null}
      </div>
    </FieldShell>
  );
}
