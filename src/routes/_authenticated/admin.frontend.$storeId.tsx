import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Plus, Trash2 } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/auth-context";
import { storeControlQuery } from "@/lib/platform-admin-queries";
import { storeThemeQuery } from "@/lib/theme-queries";
import { themeSectionsQuery } from "@/lib/theme-sections-queries";
import { storePagesQuery } from "@/lib/pages-queries";
import { sectionsByCategory, type ThemeSectionType } from "@/lib/theme-sections";
import {
  addThemeSection,
  removeThemeSection,
  reorderThemeSections,
  updateThemeSection,
} from "@/lib/theme-sections.functions";
import { saveTheme } from "@/lib/theme.functions";
import { savePage } from "@/lib/pages.functions";

export const Route = createFileRoute("/_authenticated/admin/frontend/$storeId")({
  head: () => ({
    meta: [
      { title: "Ön Uç Yönetimi — Süper Admin" },
      {
        name: "description",
        content:
          "Süper yönetici olarak mağazanın vitrin bölümlerini, tema ayarlarını ve içerik sayfalarını canlı önizlemeyle yönet.",
      },
      { property: "og:title", content: "Ön Uç Yönetimi — Süper Admin" },
      {
        property: "og:description",
        content: "Vitrin bölümleri, tema ayarları ve sayfalar tek ekranda tam kontrol.",
      },
    ],
  }),
  component: AdminFrontendPage,
});

const DEVICES = [
  { key: "desktop", label: "Masaüstü", width: "100%" },
  { key: "tablet", label: "Tablet", width: "834px" },
  { key: "mobile", label: "Mobil", width: "390px" },
] as const;

