import { useMemo, useState } from "react";

import {
  apparelSizeTable,
  cmToInch,
  kgToLbs,
  shoeSizeTable,
  sizeSystemForCountry,
  unitSystemForCountry,
} from "@/lib/growth-export";

type Props = { country?: string | null; locale?: string };

const LABELS: Record<string, { title: string; apparel: string; shoe: string; units: string; note: string }> = {
  tr: {
    title: "Beden ve ölçü dönüştürücü",
    apparel: "Giyim",
    shoe: "Ayakkabı",
    units: "Ölçü birimleri",
    note: "Ölçüler bulunduğunuz ülkeye göre otomatik seçildi.",
  },
  en: {
    title: "Size & unit converter",
    apparel: "Apparel",
    shoe: "Shoes",
    units: "Units",
    note: "Units are matched to your country automatically.",
  },
};

/** Ziyaretçinin ülkesine göre beden (EU/US/UK) ve ölçü (cm/inch, kg/lbs) dönüşümü. */
export function SizeUnitConverter({ country, locale = "tr" }: Props) {
  const code = (country ?? "TR").toUpperCase();
  const system = sizeSystemForCountry(code);
  const units = unitSystemForCountry(code);
  const text = LABELS[locale] ?? LABELS["en"]!;

  const [cm, setCm] = useState("170");
  const [kg, setKg] = useState("70");

  const apparel = useMemo(() => apparelSizeTable(), []);
  const shoes = useMemo(() => shoeSizeTable(), []);

  return (
    <section className="rounded-xl border p-4 text-sm">
      <h3 className="font-semibold">{text.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {text.note} ({code} · {system} · {units === "imperial" ? "inch/lbs" : "cm/kg"})
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{text.apparel}</p>
          <ul className="mt-1 space-y-1">
            {apparel.map((row) => (
              <li key={row.eu} className="flex justify-between border-b py-1 last:border-0">
                <span>EU {row.eu}</span>
                <span className="text-muted-foreground">
                  US {row.us} · UK {row.uk}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{text.shoe}</p>
          <ul className="mt-1 space-y-1">
            {shoes.map((row) => (
              <li key={row.eu} className="flex justify-between border-b py-1 last:border-0">
                <span>EU {row.eu}</span>
                <span className="text-muted-foreground">
                  US {row.us} · UK {row.uk}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-muted-foreground">cm → inch</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={cm}
            onChange={(event) => setCm(event.target.value)}
            aria-label="cm"
          />
          <span className="text-xs text-muted-foreground">
            = {cmToInch(Number(cm.replace(",", ".")) || 0).toFixed(2)} in
          </span>
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">kg → lbs</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={kg}
            onChange={(event) => setKg(event.target.value)}
            aria-label="kg"
          />
          <span className="text-xs text-muted-foreground">
            = {kgToLbs(Number(kg.replace(",", ".")) || 0).toFixed(2)} lb
          </span>
        </label>
      </div>
    </section>
  );
}
