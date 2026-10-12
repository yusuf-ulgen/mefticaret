import { X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/** Enter/virgül ile etiket ekleme; mobilde dokunulabilir çipler. */
export function TagInput({
  value,
  onChange,
  placeholder = "Etiket yaz, Enter'a bas",
  suggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const tag = raw.trim().slice(0, 60);
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
    setDraft("");
  };
  const listId = `tags-${suggestions.length}`;
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1 text-sm">
              {tag}
              <button type="button" aria-label={`${tag} etiketini kaldır`} onClick={() => onChange(value.filter((t) => t !== tag))} className="grid size-5 place-items-center rounded-full hover:bg-background">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={draft}
        list={suggestions.length ? listId : undefined}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) add(v.slice(0, -1));
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(draft); }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(draft)}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !value.includes(s)).slice(0, 50).map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}
