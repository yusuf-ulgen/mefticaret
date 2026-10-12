import { CalendarDays, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PERIODS, PERIOD_LABELS, pctChange, type PeriodInput } from "@/lib/analytics-v2";

export const CHART_COLORS = ["var(--brand)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-1)"];

export const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "var(--muted-foreground)" },
  cursor: { stroke: "var(--border)" },
} as const;

/** Tarih seçici: masaüstünde satır içi düğmeler, telefonda alttan açılan pencere. */
export function PeriodPicker({ value, onChange }: { value: PeriodInput; onChange: (v: PeriodInput) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");
  const label =
    value.period === "custom" && value.from && value.to ? `${value.from} → ${value.to}` : PERIOD_LABELS[value.period];

  const choices = (
    <div className="flex flex-wrap gap-2">
      {PERIODS.filter((p) => p !== "custom").map((p) => (
        <Button
          key={p}
          size="sm"
          variant={value.period === p ? "default" : "outline"}
          className="h-11 md:h-9"
          onClick={() => { onChange({ period: p }); setOpen(false); }}
        >
          {PERIOD_LABELS[p]}
        </Button>
      ))}
    </div>
  );
  const custom = (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs text-muted-foreground">Başlangıç
        <Input type="date" className="h-11 md:h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">Bitiş
        <Input type="date" className="h-11 md:h-9" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <Button
        size="sm"
        className="h-11 md:h-9"
        disabled={!from || !to}
        onClick={() => { onChange({ period: "custom", from, to }); setOpen(false); }}
      >
        Uygula
      </Button>
    </div>
  );

  return (
    <>
      <div className="hidden flex-wrap items-center gap-3 md:flex">
        {choices}
        {custom}
      </div>
      <Button variant="outline" className="h-11 w-full justify-start md:hidden" onClick={() => setOpen(true)}>
        <CalendarDays className="mr-2 size-4" /> {label}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="space-y-4 rounded-t-2xl pb-8">
          <SheetHeader><SheetTitle>Tarih aralığı</SheetTitle></SheetHeader>
          {choices}
          <div className="border-t border-border pt-4">{custom}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  const d = pctChange(cur, prev);
  if (d === null) return <span className="text-xs text-muted-foreground">yeni</span>;
  const up = d >= 0;
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${good ? "text-success" : "text-destructive"}`}>
      <Icon className="size-3" /> %{Math.abs(d).toFixed(1).replace(".", ",")}
    </span>
  );
}

/** KPI şeridi: telefonda yatay kaydırma, tablette 2×2, masaüstünde 1×4. */
export function KpiStrip({ items }: { items: { label: string; value: string; cur: number; prev: number; icon?: ReactNode }[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="surface-card min-w-[70%] snap-start p-4 sm:min-w-0">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">{k.icon}{k.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
          <div className="mt-1 flex items-center gap-2"><Delta cur={k.cur} prev={k.prev} /><span className="text-xs text-muted-foreground">önceki döneme göre</span></div>
        </div>
      ))}
    </div>
  );
}

/** Aşağı çekip yenileme (yalnız dokunmatik ve sayfa en üstteyken). */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const onStart = (e: TouchEvent) => { if (window.scrollY <= 0 && !busy) start.current = e.touches[0]?.clientY ?? null; };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const d = (e.touches[0]?.clientY ?? 0) - start.current;
      pullRef.current = d > 0 ? Math.min(d * 0.5, 90) : 0;
      setPull(pullRef.current);
    };
    const onEnd = async () => {
      if (start.current === null) return;
      start.current = null;
      if (pullRef.current > 60) {
        setBusy(true);
        try { await onRefresh(); } finally { setBusy(false); }
      }
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [onRefresh, busy]);

  return (
    <div>
      <div className="flex justify-center overflow-hidden transition-[height]" style={{ height: busy ? 40 : pull }} aria-hidden={!busy}>
        <Loader2 className={`mt-2 size-5 text-muted-foreground ${busy ? "animate-spin" : ""}`} style={{ transform: `rotate(${pull * 4}deg)` }} />
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`surface-card p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ text = "Bu dönemde veri yok." }: { text?: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

/** Yatay oran çubuklu liste (tablo yerine mobil dostu). */
export function BarList({ rows, format = (n: number) => n.toLocaleString("tr-TR") }: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
}) {
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{format(r.value)}{r.hint ? ` · ${r.hint}` : ""}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
