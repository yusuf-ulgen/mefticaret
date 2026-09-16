import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock, Repeat, TrendingUp, Users } from "lucide-react";
import { useState } from "react";

import { SoftCard } from "@/components/homemaker/kolay-parts";
import { kolayInsightsQuery } from "@/lib/kolay-crm-queries";
import { formatMoney } from "@/lib/mefti";

/** "Raporlarım" sekmesi: gerçek siparişlerden hesaplanan sade analitik. */

const STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim edildi",
  completed: "Tamamlandı",
  cancelled: "İptal",
  refunded: "İade edildi",
  returned: "Geri döndü",
};

export function InsightsTab({ storeId }: { storeId: string }) {
  const [days, setDays] = useState(30);
  const { data, isPending, isError, refetch } = useQuery(kolayInsightsQuery(storeId, days));

  if (isPending) {
    return (
      <div className="grid min-h-48 place-items-center rounded-3xl border border-hm-line bg-white text-sm text-hm-ink-soft">
        Raporunuz hazırlanıyor…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <SoftCard className="grid gap-3 text-center">
        <p className="text-sm text-hm-ink-soft">Rapor yüklenemedi. Verileriniz korunuyor.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mx-auto min-h-11 rounded-2xl bg-hm-rose px-5 text-sm font-semibold text-white"
        >
          Tekrar dene
        </button>
      </SoftCard>
    );
  }

  const maxRevenue = Math.max(1, ...data.daily.map((row) => row.revenue));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[7, 30, 90].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDays(option)}
            className={`min-h-11 flex-1 rounded-2xl text-sm font-semibold transition-colors ${
              days === option
                ? "bg-hm-rose text-white"
                : "border border-hm-line bg-white text-hm-ink-soft"
            }`}
          >
            {option} gün
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          icon={<TrendingUp className="size-4" />}
          label="Tahsil edilen ciro"
          value={formatMoney(data.totals.paidRevenue, data.currency)}
          tone="bg-hm-emerald-soft text-hm-emerald"
        />
        <Stat
          icon={<BarChart3 className="size-4" />}
          label="Sipariş"
          value={String(data.totals.orders)}
          tone="bg-hm-rose-soft text-hm-rose"
        />
        <Stat
          icon={<Users className="size-4" />}
          label="Ortalama sepet"
          value={formatMoney(data.totals.averageBasket, data.currency)}
          tone="bg-hm-teal-soft text-hm-teal"
        />
        <Stat
          icon={<Repeat className="size-4" />}
          label="Tekrar alan müşteri"
          value={String(data.totals.repeatCustomers)}
          tone="bg-hm-amber-soft text-hm-amber"
        />
      </div>

      {data.totals.unpaidCount > 0 ? (
        <div className="rounded-3xl bg-hm-amber-soft px-4 py-3 text-sm font-semibold text-hm-amber">
          {data.totals.unpaidCount} siparişin ödemesi henüz alınmadı — Siparişlerim sekmesinden
          “Ödemeyi aldım” ile işaretleyebilirsiniz.
        </div>
      ) : null}

      <SoftCard>
        <p className="font-semibold">Günlük satış</p>
        <p className="mt-0.5 text-xs text-hm-ink-soft">Son {days} günün tahsil edilen cirosu</p>
        <div className="mt-3 flex h-32 items-end gap-1">
          {data.daily.map((row) => (
            <div
              key={row.date}
              title={`${new Date(row.date).toLocaleDateString("tr-TR")}: ${formatMoney(row.revenue, data.currency)}`}
              className="flex-1 rounded-t-md bg-hm-rose/70"
              style={{ height: `${Math.max(3, (row.revenue / maxRevenue) * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-hm-ink-soft">
          <span>{new Date(data.daily[0]?.date ?? "").toLocaleDateString("tr-TR")}</span>
          <span>Bugün</span>
        </div>
      </SoftCard>

      <SoftCard>
        <p className="font-semibold">En çok satan ürünler</p>
        {data.topProducts.length === 0 ? (
          <p className="mt-2 text-sm text-hm-ink-soft">Bu dönemde satış yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.topProducts.map((product, index) => (
              <li key={product.title} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-hm-sand text-sm font-bold text-hm-ink-soft">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{product.title}</span>
                <span className="text-sm font-semibold text-hm-rose">{product.quantity} adet</span>
              </li>
            ))}
          </ul>
        )}
      </SoftCard>

      <SoftCard>
        <p className="font-semibold">En çok alışveriş yapanlar</p>
        {data.topCustomers.length === 0 ? (
          <p className="mt-2 text-sm text-hm-ink-soft">Bu dönemde müşteri kaydı yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.topCustomers.map((customer) => (
              <li key={`${customer.name}-${customer.spent}`} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">{customer.name}</span>
                <span className="text-xs text-hm-ink-soft">{customer.orders} sipariş</span>
                <span className="text-sm font-semibold text-hm-emerald">
                  {formatMoney(customer.spent, data.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SoftCard>

      {data.busiestHours.length > 0 ? (
        <SoftCard>
          <p className="flex items-center gap-2 font-semibold">
            <Clock className="size-4 text-hm-teal" />
            Sipariş en çok hangi saatte geliyor?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.busiestHours.map((row) => (
              <span
                key={row.hour}
                className="rounded-full bg-hm-teal-soft px-3 py-1.5 text-sm font-semibold text-hm-teal"
              >
                {String(row.hour).padStart(2, "0")}:00 · {row.orders} sipariş
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-hm-ink-soft">
            Bu saatlerde paylaşım yaparsanız daha çok sipariş alabilirsiniz.
          </p>
        </SoftCard>
      ) : null}

      {data.statuses.length > 0 ? (
        <SoftCard>
          <p className="font-semibold">Sipariş durumları</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.statuses.map((row) => (
              <span
                key={row.status}
                className="rounded-full bg-hm-sand px-3 py-1.5 text-sm font-semibold text-hm-ink-soft"
              >
                {STATUS_LABEL[row.status] ?? row.status}: {row.count}
              </span>
            ))}
          </div>
        </SoftCard>
      ) : null}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-3xl px-3 py-3 ${tone}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-bold">{value}</p>
    </div>
  );
}
