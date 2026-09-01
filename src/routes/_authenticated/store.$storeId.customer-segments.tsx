import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCopy, Download, Layers, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  SEGMENT_COLOR_CLASSES,
  customerSegmentsQuery,
  segmentCustomersQuery,
  segmentMembers,
  type CustomerSegment,
} from "@/lib/customer-segments-queries";
import {
  deleteCustomerSegment,
  saveCustomerSegment,
  seedDefaultSegments,
} from "@/lib/customer-segments.functions";
import { formatDate, formatMoney } from "@/lib/mefti";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/customer-segments")({
  head: () => ({
    meta: [
      { title: "Müşteri Segmentleri — Mefticaret" },
      {
        name: "description",
        content:
          "Yeni müşteri, sadık müşteri, VIP, yüksek değerli ve pasif müşteri segmentlerini kural bazlı oluştur, üyeleri listele ve dışa aktar.",
      },
      { property: "og:title", content: "Müşteri Segmentleri — Mefticaret" },
      {
        property: "og:description",
        content: "Sipariş sayısı, harcama, etiket ve pasiflik kurallarıyla dinamik müşteri segmentleri.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerSegmentsPage,
});

const EMPTY = {
  segmentId: undefined as string | undefined,
  name: "",
  description: "",
  color: "slate" as CustomerSegment["color"],
  minOrders: "0",
  minSpent: "0",
  inactiveDays: "",
  newWithinDays: "",
  requiredTags: "",
};

function CustomerSegmentsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const segments = useQuery(customerSegmentsQuery(storeId));
  const customers = useQuery(segmentCustomersQuery(storeId));

  const save = useServerFn(saveCustomerSegment);
  const remove = useServerFn(deleteCustomerSegment);
  const seed = useServerFn(seedDefaultSegments);

  const [form, setForm] = useState(EMPTY);
  const [activeId, setActiveId] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["customer-segments", storeId] });

  const rows = customers.data ?? [];
  const list = segments.data ?? [];
  const active = list.find((segment) => segment.id === activeId) ?? list[0] ?? null;
  const members = useMemo(() => (active ? segmentMembers(rows, active) : []), [rows, active]);

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId,
          segmentId: form.segmentId,
          name: form.name,
          description: form.description || undefined,
          color: form.color,
          minOrders: Math.max(0, Math.round(Number(form.minOrders) || 0)),
          minSpent: Math.max(0, Number(form.minSpent) || 0),
          inactiveDays: form.inactiveDays ? Math.round(Number(form.inactiveDays)) : null,
          newWithinDays: form.newWithinDays ? Math.round(Number(form.newWithinDays)) : null,
          requiredTags: form.requiredTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          sortOrder: 0,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(form.segmentId ? "Segment güncellendi" : "Segment oluşturuldu");
      setForm(EMPTY);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (segmentId: string) => remove({ data: { storeId, segmentId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Segment silindi");
      setForm(EMPTY);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const seedMutation = useMutation({
    mutationFn: () => seed({ data: { storeId } }),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(
        result.created > 0
          ? `${result.created} hazır segment eklendi`
          : "Hazır segmentler zaten mevcut",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const edit = (segment: CustomerSegment) =>
    setForm({
      segmentId: segment.id,
      name: segment.name,
      description: segment.description ?? "",
      color: segment.color,
      minOrders: String(segment.min_orders),
      minSpent: String(segment.min_spent),
      inactiveDays: segment.inactive_days == null ? "" : String(segment.inactive_days),
      newWithinDays: segment.new_within_days == null ? "" : String(segment.new_within_days),
      requiredTags: segment.required_tags.join(", "),
    });

  async function copyEmails() {
    const emails = [...new Set(members.map((member) => member.email).filter(Boolean))] as string[];
    if (emails.length === 0) {
      toast.error("Kopyalanacak e-posta bulunamadı");
      return;
    }
    await navigator.clipboard.writeText(emails.join(", "));
    toast.success(`${emails.length} e-posta kopyalandı`);
  }

  function exportCsv() {
    const csv = toCsv(
      ["ad_soyad", "eposta", "telefon", "siparis", "harcama", "etiketler", "son_aktivite"],
      members.map((member) => [
        member.full_name,
        member.email ?? "",
        member.phone ?? "",
        member.orders_count,
        member.total_spent.toFixed(2),
        (member.tags ?? []).join("|"),
        member.last_activity_at ?? "",
      ]),
    );
    downloadCsv(`${active?.slug ?? "segment"}-musteriler.csv`, csv);
  }

  return (
    <AppShell
      storeId={storeId}
      title="Müşteri Segmentleri"
      description="Sipariş sayısı, harcama, etiket ve pasiflik kurallarıyla dinamik segmentler oluştur."
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={seedMutation.isPending}
          onClick={() => seedMutation.mutate()}
        >
          <Sparkles className="mr-2 size-4" /> Hazır segmentleri ekle
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <form
          className="surface-card space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {form.segmentId ? "Segmenti düzenle" : "Yeni segment"}
            </h2>
            {form.segmentId ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(EMPTY)}>
                Vazgeç
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-name">Segment adı</Label>
            <Input
              id="s-name"
              required
              minLength={2}
              value={form.name}
              onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              placeholder="VIP"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-desc">Açıklama</Label>
            <Textarea
              id="s-desc"
              rows={2}
              value={form.description}
              onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Renk</Label>
            <Select
              value={form.color}
              onValueChange={(value) => setForm((f) => ({ ...f, color: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slate">Nötr</SelectItem>
                <SelectItem value="primary">Marka</SelectItem>
                <SelectItem value="emerald">Yeşil</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
                <SelectItem value="sky">Mavi</SelectItem>
                <SelectItem value="rose">Kırmızı</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-orders">Min. sipariş</Label>
              <Input
                id="s-orders"
                inputMode="numeric"
                value={form.minOrders}
                onChange={(event) => setForm((f) => ({ ...f, minOrders: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-spent">Min. harcama</Label>
              <Input
                id="s-spent"
                inputMode="decimal"
                value={form.minSpent}
                onChange={(event) => setForm((f) => ({ ...f, minSpent: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-idle">Pasiflik (gün)</Label>
              <Input
                id="s-idle"
                inputMode="numeric"
                placeholder="90"
                value={form.inactiveDays}
                onChange={(event) => setForm((f) => ({ ...f, inactiveDays: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-new">Yeni müşteri (gün)</Label>
              <Input
                id="s-new"
                inputMode="numeric"
                placeholder="30"
                value={form.newWithinDays}
                onChange={(event) => setForm((f) => ({ ...f, newWithinDays: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-tags">Zorunlu etiketler</Label>
            <Input
              id="s-tags"
              value={form.requiredTags}
              onChange={(event) => setForm((f) => ({ ...f, requiredTags: event.target.value }))}
              placeholder="toptan, kurumsal"
            />
            <p className="text-xs text-muted-foreground">Virgülle ayır; boş bırakılırsa etiket şartı yok.</p>
          </div>

          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Kaydediliyor…" : form.segmentId ? "Güncelle" : "Segment oluştur"}
          </Button>
        </form>

        <div className="space-y-4 lg:col-span-2">
          {segments.isLoading ? (
            <p className="text-muted-foreground">Yükleniyor…</p>
          ) : list.length === 0 ? (
            <div className="surface-card p-10 text-center">
              <Layers className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Henüz segment yok</p>
              <p className="text-sm text-muted-foreground">
                “Hazır segmentleri ekle” ile yeni müşteri, sadık müşteri, VIP, yüksek değerli ve pasif
                müşteri segmentlerini tek tıkla oluşturabilirsin.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((segment) => {
                  const count = segmentMembers(rows, segment).length;
                  const revenue = segmentMembers(rows, segment).reduce(
                    (sum, member) => sum + member.total_spent,
                    0,
                  );
                  const isActive = active?.id === segment.id;
                  return (
                    <button
                      key={segment.id}
                      type="button"
                      onClick={() => setActiveId(segment.id)}
                      className={cn(
                        "surface-card p-4 text-left transition",
                        isActive ? "ring-2 ring-primary" : "hover:border-primary/40",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          SEGMENT_COLOR_CLASSES[segment.color] ?? SEGMENT_COLOR_CLASSES.slate,
                        )}
                      >
                        {segment.name}
                      </span>
                      <p className="pt-2 text-2xl font-semibold">{count}</p>
                      <p className="text-xs text-muted-foreground">{formatMoney(revenue)} ciro</p>
                      {segment.description ? (
                        <p className="pt-2 text-xs text-muted-foreground">{segment.description}</p>
                      ) : null}
                      <span className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            edit(segment);
                          }}
                        >
                          Düzenle
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Segmenti sil"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteMutation.mutate(segment.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="surface-card">
                <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <h2 className="text-lg font-semibold">
                    {active?.name ?? "Segment"} — {members.length} müşteri
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyEmails}
                      disabled={members.length === 0}
                    >
                      <ClipboardCopy className="mr-2 size-4" /> E-postalar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportCsv}
                      disabled={members.length === 0}
                    >
                      <Download className="mr-2 size-4" /> CSV
                    </Button>
                  </div>
                </div>

                {members.length === 0 ? (
                  <p className="px-4 pb-6 text-sm text-muted-foreground">
                    Bu kurallara uyan müşteri yok.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Müşteri</th>
                          <th className="px-4 py-3">İletişim</th>
                          <th className="px-4 py-3 text-right">Sipariş</th>
                          <th className="px-4 py-3 text-right">Harcama</th>
                          <th className="px-4 py-3">Son aktivite</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.id} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-3">
                              <Link
                                className="font-medium underline-offset-4 hover:underline"
                                to="/store/$storeId/customers/$customerId"
                                params={{ storeId, customerId: member.id }}
                              >
                                {member.full_name}
                              </Link>
                              <span className="flex flex-wrap gap-1 pt-1">
                                {(member.tags ?? []).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-[0.65rem]">
                                    {tag}
                                  </Badge>
                                ))}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              <span className="block">{member.email ?? "—"}</span>
                              <span className="block text-xs">{member.phone ?? "—"}</span>
                            </td>
                            <td className="px-4 py-3 text-right">{member.orders_count}</td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {formatMoney(member.total_spent)}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {member.last_activity_at ? formatDate(member.last_activity_at) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
