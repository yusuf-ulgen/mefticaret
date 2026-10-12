import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { freshnessOf, materialsQuery, type Freshness } from "@/lib/kolay-v4-queries";
import { deleteMaterial, saveMaterial } from "@/lib/kolay-v4.functions";

const UNITS = ["kg", "gr", "lt", "ml", "adet", "paket"] as const;

const TONE: Record<Freshness, { chip: string; label: string }> = {
  fresh: { chip: "bg-hm-emerald-soft text-hm-emerald", label: "Taze" },
  soon: { chip: "bg-hm-amber-soft text-hm-amber", label: "Az kaldı" },
  expired: { chip: "bg-hm-rose-soft text-hm-rose", label: "SKT geçti" },
  unknown: { chip: "bg-hm-sand text-hm-ink-soft", label: "Tarih yok" },
};

/** Malzeme & tazelik takibi: un, fındık, yağ gibi malzemelerin SKT uyarıları. */
export function MaterialsPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: materials } = useQuery(materialsQuery(storeId));
  const save = useServerFn(saveMaterial);
  const remove = useServerFn(deleteMaterial);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("kg");
  const [quantity, setQuantity] = useState("1");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = materials ?? [];
  const warnings = rows.filter((row) => {
    const state = freshnessOf(row.expiry_date);
    return state === "soon" || state === "expired";
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["kolay-materials", storeId] });

  const add = async () => {
    if (name.trim().length < 2) {
      toast.error("Malzeme adını yazın.");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          storeId,
          name: name.trim(),
          unit,
          quantity: Number(quantity.replace(",", ".")) || 0,
          expiryDate: expiry || null,
        },
      });
      await refresh();
      setName("");
      setQuantity("1");
      setExpiry("");
      setOpen(false);
      toast.success("Malzeme eklendi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  };

  const drop = async (id: string) => {
    try {
      await remove({ data: { materialId: id } });
      await refresh();
      toast.success("Malzeme kaldırıldı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kaldırılamadı");
    }
  };

  return (
    <SoftCard className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-hm-ink">Malzemelerim ve tazelik takibi</p>
          <p className="text-sm text-hm-ink-soft">
            Un, fındık, yağ gibi malzemelerinizin son kullanma tarihini takip edin.
          </p>
        </div>
        <button
          type="button"
          aria-label="Malzeme ekle"
          onClick={() => setOpen((value) => !value)}
          className="grid size-11 shrink-0 place-items-center rounded-2xl bg-hm-teal-soft text-hm-teal"
        >
          <Plus className="size-5" />
        </button>
      </div>

      {warnings.length ? (
        <p className="flex items-center gap-2 rounded-2xl bg-hm-amber-soft px-3 py-2 text-sm font-semibold text-hm-amber">
          <AlertTriangle className="size-4 shrink-0" />
          {warnings.length} malzemenizin tarihi yaklaşıyor veya geçti.
        </p>
      ) : null}

      {open ? (
        <div className="grid gap-3 rounded-2xl bg-hm-sand p-3">
          <Field label="Malzeme adı">
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Örn. Tam buğday unu"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Miktar">
              <input
                className={inputClass}
                value={quantity}
                inputMode="decimal"
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Field>
            <Field label="Birim">
              <select
                className={inputClass}
                value={unit}
                onChange={(event) => setUnit(event.target.value as (typeof UNITS)[number])}
              >
                {UNITS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Son kullanma tarihi" hint="Bilmiyorsanız boş bırakabilirsiniz.">
            <input
              type="date"
              className={inputClass}
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
            />
          </Field>
          <BigButton tone="teal" disabled={busy} onClick={() => void add()} className="w-full">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
            Malzemeyi ekle
          </BigButton>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-hm-ink-soft">Henüz malzeme eklemediniz.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => {
            const state = freshnessOf(row.expiry_date);
            const tone = TONE[state];
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-2xl border border-hm-line px-3 py-2"
              >
                <span
                  aria-hidden
                  className={`size-3 shrink-0 rounded-full ${
                    state === "fresh"
                      ? "bg-hm-emerald"
                      : state === "soon"
                        ? "bg-hm-amber"
                        : state === "expired"
                          ? "bg-hm-rose"
                          : "bg-hm-line"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-hm-ink">{row.name}</p>
                  <p className="text-xs text-hm-ink-soft">
                    {row.quantity} {row.unit}
                    {row.expiry_date
                      ? ` · ${new Date(`${row.expiry_date}T00:00:00`).toLocaleDateString("tr-TR")}`
                      : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.chip}`}>
                  {tone.label}
                </span>
                <button
                  type="button"
                  aria-label={`${row.name} malzemesini kaldır`}
                  onClick={() => void drop(row.id)}
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-hm-sand text-hm-ink-soft"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SoftCard>
  );
}
