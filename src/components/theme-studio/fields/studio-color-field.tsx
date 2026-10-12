import { HexColorPicker } from "react-colorful";

import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

import { FieldShell } from "./field-shell";

const HEX = /^#[0-9a-fA-F]{6}$/;

function parse(value: string) {
  const trimmed = value.trim();
  if (HEX.test(trimmed)) return { hex: trimmed, opacity: 100 };
  const match = /^(#[0-9a-fA-F]{6})@(\d{1,3})$/.exec(trimmed);
  if (match) return { hex: match[1] as string, opacity: Math.min(100, Number(match[2])) };
  return { hex: "#111111", opacity: 100 };
}

function serialize(hex: string, opacity: number) {
  return opacity >= 100 ? hex : `${hex}@${opacity}`;
}

/** Renk seçici: swatch + hex girişi + saydamlık. */
export function ColorField({
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
  const { hex, opacity } = parse(value);

  return (
    <FieldShell id={id} label={label} help={help}>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              id={id}
              aria-label={`${label} rengini seç`}
              className="size-9 shrink-0 rounded-md border border-input"
              style={{ backgroundColor: hex, opacity: opacity / 100 }}
            />
          </PopoverTrigger>
          <PopoverContent className="w-[232px] space-y-3" align="start">
            <HexColorPicker color={hex} onChange={(next) => onChange(serialize(next, opacity))} />
            <Input
              value={hex}
              onChange={(event) => {
                const next = event.target.value.trim();
                if (HEX.test(next)) onChange(serialize(next, opacity));
              }}
              className="h-8 text-xs"
              aria-label="Hex kodu"
            />
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Saydamlık</span>
                <span className="tabular-nums">%{opacity}</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[opacity]}
                onValueChange={([next]) => onChange(serialize(hex, next ?? 100))}
                aria-label="Saydamlık"
              />
            </div>
          </PopoverContent>
        </Popover>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 text-xs"
          aria-label={`${label} değeri`}
        />
      </div>
    </FieldShell>
  );
}