function AdminFrontendPage() {
  const { storeId } = Route.useParams();
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();

  const control = useQuery(storeControlQuery(storeId, isPlatformAdmin));
  const sections = useQuery(themeSectionsQuery(storeId));
  const theme = useQuery(storeThemeQuery(storeId));
  const pages = useQuery(storePagesQuery(storeId));

  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [newType, setNewType] = useState<string>("");

  const slug = String(control.data?.store?.["slug"] ?? "");
  const storeName = String(control.data?.store?.["name"] ?? "Mağaza");
  const storefrontUrl = slug ? `/s/${slug}` : "";
  const groups = useMemo(() => sectionsByCategory(), []);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["theme-sections", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["store-pages", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["platform-store-control", storeId] });
    if (slug) void queryClient.invalidateQueries({ queryKey: ["storefront", slug] });
    setPreviewKey((value) => value + 1);
  };

  const toggleMutation = useMutation({
    mutationFn: (input: {
      sectionId: string;
      type: ThemeSectionType;
      isEnabled: boolean;
      settings: Record<string, string | number | boolean>;
    }) => updateThemeSection({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Bölüm güncellendi");
      refreshAll();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorderMutation = useMutation({
    mutationFn: (sectionIds: string[]) => reorderThemeSections({ data: { storeId, sectionIds } }),
    onSuccess: () => {
      toast.success("Sıralama kaydedildi");
      refreshAll();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addMutation = useMutation({
    mutationFn: (type: ThemeSectionType) => addThemeSection({ data: { storeId, type } }),
    onSuccess: () => {
      toast.success("Bölüm eklendi");
      setNewType("");
      refreshAll();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (sectionId: string) => removeThemeSection({ data: { storeId, sectionId } }),
    onSuccess: () => {
      toast.success("Bölüm silindi");
      refreshAll();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pageMutation = useMutation({
    mutationFn: (input: {
      pageId: string;
      title: string;
      slug: string;
      body: string;
      isPublished: boolean;
      showInFooter: boolean;
      sortOrder: number;
    }) => savePage({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Sayfa güncellendi");
      refreshAll();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const list = sections.data ?? [];

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((section) => section.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(target, 0, moved);
    reorderMutation.mutate(ids);
  };

  if (!isPlatformAdmin) {
    return (
      <AdminShell title="Ön Uç Yönetimi">
        <p className="text-sm text-muted-foreground">Bu alan yalnızca platform yöneticileri içindir.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`Ön Uç Yönetimi — ${storeName}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/store/$storeId" params={{ storeId }}>
              Kontrol merkezi
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/store/$storeId/theme-editor" params={{ storeId }}>
              Tema editörü
            </Link>
          </Button>
          {storefrontUrl ? (
            <a
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm"
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
            >
              Vitrini aç <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {DEVICES.map((item) => (
              <Button
                key={item.key}
                size="sm"
                variant={device === item.key ? "default" : "outline"}
                onClick={() => setDevice(item.key)}
              >
                {item.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => setPreviewKey((value) => value + 1)}>
              Yenile
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-card p-4">
            <Tabs defaultValue="sections">
              <TabsList className="w-full">
                <TabsTrigger value="sections" className="flex-1">
                  Bölümler
                </TabsTrigger>
                <TabsTrigger value="theme" className="flex-1">
                  Tema
                </TabsTrigger>
                <TabsTrigger value="pages" className="flex-1">
                  Sayfalar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sections" className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger aria-label="Eklenecek bölüm">
                      <SelectValue placeholder="Bölüm ekle" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectGroup key={group.category}>
                          <SelectLabel>{group.label}</SelectLabel>
                          {group.items.map((item) => (
                            <SelectItem key={item.type} value={item.type}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!newType || addMutation.isPending}
                    onClick={() => newType && addMutation.mutate(newType as ThemeSectionType)}
                  >
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Ekle
                  </Button>
                </div>

                {sections.isLoading ? (
                  <p className="text-sm text-muted-foreground">Bölümler yükleniyor…</p>
                ) : list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Bu mağazanın henüz vitrin bölümü yok. Yukarıdan ekleyebilirsin.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((section, index) => (
                      <li
                        key={section.id}
                        className="flex items-center gap-2 rounded-xl border border-border bg-background p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{section.definition.label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {section.definition.description}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={section.isEnabled ? "Bölümü gizle" : "Bölümü göster"}
                          onClick={() =>
                            toggleMutation.mutate({
                              sectionId: section.id,
                              type: section.type,
                              isEnabled: !section.isEnabled,
                              settings: section.settings,
                            })
                          }
                        >
                          {section.isEnabled ? (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Yukarı taşı"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Aşağı taşı"
                          disabled={index === list.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button size="icon" variant="ghost" aria-label="Bölümü sil">
                              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                            </Button>
                          }
                          title="Bölümü sil"
                          description="Bu vitrin bölümü kalıcı olarak kaldırılacak."
                          confirmLabel="Sil"
                          destructive
                          onConfirm={() => removeMutation.mutate(section.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="theme" className="pt-4">
                <ThemeQuickForm storeId={storeId} theme={theme.data} onSaved={refreshAll} />
              </TabsContent>

              <TabsContent value="pages" className="space-y-2 pt-4">
                {(pages.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bu mağazada içerik sayfası yok.</p>
                ) : (
                  (pages.data ?? []).map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{page.title}</p>
                        <p className="truncate text-xs text-muted-foreground">/{page.slug}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`pub-${page.id}`} className="text-xs text-muted-foreground">
                          Yayında
                        </Label>
                        <Switch
                          id={`pub-${page.id}`}
                          checked={Boolean(page.is_published)}
                          onCheckedChange={(checked) =>
                            pageMutation.mutate({
                              pageId: page.id,
                              title: page.title,
                              slug: page.slug,
                              body: page.body ?? "",
                              isPublished: checked,
                              showInFooter: Boolean(page.show_in_footer),
                              sortOrder: Number(page.sort_order ?? 0),
                            })
                          }
                        />
                      </div>
                    </div>
                  ))
                )}
                <Button asChild variant="outline" size="sm">
                  <Link to="/store/$storeId/pages" params={{ storeId }}>
                    Sayfa içeriklerini düzenle
                  </Link>
                </Button>
              </TabsContent>
            </Tabs>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-3">
            {storefrontUrl ? (
              <div className="mx-auto overflow-hidden rounded-xl border border-border bg-background" style={{ width: DEVICES.find((item) => item.key === device)?.width }}>
                <iframe
                  key={previewKey}
                  title="Vitrin canlı önizleme"
                  src={storefrontUrl}
                  className="h-[70vh] w-full"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Önizleme için mağaza adresi bulunamadı.</p>
            )}
          </div>
        </div>
      </div>

    </AdminShell>
  );
}

type ThemeRow = Record<string, unknown> | null | undefined;

function ThemeQuickForm({
  storeId,
  theme,
  onSaved,
}: {
  storeId: string;
  theme: ThemeRow;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    primaryColor: "#111111",
    accentColor: "#7c3aed",
    backgroundColor: "#ffffff",
    heroTitle: "Mağazanıza hoş geldiniz",
    heroSubtitle: "",
    heroCtaLabel: "Alışverişe başla",
    announcement: "",
    showAnnouncement: false,
    isPublished: true,
  });

  useEffect(() => {
    if (!theme) return;
    const value = (key: string, fallback: string) => {
      const raw = (theme as Record<string, unknown>)[key];
      return typeof raw === "string" && raw ? raw : fallback;
    };
    setForm({
      primaryColor: value("primary_color", "#111111"),
      accentColor: value("accent_color", "#7c3aed"),
      backgroundColor: value("background_color", "#ffffff"),
      heroTitle: value("hero_title", "Mağazanıza hoş geldiniz"),
      heroSubtitle: value("hero_subtitle", ""),
      heroCtaLabel: value("hero_cta_label", "Alışverişe başla"),
      announcement: value("announcement", ""),
      showAnnouncement: Boolean((theme as Record<string, unknown>)["show_announcement"]),
      isPublished: Boolean((theme as Record<string, unknown>)["is_published"]),
    });
  }, [theme]);

  const mutation = useMutation({
    mutationFn: () =>
      saveTheme({
        data: {
          storeId,
          preset: String((theme as Record<string, unknown>)?.["preset"] ?? "modern"),
          primaryColor: form.primaryColor,
          accentColor: form.accentColor,
          backgroundColor: form.backgroundColor,
          fontPair: String((theme as Record<string, unknown>)?.["font_pair"] ?? "geist"),
          radius: Number((theme as Record<string, unknown>)?.["radius"] ?? 0.75),
          layout: String((theme as Record<string, unknown>)?.["layout"] ?? "modern"),
          heroTitle: form.heroTitle,
          heroSubtitle: form.heroSubtitle,
          heroCtaLabel: form.heroCtaLabel,
          announcement: form.announcement || null,
          showAnnouncement: form.showAnnouncement,
          logoUrl: (theme as Record<string, unknown>)?.["logo_url"]
            ? String((theme as Record<string, unknown>)["logo_url"])
            : null,
          buttonStyle: String((theme as Record<string, unknown>)?.["button_style"] ?? "solid") as
            | "solid"
            | "outline"
            | "pill"
            | "ghost"
            | "square",
          cardStyle: String((theme as Record<string, unknown>)?.["card_style"] ?? "soft") as
            | "soft"
            | "bordered"
            | "flat"
            | "shadow",
          contentWidth: Number((theme as Record<string, unknown>)?.["content_width"] ?? 1140),
          sectionSpacing: Number((theme as Record<string, unknown>)?.["section_spacing"] ?? 48),
          isPublished: form.isPublished,
        },
      }),
    onSuccess: () => {
      toast.success("Tema kaydedildi");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["primaryColor", "Ana renk"],
            ["accentColor", "Vurgu"],
            ["backgroundColor", "Zemin"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`t-${key}`} className="text-xs">
              {label}
            </Label>
            <Input
              id={`t-${key}`}
              type="color"
              value={form[key]}
              onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
              className="h-10 p-1"
            />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label htmlFor="t-heroTitle">Hero başlığı</Label>
        <Input
          id="t-heroTitle"
          value={form.heroTitle}
          onChange={(event) => setForm((prev) => ({ ...prev, heroTitle: event.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="t-heroSubtitle">Hero açıklaması</Label>
        <Textarea
          id="t-heroSubtitle"
          rows={2}
          value={form.heroSubtitle}
          onChange={(event) => setForm((prev) => ({ ...prev, heroSubtitle: event.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="t-heroCta">Buton metni</Label>
        <Input
          id="t-heroCta"
          value={form.heroCtaLabel}
          onChange={(event) => setForm((prev) => ({ ...prev, heroCtaLabel: event.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="t-announcement">Duyuru çubuğu</Label>
        <Input
          id="t-announcement"
          value={form.announcement}
          onChange={(event) => setForm((prev) => ({ ...prev, announcement: event.target.value }))}
        />
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <Label htmlFor="t-showAnnouncement" className="text-sm">
          Duyuruyu göster
        </Label>
        <Switch
          id="t-showAnnouncement"
          checked={form.showAnnouncement}
          onCheckedChange={(checked) => setForm((prev) => ({ ...prev, showAnnouncement: checked }))}
        />
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <Label htmlFor="t-isPublished" className="text-sm">
          Tema yayında
        </Label>
        <Switch
          id="t-isPublished"
          checked={form.isPublished}
          onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isPublished: checked }))}
        />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Kaydediliyor…" : "Temayı kaydet"}
      </Button>
    </form>
  );
}
