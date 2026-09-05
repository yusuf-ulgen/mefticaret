import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Languages } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { languageNative } from "@/lib/languages";
import { formatNumber } from "@/lib/mefti";
import { platformLanguageOverview } from "@/lib/admin-languages.functions";

const DESCRIPTION =
  "Platformdaki tüm mağazaların dilleri, çeviri tamamlanma oranları, çeviri sağlayıcıları ve yapay zeka çeviri kullanımı tek ekranda.";

export const Route = createFileRoute("/_authenticated/admin/languages")({
  head: () => ({
    meta: [
      { title: "Dil ve Çeviri Merkezi — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Dil ve Çeviri Merkezi — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminLanguagesPage,
});

function percent(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function AdminLanguagesPage() {
  const load = useServerFn(platformLanguageOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-language-overview"],
    queryFn: () => load(),
  });

  const totals = data?.totals;

  return (
    <AdminShell
      title="Dil ve Çeviri Merkezi"
      description="Platform genelinde çok dilli mağaza durumu ve çeviri kullanımı."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Çok dilli mağaza", value: totals?.stores ?? 0 },
          { label: "Kullanılan dil", value: totals?.locales ?? 0 },
          { label: "Çeviri kaydı", value: totals?.entries ?? 0 },
          { label: "Çevrilmiş", value: totals?.translated ?? 0 },
          { label: "Toplu iş", value: totals?.jobs ?? 0 },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">{formatNumber(card.value)}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-xl border bg-card">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <Globe className="size-4" />
          <h2 className="text-sm font-semibold">Dil kullanımı</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Dil</th>
                <th className="px-4 py-2">Mağaza</th>
                <th className="px-4 py-2">Kayıt</th>
                <th className="px-4 py-2">Tamamlanma</th>
              </tr>
            </thead>
            <tbody>
              {(data?.localeUsage ?? []).map((row) => (
                <tr key={row.locale} className="border-t">
                  <td className="px-4 py-2 font-medium">
                    {languageNative(row.locale)} <span className="text-muted-foreground">({row.locale})</span>
                  </td>
                  <td className="px-4 py-2">{formatNumber(row.stores)}</td>
                  <td className="px-4 py-2">{formatNumber(row.entries)}</td>
                  <td className="px-4 py-2">{percent(row.translated, row.entries)}%</td>
                </tr>
              ))}
              {!isLoading && (data?.localeUsage ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                    Henüz ek dil tanımlanmadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-card">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <Languages className="size-4" />
          <h2 className="text-sm font-semibold">Mağaza bazlı durum</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Mağaza</th>
                <th className="px-4 py-2">Varsayılan</th>
                <th className="px-4 py-2">Dil</th>
                <th className="px-4 py-2">Kayıt</th>
                <th className="px-4 py-2">Tamamlanma</th>
                <th className="px-4 py-2">Sağlayıcı</th>
              </tr>
            </thead>
            <tbody>
              {(data?.stores ?? []).map((row) => (
                <tr key={row.storeId} className="border-t">
                  <td className="px-4 py-2 font-medium">{row.storeName}</td>
                  <td className="px-4 py-2">{row.defaultLocale ?? "—"}</td>
                  <td className="px-4 py-2">{row.locales}</td>
                  <td className="px-4 py-2">{formatNumber(row.entries)}</td>
                  <td className="px-4 py-2">{percent(row.translated, row.entries)}%</td>
                  <td className="px-4 py-2">
                    <Badge variant="secondary">{row.provider ?? "lovable-ai"}</Badge>
                  </td>
                </tr>
              ))}
              {!isLoading && (data?.stores ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                    Çeviri kullanan mağaza yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-card">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Yapay zeka çeviri kullanımı</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Mağaza</th>
                <th className="px-4 py-2">İstek</th>
                <th className="px-4 py-2">Kelime</th>
                <th className="px-4 py-2">Karakter</th>
                <th className="px-4 py-2">Maliyet</th>
              </tr>
            </thead>
            <tbody>
              {(data?.usage ?? []).map((row) => (
                <tr key={row.storeId} className="border-t">
                  <td className="px-4 py-2 font-medium">{row.storeName}</td>
                  <td className="px-4 py-2">{formatNumber(row.requests)}</td>
                  <td className="px-4 py-2">{formatNumber(row.words)}</td>
                  <td className="px-4 py-2">{formatNumber(row.characters)}</td>
                  <td className="px-4 py-2">{row.cost.toFixed(2)}</td>
                </tr>
              ))}
              {!isLoading && (data?.usage ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                    Henüz yapay zeka çevirisi kullanılmadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
