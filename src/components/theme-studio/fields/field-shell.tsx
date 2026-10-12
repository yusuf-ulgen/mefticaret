import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

/** Tüm ayar alanlarında ortak etiket + yardım metni sarmalayıcısı. */
export function FieldShell({
  id,
  label,
  help,
  aside,
  children,
  error,
}: {
  id?: string | undefined;
  label: string;
  help?: string | undefined;
  aside?: ReactNode | undefined;
  children: ReactNode;
  error?: string | null | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        {aside}
      </div>
      {children}
      {error ? <p className="text-[11px] leading-snug text-destructive">{error}</p> : null}
      {help ? <p className="text-[11px] leading-snug text-muted-foreground">{help}</p> : null}
    </div>
  );
}
