import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Mefticaret boş durum bileşeni: ikon, başlık, açıklama ve tek birincil aksiyon.
 * Erişilebilirlik: içerik `role="status"` ile ekran okuyuculara duyurulur.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "surface-card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand-foreground"
        >
          <Icon className="size-5" />
        </span>
      ) : null}
      <p className="font-display text-base font-semibold">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
