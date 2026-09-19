import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarClock, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GLOBAL_COUNTRIES } from "@/lib/global-commerce";
import { holidayCampaignsQuery } from "@/lib/growth-export-queries";
import {
  deleteHolidayCampaign,
  previewDispatchSchedule,
  saveDispatchWindow,
  saveHolidayCampaign,
  seedHolidayCampaigns,
} from "@/lib/growth-export.functions";

type Props = { storeId: string };

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

/** Tatil kampanyası otomasyonu + saat dilimine duyarlı bildirim gönderimi. */
export function CampaignDispatchPanel({ storeId }: Props) {
  const queryClient = useQueryClient();
  const { data: campaigns } = useQuery(holidayCampaignsQuery(storeId));
  const seed = useServerFn(seedHolidayCampaigns);
  const saveCampaign = useServerFn(saveHolidayCampaign);
  const removeCampaign = useServerFn(deleteHolidayCampaign);
  const saveWindow = useServerFn(saveDispatchWindow);
  const preview = useServerFn(previewDispatchSchedule);

  const [year, setYear] = useState(String(new Date().getUTCFullYear()));
  const [discount, setDiscount] = useState("15");
  const [country, setCountry] = useState("DE");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [hour, setHour] = useState("10");
  const [windowActive, setWindowActive] = useState(true);
  const [schedule, setSchedule] = useState<
    Array<{ id: string; country: string; channel: string; localHour: number; timezone: string; sendAt: string; isActive: boolean }>
  >([]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["holiday-campaigns", storeId] });

  const seedMutation = useMutation({
    mutationFn: () =>
      seed({
        data: { storeId, year: Number(year), discountPercent: Number(discount.replace(",", ".")) } as never,
      }),
    onSuccess: (result: { created?: number }) => {
      toast.success(`${result?.created ?? 0} kampanya takvime eklendi`);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patchMutation = useMutation({
    mutationFn: (input: { id: string; isActive?: boolean; discountPercent?: number }) =>
      saveCampaign({ data: { storeId, ...input } as never }),
    onSuccess: () => {
      toast.success("Kampanya güncellendi");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeCampaign({ data: { storeId, id } as never }),
    onSuccess: () => {
      toast.success("Kampanya kaldırıldı");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const windowMutation = useMutation({
    mutationFn: () =>
      saveWindow({
        data: {
          storeId,
          countryCode: country,
          channel,
          localSendHour: Number(hour),
          isActive: windowActive,
        } as never,
      }),
    onSuccess: async () => {
      toast.success("Gönderim penceresi kaydedildi");
      setSchedule(await preview({ data: { storeId } as never }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const previewMutation = useMutation({
    mutationFn: () => preview({ data: { storeId } as never }),
    onSuccess: (rows) => setSchedule(rows),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-4" /> Küresel tatil kampanya otomasyonu
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Black Friday, Cyber Monday, Paskalya, Ramazan, Bayram, Labor Day ve 11.11 için indirim ve banner
          takvimini otomatik oluşturun.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="camp-year">Yıl</Label>
            <Input id="camp-year" className="mt-1 w-28" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="camp-discount">İndirim %</Label>
            <Input
              id="camp-discount"
              className="mt-1 w-28"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <Button disabled={seedMutation.isPending} onClick={() => seedMutation.mutate()}>
            Takvimi oluştur
          </Button>
        </div>

        {(campaigns ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Henüz kampanya yok.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {(campaigns ?? []).map((campaign) => (
              <li key={campaign.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(campaign.starts_at)} – {formatDate(campaign.ends_at)} · {campaign.countries.join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">%{campaign.discount_percent}</Badge>
                  <Switch
                    checked={campaign.is_active}
                    onCheckedChange={(next) => patchMutation.mutate({ id: campaign.id, isActive: next })}
                    aria-label="Kampanyayı aç/kapat"
                  />
                  <Button size="sm" variant="ghost" aria-label="Kampanyayı sil" onClick={() => deleteMutation.mutate(campaign.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="size-4" /> Saat dilimine duyarlı bildirim gönderimi
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          E-posta ve WhatsApp bildirimleri, müşterinin bulunduğu ülkenin yerel saatine göre gönderilir.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Ülke</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_COUNTRIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} · {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kanal</Label>
            <Select value={channel} onValueChange={(next) => setChannel(next as "email" | "whatsapp")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-posta</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dispatch-hour">Yerel saat (0-23)</Label>
            <Input id="dispatch-hour" className="mt-1" value={hour} onChange={(e) => setHour(e.target.value)} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="dispatch-active" checked={windowActive} onCheckedChange={setWindowActive} />
            <Label htmlFor="dispatch-active">Aktif</Label>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button disabled={windowMutation.isPending} onClick={() => windowMutation.mutate()}>
            Pencereyi kaydet
          </Button>
          <Button variant="outline" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
            Sıradaki gönderimleri göster
          </Button>
        </div>

        {schedule.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {schedule.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>
                  {row.country} · {row.channel === "email" ? "E-posta" : "WhatsApp"} · yerel {row.localHour}:00
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.timezone} → {new Date(row.sendAt).toLocaleString("tr-TR")}
                  {row.isActive ? "" : " (pasif)"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
