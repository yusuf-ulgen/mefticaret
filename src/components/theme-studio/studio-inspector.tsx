import { useMemo, useState } from "react";
import { Eye, EyeOff, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SectionField } from "@/lib/theme-sections";

import { StudioField } from "./studio-field";
import { DEVICE_FIELD_KEYS, INSPECTOR_TABS, tabOfField, type InspectorTab, type StudioItem } from "./studio-model";

/** Sağ panel: seçili bölümün ayarları (içerik / tasarım / yerleşim + cihaz görünürlüğü). */
export function StudioInspector({
  item,
  onChange,
  onReset,
  onToggle,
  onDelete,
}: {
  item: StudioItem | null;
  onChange: (key: string, value: string | number | boolean) => void;
  onReset: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("content");

  const fields = item?.section.definition.fields ?? [];
  const deviceFields = useMemo(() => fields.filter((field) => DEVICE_FIELD_KEYS.includes(field.key)), [fields]);
  const settingFields = useMemo(() => fields.filter((field) => !DEVICE_FIELD_KEYS.includes(field.key)), [fields]);

  const available = INSPECTOR_TABS.filter((entry) =>
    settingFields.some((field) => tabOfField(field) === entry.value),
  );
  const activeTab = available.some((entry) => entry.value === tab) ? tab : (available[0]?.value ?? "content");
  const visible = settingFields.filter((field) => tabOfField(field) === activeTab);

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Ayarları görmek için soldan bir bölüm seç.
      </div>
    );
  }

  const render = (field: SectionField) => (
    <StudioField
      key={field.key}
      id={`${item.id}-${field.key}`}
      field={field}
      value={item.settings[field.key] ?? ""}
      onChange={(next) => onChange(field.key, next)}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-0.5 border-b border-border px-3 py-2.5">
        <p className="truncate text-sm font-semibold">{item.section.definition.label}</p>
        <p className="text-[11px] leading-snug text-muted-foreground">{item.section.definition.description}</p>
      </div>

      {available.length > 1 ? (
        <div className="px-3 pt-2">
          <Tabs value={activeTab} onValueChange={(value) => setTab(value as InspectorTab)}>
            <TabsList className="w-full">
              {available.map((entry) => (
                <TabsTrigger key={entry.value} value={entry.value} className="flex-1 text-xs">
                  {entry.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <div className="space-y-3.5">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu sekmede ayar yok.</p>
          ) : (
            visible.map(render)
          )}

          {activeTab === "layout" && deviceFields.length > 0 ? (
            <section className="space-y-3 rounded-lg border border-border/70 p-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Cihaz görünürlüğü
              </h4>
              {deviceFields.map(render)}
            </section>
          ) : null}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-1.5 border-t border-border px-3 py-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onToggle}>
          {item.isEnabled ? <EyeOff className="mr-1.5 size-3.5" /> : <Eye className="mr-1.5 size-3.5" />}
          {item.isEnabled ? "Gizle" : "Göster"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset} aria-label="Varsayılan ayarlara dön">
          <RotateCcw className="size-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Bölümü sil">
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
