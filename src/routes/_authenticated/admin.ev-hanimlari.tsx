import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GripVertical, MessageCircle, Package, Pencil, Play, Plus, Tags, Trash2, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/mefti";

const DESCRIPTION = "Ev hanımları portalındaki akademi videolarını, ambalaj pazarını, kategori kurallarını ve hazır şablonları yönetin.";

export const Route = createFileRoute("/_authenticated/admin/ev-hanimlari")({
  head: () => ({
    meta: [
      { title: "Ev Hanımları İçerik Yönetimi — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Ev Hanımları İçerik Yönetimi — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHomeMakerContent,
});

type Section = "academy" | "packaging" | "categories" | "templates";
const SECTIONS: { key: Section; label: string; icon: typeof Video }[] = [
  { key: "academy", label: "Akademi Videoları", icon: Video },
  { key: "packaging", label: "Ambalaj Pazarı", icon: Package },
  { key: "categories", label: "Kategoriler", icon: Tags },
  { key: "templates", label: "Şablonlar", icon: MessageCircle },
];

function AdminHomeMakerContent() {
  const { isPlatformAdmin } = useAuth();
  const [section, setSection] = useState<Section>("academy");
  if (!isPlatformAdmin)
    return (
      <AdminShell title="Ev Hanımları İçerik Yönetimi">
        <p className="text-sm text-muted-foreground">Bu sayfa yalnızca süper yöneticiler içindir.</p>
      </AdminShell>
    );
  return (
    <AdminShell title="Ev Hanımları İçerik Yönetimi" description={DESCRIPTION}>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto md:flex-col">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-left text-sm font-medium ${section === key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/70"}`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {section === "academy" ? <AcademyManager /> : null}
          {section === "packaging" ? <PackagingManager /> : null}
          {section === "categories" ? <CategoryManager /> : null}
          {section === "templates" ? <TemplateManager /> : null}
        </div>
      </div>
    </AdminShell>
  );
}

function fail(e: unknown) {
  toast.error(e instanceof Error ? e.message : "İşlem başarısız");
}

/* -------------------------------- akademi -------------------------------- */

export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1, 12) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
      if (m) return m[2]!;
    }
  } catch {
    /* geçersiz adres */
  }
  return null;
}

const toMmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
const fromMmss = (v: string) => {
  const m = v.trim().match(/^(\d{1,3}):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const ACADEMY_CATEGORIES = ["Fotoğraf Çekimi", "Sosyal Medya", "Müşteri İlişkileri"];

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_seconds: number;
  video_url: string | null;
  sort_order: number;
  is_active: boolean;
};

function AcademyManager() {
  const qc = useQueryClient();
  const key = ["admin-academy"];
  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kolay_academy_lessons")
        .select("id, title, description, category, duration_seconds, video_url, sort_order, is_active")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Lesson[];
    },
  });
  const [edit, setEdit] = useState<Partial<Lesson> | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const toggle = useMutation({
    mutationFn: async (r: Lesson) => {
      const { error } = await supabase.from("kolay_academy_lessons").update({ is_active: !r.is_active }).eq("id", r.id);
      if (error) throw error;
      return !r.is_active;
    },
    onSuccess: (on) => { toast.success(on ? "Yayınlandı" : "Taslağa alındı"); void refresh(); },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kolay_academy_lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Video silindi"); void refresh(); },
    onError: fail,
  });
  const reorder = useMutation({
    mutationFn: async (ordered: Lesson[]) => {
      const results = await Promise.all(
        ordered.map((r, i) => supabase.from("kolay_academy_lessons").update({ sort_order: (i + 1) * 10 }).eq("id", r.id)),
      );
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
    },
    onSuccess: () => { toast.success("Sıralama kaydedildi"); void refresh(); },
    onError: fail,
  });

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const list = [...rows];
    const from = list.findIndex((r) => r.id === dragId);
    const to = list.findIndex((r) => r.id === targetId);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved!);
    qc.setQueryData(key, list);
    reorder.mutate(list);
    setDragId(null);
  }

  return (
    <section className="grid gap-4">
      <Header title="Akademi Videoları" onAdd={() => setEdit({ category: ACADEMY_CATEGORIES[0]!, is_active: false, duration_seconds: 60 })} />
      {isLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : null}
      <p className="text-xs text-muted-foreground">Sıralamak için satırı tutup sürükleyin.</p>
      <div className="grid gap-2">
        {rows.map((r) => {
          const vid = r.video_url ? youtubeId(r.video_url) : null;
          return (
            <div
              key={r.id}
              draggable
              onDragStart={() => setDragId(r.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(r.id)}
              className={`flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 ${dragId === r.id ? "opacity-50" : ""}`}
            >
              <GripVertical className="size-4 cursor-grab text-muted-foreground" />
              {vid ? (
                <button type="button" onClick={() => setPreview(vid)} className="relative h-12 w-20 overflow-hidden rounded bg-muted" aria-label="Önizle">
                  <img src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`} alt="" className="size-full object-cover" />
                  <Play className="absolute inset-0 m-auto size-5 text-primary-foreground drop-shadow" />
                </button>
              ) : <div className="grid h-12 w-20 place-items-center rounded bg-muted text-[10px] text-muted-foreground">Video yok</div>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.category ?? "—"} · {toMmss(r.duration_seconds)}</p>
              </div>
              <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Yayında" : "Taslak"}</Badge>
              <Switch checked={r.is_active} onCheckedChange={() => toggle.mutate(r)} aria-label="Yayınla / Taslak" />
              <Button size="icon" variant="ghost" onClick={() => setEdit(r)} aria-label="Düzenle"><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => confirm("Video silinsin mi?") && remove.mutate(r.id)} aria-label="Sil"><Trash2 className="size-4" /></Button>
            </div>
          );
        })}
      </div>
      {edit ? <LessonDialog value={edit} nextOrder={(rows.at(-1)?.sort_order ?? 0) + 10} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void refresh(); }} /> : null}
      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Video önizleme</DialogTitle></DialogHeader>
          {preview ? (
            <div className="aspect-video w-full overflow-hidden rounded-lg">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${preview}?autoplay=1`}
                title="YouTube video"
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="size-full"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LessonDialog({ value, nextOrder, onClose, onSaved }: { value: Partial<Lesson>; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(value.title ?? "");
  const [url, setUrl] = useState(value.video_url ?? "");
  const [duration, setDuration] = useState(toMmss(value.duration_seconds ?? 60));
  const [category, setCategory] = useState(value.category ?? ACADEMY_CATEGORIES[0]!);
  const [description, setDescription] = useState(value.description ?? "");
  const [active, setActive] = useState(value.is_active ?? false);
  const cats = Array.from(new Set([...ACADEMY_CATEGORIES, category]));
  const save = useMutation({
    mutationFn: async () => {
      const vid = youtubeId(url);
      if (!vid) throw new Error("Geçerli bir YouTube adresi veya video kimliği girin");
      const secs = fromMmss(duration);
      if (secs === null || secs < 1) throw new Error("Süreyi 01:00 biçiminde yazın");
      if (title.trim().length < 2) throw new Error("Başlık en az 2 harf olmalı");
      const row = {
        title: title.trim(),
        video_url: `https://www.youtube.com/watch?v=${vid}`,
        thumbnail_url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        duration_seconds: secs,
        category,
        description: description.trim() || null,
        is_active: active,
      };
      const { error } = value.id
        ? await supabase.from("kolay_academy_lessons").update(row).eq("id", value.id)
        : await supabase.from("kolay_academy_lessons").insert({ ...row, sort_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Video kaydedildi"); onSaved(); },
    onError: fail,
  });
  return (
    <FormDialog title={value.id ? "Videoyu düzenle" : "Yeni video"} onClose={onClose} onSave={() => save.mutate()} saving={save.isPending}>
      <F label="YouTube adresi veya kimliği"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></F>
      <F label="Video başlığı"><Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></F>
      <div className="grid grid-cols-2 gap-3">
        <F label="Süre (dk:sn)"><Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="01:00" /></F>
        <F label="Kategori">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        </F>
      </div>
      <F label="Açıklama"><Textarea value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} /></F>
      <label className="flex items-center gap-2 text-sm"><Switch checked={active} onCheckedChange={setActive} /> {active ? "Yayınla" : "Taslak"}</label>
    </FormDialog>
  );
}

