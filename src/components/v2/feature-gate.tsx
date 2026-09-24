import { Lock } from "lucide-react";

import { t } from "@/lib/commerce-v2";

/** Sunucudan gelen paket/yetki hatalarını anlaşılır biçimde gösterir. */
export function V2ErrorState({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const locked = /paket|kapalı|PlanLimit/i.test(msg);
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <Lock className="mx-auto size-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{locked ? t("featureOff") : "Veriler yüklenemedi"}</p>
      {!locked && <p className="mt-1 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
