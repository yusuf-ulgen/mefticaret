import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, ExternalLink, Menu, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { collectionsQuery } from "@/lib/catalog-queries";
import { menuHref } from "@/components/storefront-chrome";
import {
  MENU_KIND_LABELS,
  MENU_LOCATION_LABELS,
  storeMenuItemsQuery,
  type MenuItem,
  type MenuKind,
} from "@/lib/menus-queries";
import { deleteMenuItem, reorderMenuItems, saveMenuItem, seedDefaultMenu } from "@/lib/menus.functions";
import { storePagesQuery } from "@/lib/pages-queries";
import { myStoresQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/navigation")({
  head: () => ({
    meta: [
      { title: "Vitrin Menüleri — Mefticaret" },
      {
        name: "description",
        content:
          "Vitrinin üst ve alt menülerini yönet: koleksiyon, içerik sayfası, ürün ve özel bağlantılar ekle.",
      },
      { property: "og:title", content: "Vitrin Menüleri — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret navigasyon yöneticisi ile vitrin menülerini sürükle-sırala düzeninde kur.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NavigationPage,
});

const KINDS: MenuKind[] = ["home", "collection", "page", "product", "cart", "account", "url"];

type FormState = {
  itemId: string | undefined;
  location: "header" | "footer";
  label: string;
  kind: MenuKind;
  target: string;
  isVisible: boolean;
};

const EMPTY: FormState = {
  itemId: undefined,
  location: "header",
  label: "",
  kind: "home",
  target: "",
  isVisible: true,
};

function NavigationPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: stores } = useQuery(myStoresQuery(user?.id));
  const slug = (stores ?? []).find((row) => row.id === storeId)?.slug ?? "";

  const { data: items = [], isLoading } = useQuery(storeMenuItemsQuery(storeId));
  const { data: collections = [] } = useQuery(collectionsQuery(storeId));
  const { data: pages = [] } = useQuery(storePagesQuery(storeId));

  const save = useServerFn(saveMenuItem);
  const remove = useServerFn(deleteMenuItem);
  const reorder = useServerFn(reorderMenuItems);
  const seed = useServerFn(seedDefaultMenu);

  const [form, setForm] = useState<FormState>(EMPTY);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["store-menu-items", storeId] });
    if (slug) queryClient.invalidateQueries({ queryKey: ["storefront-menu", slug] });
  };

  const saveMutation = useMutation({
    mutationFn: async (input: FormState) => {
      const list = items.filter((row) => row.location === input.location);
      const position = input.itemId
        ? (items.find((row) => row.id === input.itemId)?.position ?? 0)
        : list.length;
      return save({
        data: {
          storeId,
          itemId: input.itemId,
          location: input.location,
          label: input.label,
          kind: input.kind,
          target: input.target || undefined,
          position,
          isVisible: input.isVisible,
        },
      });
    },
    onSuccess: () => {
      toast.success("Menü bağlantısı kaydedildi");
      setForm(EMPTY);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => remove({ data: { storeId, itemId } }),
    onSuccess: () => {
      toast.success("Bağlantı silindi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorderMutation = useMutation({
    mutationFn: (payload: { id: string; position: number }[]) =>
      reorder({ data: { storeId, items: payload } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const seedMutation = useMutation({
    mutationFn: () => seed({ data: { storeId } }),
    onSuccess: () => {
      toast.success("Varsayılan menü oluşturuldu");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const move = (location: "header" | "footer", index: number, direction: -1 | 1) => {
    const list = items
      .filter((row) => row.location === location)
      .sort((a, b) => a.position - b.position);
    const next = index + direction;
    if (next < 0 || next >= list.length) return;
    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(next, 0, moved);
    reorderMutation.mutate(reordered.map((row, i) => ({ id: row.id, position: i })));
  };

  const needsTarget = ["collection", "page", "product", "url"].includes(form.kind);

  const renderList = (location: "header" | "footer") => {
    const list = items
      .filter((row) => row.location === location)
      .sort((a, b) => a.position - b.position);
    return (
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{MENU_LOCATION_LABELS[location]}</p>
          <Badge variant="secondary">{list.length} bağlantı</Badge>
        </div>
        {list.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Henüz bağlantı yok. Sağdaki formdan ekleyebilirsin.
          </p>
        ) : (
          <ul className="divide-y">
            {list.map((item: MenuItem, index) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.label}
                    {item.is_visible ? null : (
                      <span className="ml-2 text-xs text-muted-foreground">(gizli)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {MENU_KIND_LABELS[item.kind]}
                    {slug ? ` · ${menuHref(slug, item)}` : item.target ? ` · ${item.target}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Yukarı taşı"
                    onClick={() => move(location, index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Aşağı taşı"
                    onClick={() => move(location, index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        itemId: item.id,
                        location: item.location,
                        label: item.label,
                        kind: item.kind,
                        target: item.target ?? "",
                        isVisible: item.is_visible,
                      })
                    }
                  >
                    Düzenle
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Sil"
                    onClick={() => deleteMutation.mutate(item.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Vitrin Menüleri"
      description="Üst ve alt menü bağlantılarını yönet; sıralamayı oklarla değiştir."
    >
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Menu className="size-4" /> Vitrin navigasyonu
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              <Wand2 className="mr-2 size-4" /> Varsayılan menü
            </Button>
            {slug ? (
              <Button asChild variant="secondary">
                <a href={`/s/${slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 size-4" /> Vitrini gör
                </a>
              </Button>
            ) : null}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Yükleniyor…</p>
            ) : (
              <>
                {renderList("header")}
                {renderList("footer")}
              </>
            )}
          </div>

          <form
            className="space-y-4 rounded-xl border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate(form);
            }}
          >
            <p className="text-sm font-semibold">
              {form.itemId ? "Bağlantıyı düzenle" : "Yeni bağlantı"}
            </p>

            <div className="space-y-2">
              <Label htmlFor="menu-label">Etiket</Label>
              <Input
                id="menu-label"
                value={form.label}
                maxLength={60}
                required
                onChange={(event) => setForm({ ...form, label: event.target.value })}
                placeholder="Örn. Yeni Sezon"
              />
            </div>

            <div className="space-y-2">
              <Label>Konum</Label>
              <Select
                value={form.location}
                onValueChange={(value) =>
                  setForm({ ...form, location: value as "header" | "footer" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">{MENU_LOCATION_LABELS.header}</SelectItem>
                  <SelectItem value="footer">{MENU_LOCATION_LABELS.footer}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bağlantı türü</Label>
              <Select
                value={form.kind}
                onValueChange={(value) => setForm({ ...form, kind: value as MenuKind, target: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {MENU_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.kind === "collection" ? (
              <div className="space-y-2">
                <Label>Koleksiyon</Label>
                <Select value={form.target} onValueChange={(value) => setForm({ ...form, target: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Koleksiyon seç" />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map((collection) => (
                      <SelectItem key={collection.id} value={collection.slug}>
                        {collection.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {form.kind === "page" ? (
              <div className="space-y-2">
                <Label>İçerik sayfası</Label>
                <Select value={form.target} onValueChange={(value) => setForm({ ...form, target: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sayfa seç" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.id} value={page.slug}>
                        {page.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {form.kind === "product" || form.kind === "url" ? (
              <div className="space-y-2">
                <Label htmlFor="menu-target">
                  {form.kind === "product" ? "Ürün slug" : "Adres"}
                </Label>
                <Input
                  id="menu-target"
                  value={form.target}
                  onChange={(event) => setForm({ ...form, target: event.target.value })
                  }
                  placeholder={form.kind === "product" ? "orn-urun-slug" : "/cart veya https://..."}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Vitrinde göster</p>
                <p className="text-xs text-muted-foreground">Kapatırsan bağlantı gizlenir.</p>
              </div>
              <Switch
                checked={form.isVisible}
                onCheckedChange={(checked) => setForm({ ...form, isVisible: checked })}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending || (needsTarget && !form.target)}>
                Kaydet
              </Button>
              {form.itemId ? (
                <Button type="button" variant="ghost" onClick={() => setForm(EMPTY)}>
                  Vazgeç
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