/* -------------------------------- ambalaj -------------------------------- */

const PACK_CATEGORIES = ["Koli/Kutu", "Kavanoz/Şişe", "Ambalaj Poşeti", "Kurdele/Süsleme"];
type PackItem = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  pack_size: number;
  list_price: number;
  sale_price: number;
  image_url: string | null;
  in_stock: boolean;
  is_active: boolean;
  sort_order: number;
};

function PackagingManager() {
  const qc = useQueryClient();
  const key = ["admin-packaging"];
  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kolay_packaging_items")
        .select("id, title, description, category, unit, pack_size, list_price, sale_price, image_url, in_stock, is_active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as PackItem[];
    },
  });
  const [edit, setEdit] = useState<Partial<PackItem> | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const patch = useMutation({
    mutationFn: async ({ id, ...p }: { id: string; in_stock?: boolean; is_active?: boolean }) => {
      const { error } = await supabase.from("kolay_packaging_items").update(p).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Güncellendi"); void refresh(); },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kolay_packaging_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ürün silindi"); void refresh(); },
    onError: () => toast.error("Silinemedi. Bu ürünle verilmiş siparişler varsa yayından kaldırın."),
  });
  return (
    <section className="grid gap-4">
      <Header title="Ambalaj Pazarı" onAdd={() => setEdit({ category: PACK_CATEGORIES[0]!, in_stock: true, is_active: true, pack_size: 1 })} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <div key={r.id} className="grid gap-2 rounded-lg border bg-card p-3">
            <div className="aspect-[4/3] overflow-hidden rounded bg-muted">
              {r.image_url ? <img src={r.image_url} alt={r.title} className="size-full object-cover" /> : null}
            </div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.category ?? "—"} · {r.pack_size} {r.unit ?? "adet"}</p>
              </div>
              <Badge variant={r.in_stock ? "default" : "destructive"}>{r.in_stock ? "Stokta Var" : "Tükendi"}</Badge>
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground line-through">{formatMoney(Number(r.list_price))}</span>{" "}
              <b>{formatMoney(Number(r.sale_price))}</b> <span className="text-xs text-muted-foreground">toplu fiyat</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1"><Switch checked={r.in_stock} onCheckedChange={(v) => patch.mutate({ id: r.id, in_stock: v })} /> Stok</label>
              <label className="flex items-center gap-1"><Switch checked={r.is_active} onCheckedChange={(v) => patch.mutate({ id: r.id, is_active: v })} /> Yayında</label>
              <span className="flex-1" />
              <Button size="icon" variant="ghost" onClick={() => setEdit(r)} aria-label="Düzenle"><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => confirm("Ürün silinsin mi?") && remove.mutate(r.id)} aria-label="Sil"><Trash2 className="size-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      {edit ? <PackDialog value={edit} nextOrder={(rows.at(-1)?.sort_order ?? 0) + 10} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void refresh(); }} /> : null}
    </section>
  );
}

function PackDialog({ value, nextOrder, onClose, onSaved }: { value: Partial<PackItem>; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: value.title ?? "",
    description: value.description ?? "",
    category: value.category ?? PACK_CATEGORIES[0]!,
    unit: value.unit ?? "adet",
    pack_size: String(value.pack_size ?? 1),
    list_price: value.list_price != null ? String(value.list_price) : "",
    sale_price: value.sale_price != null ? String(value.sale_price) : "",
    image_url: value.image_url ?? "",
    in_stock: value.in_stock ?? true,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const cats = Array.from(new Set([...PACK_CATEGORIES, f.category]));
  const save = useMutation({
    mutationFn: async () => {
      const list = Number(f.list_price.replace(",", "."));
      const sale = Number(f.sale_price.replace(",", "."));
      const size = Math.trunc(Number(f.pack_size));
      if (f.title.trim().length < 2) throw new Error("Ürün adı en az 2 harf olmalı");
      if (!(list > 0) || !(sale > 0)) throw new Error("Fiyatlar sıfırdan büyük olmalı");
      if (sale > list) throw new Error("Toplu fiyat birim fiyattan yüksek olamaz");
      if (!(size >= 1)) throw new Error("Paket adedi en az 1 olmalı");
      if (f.image_url && !/^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(f.image_url.trim())) throw new Error("Geçerli bir fotoğraf seçin");
      const row = {
        title: f.title.trim(),
        description: f.description.trim() || null,
        category: f.category,
        unit: f.unit.trim() || "adet",
        pack_size: size,
        list_price: list,
        sale_price: sale,
        image_url: f.image_url.trim() || null,
        in_stock: f.in_stock,
      };
      const { error } = value.id
        ? await supabase.from("kolay_packaging_items").update(row).eq("id", value.id)
        : await supabase.from("kolay_packaging_items").insert({ ...row, sort_order: nextOrder, is_active: true, currency: "TRY" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ambalaj ürünü kaydedildi"); onSaved(); },
    onError: fail,
  });
  return (
    <FormDialog title={value.id ? "Ürünü düzenle" : "Yeni ambalaj ürünü"} onClose={onClose} onSave={() => save.mutate()} saving={save.isPending}>
      <F label="Ürün adı"><Input value={f.title} maxLength={120} onChange={(e) => set("title", e.target.value)} /></F>
      <F label="Fotoğraf yükle (veritabanına kaydedilir)">
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try { set("image_url", await compressToDataUrl(file)); } catch { toast.error("Fotoğraf okunamadı"); }
          }}
        />
      </F>
      {f.image_url ? <Button type="button" variant="outline" size="sm" onClick={() => set("image_url", "")}>Fotoğrafı kaldır</Button> : null}
      {f.image_url ? <img src={f.image_url} alt="" className="h-28 w-full rounded object-cover" /> : null}
      <div className="grid grid-cols-2 gap-3">
        <F label="Birim fiyat (₺)"><Input inputMode="decimal" value={f.list_price} onChange={(e) => set("list_price", e.target.value)} /></F>
        <F label="İndirimli toplu fiyat (₺)"><Input inputMode="decimal" value={f.sale_price} onChange={(e) => set("sale_price", e.target.value)} /></F>
        <F label="Paket adedi"><Input inputMode="numeric" value={f.pack_size} onChange={(e) => set("pack_size", e.target.value)} /></F>
        <F label="Birim"><Input value={f.unit} maxLength={20} onChange={(e) => set("unit", e.target.value)} /></F>
      </div>
      <F label="Kategori">
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={f.category} onChange={(e) => set("category", e.target.value)}>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
      </F>
      <F label="Açıklama"><Textarea value={f.description} maxLength={400} onChange={(e) => set("description", e.target.value)} /></F>
      <label className="flex items-center gap-2 text-sm"><Switch checked={f.in_stock} onCheckedChange={(v) => set("in_stock", v)} /> {f.in_stock ? "Stokta Var" : "Tükendi"}</label>
    </FormDialog>
  );
}

/* ------------------------------- kategoriler ------------------------------ */

type Rule = { id: string; main_name: string; sub_name: string; keywords: string[]; sort_order: number; is_active: boolean };

function CategoryManager() {
  const qc = useQueryClient();
  const key = ["admin-category-rules"];
  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("kolay_category_rules").select("id, main_name, sub_name, keywords, sort_order, is_active").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });
  const [edit, setEdit] = useState<Partial<Rule> | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const toggle = useMutation({
    mutationFn: async (r: Rule) => {
      const { error } = await supabase.from("kolay_category_rules").update({ is_active: !r.is_active }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Güncellendi"); void refresh(); },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kolay_category_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Kategori silindi"); void refresh(); },
    onError: fail,
  });
  const groups = rows.reduce<Record<string, Rule[]>>((acc, r) => ((acc[r.main_name] ??= []).push(r), acc), {});
  return (
    <section className="grid gap-4">
      <Header title="Kategoriler ve Anahtar Kelimeler" onAdd={() => setEdit({ keywords: [] })} />
      <p className="text-xs text-muted-foreground">Ürün adında bu kelimeler geçtiğinde ilgili kategori ev hanımlarına otomatik önerilir.</p>
      {Object.entries(groups).map(([main, subs]) => (
        <div key={main} className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="font-semibold">{main}</p>
            <Button size="sm" variant="ghost" onClick={() => setEdit({ main_name: main, keywords: [] })}><Plus className="size-4" /> Alt kategori</Button>
          </div>
          {subs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 border-b px-3 py-2 last:border-0">
              <p className="min-w-40 font-medium">{r.sub_name}</p>
              <div className="flex flex-1 flex-wrap gap-1">
                {r.keywords.map((k) => <Badge key={k} variant="outline">{k}</Badge>)}
              </div>
              <Switch checked={r.is_active} onCheckedChange={() => toggle.mutate(r)} aria-label="Aktif" />
              <Button size="icon" variant="ghost" onClick={() => setEdit(r)} aria-label="Düzenle"><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => confirm("Kategori silinsin mi?") && remove.mutate(r.id)} aria-label="Sil"><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      ))}
      {edit ? <RuleDialog value={edit} mains={Object.keys(groups)} nextOrder={(rows.at(-1)?.sort_order ?? 0) + 1} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void refresh(); }} /> : null}
    </section>
  );
}

function RuleDialog({ value, mains, nextOrder, onClose, onSaved }: { value: Partial<Rule>; mains: string[]; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [main, setMain] = useState(value.main_name ?? "");
  const [sub, setSub] = useState(value.sub_name ?? "");
  const [kw, setKw] = useState((value.keywords ?? []).join(", "));
  const save = useMutation({
    mutationFn: async () => {
      const keywords = Array.from(new Set(kw.split(",").map((k) => k.trim().toLocaleLowerCase("tr-TR")).filter((k) => k.length >= 2 && k.length <= 40))).slice(0, 40);
      if (main.trim().length < 2 || sub.trim().length < 2) throw new Error("Kategori adları en az 2 harf olmalı");
      const row = { main_name: main.trim(), sub_name: sub.trim(), keywords };
      const { error } = value.id
        ? await supabase.from("kolay_category_rules").update(row).eq("id", value.id)
        : await supabase.from("kolay_category_rules").insert({ ...row, sort_order: nextOrder });
      if (error) throw new Error(error.code === "23505" ? "Bu kategori zaten var" : error.message);
    },
    onSuccess: () => { toast.success("Kategori kaydedildi"); onSaved(); },
    onError: fail,
  });
  return (
    <FormDialog title={value.id ? "Kategoriyi düzenle" : "Yeni kategori"} onClose={onClose} onSave={() => save.mutate()} saving={save.isPending}>
      <F label="Ana kategori">
        <Input list="hm-mains" value={main} maxLength={38} onChange={(e) => setMain(e.target.value)} />
        <datalist id="hm-mains">{mains.map((m) => <option key={m} value={m} />)}</datalist>
      </F>
      <F label="Alt kategori"><Input value={sub} maxLength={38} onChange={(e) => setSub(e.target.value)} /></F>
      <F label="Anahtar kelimeler (virgülle ayırın)"><Textarea value={kw} onChange={(e) => setKw(e.target.value)} placeholder="mantı, erişte, tarhana" /></F>
    </FormDialog>
  );
}

/* -------------------------------- şablonlar ------------------------------- */

type Tpl = { id: string; kind: "whatsapp" | "thank_you"; label: string; body: string; sort_order: number; is_active: boolean };

function TemplateManager() {
  const qc = useQueryClient();
  const key = ["admin-system-templates"];
  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("kolay_system_templates").select("id, kind, label, body, sort_order, is_active").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Tpl[];
    },
  });
  const [edit, setEdit] = useState<Partial<Tpl> | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const toggle = useMutation({
    mutationFn: async (r: Tpl) => {
      const { error } = await supabase.from("kolay_system_templates").update({ is_active: !r.is_active }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Güncellendi"); void refresh(); },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kolay_system_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Şablon silindi"); void refresh(); },
    onError: fail,
  });
  return (
    <section className="grid gap-6">
      {(["whatsapp", "thank_you"] as const).map((kind) => (
        <div key={kind} className="grid gap-3">
          <Header title={kind === "whatsapp" ? "WhatsApp Hızlı Cevaplar" : "Teşekkür Kartı Metinleri"} onAdd={() => setEdit({ kind })} />
          {kind === "whatsapp" ? (
            <p className="text-xs text-muted-foreground">Kullanılabilir alanlar: {"{selam}"} {"{magaza}"} {"{link}"} {"{kargo}"} {"{detay}"}</p>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2">
            {rows.filter((r) => r.kind === kind).map((r) => (
              <div key={r.id} className="grid gap-2 rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2">
                  <p className="flex-1 font-medium">{r.label}</p>
                  <Switch checked={r.is_active} onCheckedChange={() => toggle.mutate(r)} aria-label="Aktif" />
                  <Button size="icon" variant="ghost" onClick={() => setEdit(r)} aria-label="Düzenle"><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Şablon silinsin mi?") && remove.mutate(r.id)} aria-label="Sil"><Trash2 className="size-4" /></Button>
                </div>
                <p className="whitespace-pre-line rounded bg-muted p-2 text-sm">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      {edit ? <TplDialog value={edit} nextOrder={(rows.at(-1)?.sort_order ?? 0) + 1} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void refresh(); }} /> : null}
    </section>
  );
}

function TplDialog({ value, nextOrder, onClose, onSaved }: { value: Partial<Tpl>; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(value.label ?? "");
  const [body, setBody] = useState(value.body ?? "");
  const save = useMutation({
    mutationFn: async () => {
      if (label.trim().length < 2 || body.trim().length < 2) throw new Error("Ad ve metin boş olamaz");
      const row = { label: label.trim(), body: body.trim() };
      const { error } = value.id
        ? await supabase.from("kolay_system_templates").update(row).eq("id", value.id)
        : await supabase.from("kolay_system_templates").insert({ ...row, kind: value.kind!, sort_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Şablon kaydedildi"); onSaved(); },
    onError: fail,
  });
  return (
    <FormDialog title={value.id ? "Şablonu düzenle" : "Yeni şablon"} onClose={onClose} onSave={() => save.mutate()} saving={save.isPending}>
      <F label="Şablon adı"><Input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} /></F>
      <F label="Metin"><Textarea className="min-h-32" value={body} maxLength={600} onChange={(e) => setBody(e.target.value)} /></F>
    </FormDialog>
  );
}

/* --------------------------------- ortak --------------------------------- */

function Header({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button onClick={onAdd}><Plus className="size-4" /> Ekle</Button>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FormDialog({ title, children, onClose, onSave, saving }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Fotoğrafı 600px'e küçültüp WebP olarak veri adresine çevirir (≈50 KB). */
async function compressToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.8);
}
