import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Field, Sheet, inputClass } from "@/components/homemaker/kolay-parts";
import { supabase } from "@/integrations/supabase/client";

type Sub = { name: string; keywords: string[]; customId?: string };
type Main = { name: string; keywords: string[]; subs: Sub[] };

export const CATEGORY_PRESETS: Main[] = [
  {
    name: "El Emeği Örgü & Tekstil",
    keywords: ["örgü", "orgu", "tekstil", "yün", "ip", "el emeği"],
    subs: [
      { name: "Bebek Patiği", keywords: ["patik", "bebek patiği", "bebek çorabı"] },
      { name: "Amigurumi", keywords: ["amigurumi", "oyuncak", "bebek", "ayıcık", "tavşan"] },
      { name: "Dantel", keywords: ["dantel", "tığ", "sehpa örtüsü", "örtü"] },
      { name: "Nakış", keywords: ["nakış", "işleme", "kanaviçe", "etamin"] },
      { name: "Kazak & Hırka", keywords: ["kazak", "hırka", "yelek", "atkı", "bere", "şal"] },
    ],
  },
  {
    name: "Ev Yapımı Gıda",
    keywords: ["ev yapımı", "yöresel", "gıda", "lezzet"],
    subs: [
      { name: "Mantı, Erişte & Tarhana", keywords: ["mantı", "erişte", "tarhana", "kuskus", "makarna"] },
      { name: "Reçel & Salça", keywords: ["reçel", "salça", "marmelat", "pekmez", "bal"] },
      { name: "Baklava & Börek", keywords: ["baklava", "börek", "yufka", "gözleme", "poğaça", "kurabiye", "kek", "pasta"] },
      { name: "Turşu", keywords: ["turşu", "kış hazırlığı", "konserve"] },
    ],
  },
  {
    name: "Takı & Aksesuar",
    keywords: ["takı", "aksesuar", "kolye", "bileklik", "küpe"],
    subs: [
      { name: "İğne Oyası", keywords: ["oya", "iğne oyası", "yazma", "tülbent"] },
      { name: "Doğal Taş", keywords: ["doğal taş", "taş", "kolye", "bileklik", "küpe"] },
      { name: "Örgü Çanta", keywords: ["çanta", "örgü çanta", "cüzdan", "makyaj çantası"] },
      { name: "Toka", keywords: ["toka", "saç bandı", "taç", "scrunchie"] },
    ],
  },
  {
    name: "Ev Dekorasyon",
    keywords: ["dekor", "dekorasyon", "süs"],
    subs: [
      { name: "Kokulu Taş", keywords: ["kokulu taş", "koku", "oda kokusu"] },
      { name: "Mum", keywords: ["mum", "soya mum"] },
      { name: "Makrome", keywords: ["makrome", "duvar süsü", "saksı askısı"] },
      { name: "Epoksi", keywords: ["epoksi", "reçine", "tepsi", "bardak altlığı"] },
    ],
  },
  {
    name: "Özel Gün & Çeyiz",
    keywords: ["özel gün", "çeyiz", "düğün", "nişan"],
    subs: [
      { name: "Nikah Şekeri", keywords: ["nikah şekeri", "nikah", "söz", "nişan şekeri"] },
      { name: "Bebek Mevlüdü", keywords: ["mevlüt", "mevlit", "diş buğdayı", "bebek şekeri"] },
      { name: "Kına Çeyizi", keywords: ["kına", "çeyiz", "bohça", "havlu"] },
    ],
  },
];

export const categoryLabel = (main: string, sub: string) => `${main} > ${sub}`;

function norm(s: string) {
  return s.toLocaleLowerCase("tr-TR").normalize("NFC").trim();
}

export function suggestCategory(title: string, tree: Main[]): { main: string; sub: string } | null {
  const t = norm(title);
  if (t.length < 3) return null;
  let best: { main: string; sub: string; score: number } | null = null;
  for (const m of tree) {
    const mainHit = m.keywords.some((k) => t.includes(norm(k))) ? 1 : 0;
    for (const s of m.subs) {
      const score = [s.name, ...s.keywords].reduce((acc, k) => (t.includes(norm(k)) ? acc + 2 + norm(k).length / 10 : acc), 0) + mainHit;
      if (score > 1 && (!best || score > best.score)) best = { main: m.name, sub: s.name, score };
    }
  }
  return best ? { main: best.main, sub: best.sub } : null;
}

type CustomRow = { id: string; main_name: string; sub_name: string };

function useCustomCategories(storeId: string) {
  return useQuery({
    queryKey: ["kolay-custom-categories", storeId],
    queryFn: async (): Promise<CustomRow[]> => {
      const { data, error } = await supabase
        .from("kolay_custom_categories")
        .select("id, main_name, sub_name")
        .eq("store_id", storeId)
        .order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

type RuleRow = { main_name: string; sub_name: string; keywords: string[] };

/** Süper admin'in yönettiği kategori/anahtar kelime kuralları. Boşsa hazır liste kullanılır. */
function useCategoryRules() {
  return useQuery({
    queryKey: ["kolay-category-rules"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RuleRow[]> => {
      const { data, error } = await supabase
        .from("kolay_category_rules")
        .select("main_name, sub_name, keywords")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

function rulesToTree(rules: RuleRow[] | undefined): Main[] {
  if (!rules || rules.length === 0) return CATEGORY_PRESETS.map((m) => ({ ...m, subs: [...m.subs] }));
  const tree: Main[] = [];
  for (const r of rules) {
    let main = tree.find((m) => m.name === r.main_name);
    if (!main) {
      main = { name: r.main_name, keywords: [], subs: [] };
      tree.push(main);
    }
    main.subs.push({ name: r.sub_name, keywords: r.keywords });
  }
  return tree;
}

function buildTree(custom: CustomRow[], rules: RuleRow[] | undefined): Main[] {
  const tree: Main[] = rulesToTree(rules);
  for (const c of custom) {
    let main = tree.find((m) => norm(m.name) === norm(c.main_name));
    if (!main) {
      main = { name: c.main_name, keywords: [], subs: [] };
      tree.push(main);
    }
    if (!main.subs.some((s) => norm(s.name) === norm(c.sub_name)))
      main.subs.push({ name: c.sub_name, keywords: [c.sub_name], customId: c.id });
  }
  return tree;
}

/** Ürün adından kategori öneren, aranabilir kategori seçici. value = "Ana > Alt". */
export function SmartCategoryPicker({
  storeId,
  title,
  value,
  onChange,
}: {
  storeId: string;
  title: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { data: custom = [] } = useCustomCategories(storeId);
  const { data: rules } = useCategoryRules();
  const tree = useMemo(() => buildTree(custom, rules), [custom, rules]);
  const [manual, setManual] = useState(false);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const suggestion = useMemo(() => suggestCategory(title, tree), [title, tree]);
  const lastToast = useRef("");

  useEffect(() => {
    if (manual || !suggestion) return;
    const label = categoryLabel(suggestion.main, suggestion.sub);
    if (label !== value) {
      onChange(label);
      if (lastToast.current !== label) {
        lastToast.current = label;
        toast.success(`Kategori seçildi: ${suggestion.sub}`, { id: "cat-suggest" });
      }
    }
  }, [suggestion, manual, value, onChange]);

  const isSuggested = !manual && suggestion && categoryLabel(suggestion.main, suggestion.sub) === value;

  return (
    <Field label="Kategori">
      <div className="grid gap-2">
        {isSuggested ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-hm-teal-soft px-3 py-2 text-sm text-hm-teal">
            <Sparkles className="size-4 shrink-0" />
            <span>
              Önerilen Kategori: <b>{suggestion.main}</b>
            </span>
            <button type="button" onClick={() => setOpen(true)} className="font-semibold underline">
              (Değiştir)
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${inputClass} flex min-h-12 items-center justify-between text-left`}
        >
          <span className={value ? "text-hm-ink" : "text-hm-ink-soft"}>{value || "Kategori seçin"}</span>
          <Search className="size-4 text-hm-ink-soft" />
        </button>
      </div>
      <PickerSheet
        open={open}
        onClose={() => setOpen(false)}
        tree={tree}
        value={value}
        onPick={(label) => {
          setManual(true);
          onChange(label);
          setOpen(false);
          toast.success("Kategori güncellendi");
        }}
        onCreate={() => setCreating(true)}
        storeId={storeId}
      />
      <CreateSheet
        open={creating}
        onClose={() => setCreating(false)}
        storeId={storeId}
        mains={tree.map((m) => m.name)}
        onCreated={(label) => {
          setManual(true);
          onChange(label);
          setCreating(false);
          setOpen(false);
        }}
      />
    </Field>
  );
}

function PickerSheet({
  open,
  onClose,
  tree,
  value,
  onPick,
  onCreate,
  storeId,
}: {
  open: boolean;
  onClose: () => void;
  tree: Main[];
  value: string;
  onPick: (label: string) => void;
  onCreate: () => void;
  storeId: string;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = norm(q);
    if (!n) return tree;
    return tree
      .map((m) => {
        const mainMatch = norm(m.name).includes(n) || m.keywords.some((k) => norm(k).includes(n));
        const subs = mainMatch ? m.subs : m.subs.filter((s) => [s.name, ...s.keywords].some((k) => norm(k).includes(n)));
        return { ...m, subs };
      })
      .filter((m) => m.subs.length > 0);
  }, [q, tree]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kolay_custom_categories").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Kategori silindi");
      void qc.invalidateQueries({ queryKey: ["kolay-custom-categories", storeId] });
    },
    onError: () => toast.error("Kategori silinemedi"),
  });

  return (
    <Sheet open={open} onClose={onClose} title="Kategori seç">
      <div className="grid gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-hm-ink-soft" />
          <input
            autoFocus
            className={`${inputClass} pl-9`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara: örgü, mantı, mum…"
          />
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-hm-rose bg-hm-rose-soft text-sm font-semibold text-hm-rose"
        >
          <Plus className="size-4" /> Kendi Kategorini Ekle
        </button>
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-hm-ink-soft">Sonuç yok. Kendi kategorinizi ekleyebilirsiniz.</p>
        ) : null}
        <div className="grid max-h-[55vh] gap-3 overflow-y-auto">
          {filtered.map((m) => (
            <div key={m.name}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-hm-amber">{m.name}</p>
              <div className="grid gap-1">
                {m.subs.map((s) => {
                  const label = categoryLabel(m.name, s.name);
                  const active = label === value;
                  return (
                    <div key={s.name} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onPick(label)}
                        className={`flex min-h-12 flex-1 items-center justify-between rounded-2xl px-4 text-left text-sm ${active ? "bg-hm-teal text-white" : "bg-hm-sand text-hm-ink"}`}
                      >
                        {s.name}
                        {active ? <Check className="size-4" /> : null}
                      </button>
                      {s.customId ? (
                        <button
                          type="button"
                          aria-label={`${s.name} kategorisini sil`}
                          onClick={() => remove.mutate(s.customId!)}
                          className="grid size-12 place-items-center rounded-2xl text-hm-ink-soft"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function CreateSheet({
  open,
  onClose,
  storeId,
  mains,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  storeId: string;
  mains: string[];
  onCreated: (label: string) => void;
}) {
  const qc = useQueryClient();
  const [main, setMain] = useState(mains[0] ?? "");
  const [newMain, setNewMain] = useState("");
  const [sub, setSub] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const m = (main === "__new" ? newMain : main).trim();
      const s = sub.trim();
      if (m.length < 2 || s.length < 2) throw new Error("short");
      const { error } = await supabase.from("kolay_custom_categories").insert({ store_id: storeId, main_name: m, sub_name: s });
      if (error && error.code !== "23505") throw new Error(error.message);
      return categoryLabel(m, s);
    },
    onSuccess: (label) => {
      toast.success("Yeni kategoriniz eklendi 🌸");
      void qc.invalidateQueries({ queryKey: ["kolay-custom-categories", storeId] });
      setSub("");
      setNewMain("");
      onCreated(label);
    },
    onError: (e) => toast.error(e.message === "short" ? "Adlar en az 2 harf olmalı" : "Kategori eklenemedi"),
  });
  return (
    <Sheet open={open} onClose={onClose} title="Kendi Kategorini Ekle">
      <div className="grid gap-3">
        <Field label="Ana kategori">
          <select className={inputClass} value={main} onChange={(e) => setMain(e.target.value)}>
            {mains.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="__new">＋ Yeni ana kategori</option>
          </select>
        </Field>
        {main === "__new" ? (
          <Field label="Yeni ana kategori adı">
            <input className={inputClass} maxLength={38} value={newMain} onChange={(e) => setNewMain(e.target.value)} placeholder="Örn: Doğal Kozmetik" />
          </Field>
        ) : null}
        <Field label="Kategori adı">
          <input className={inputClass} maxLength={38} value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Örn: Keçi Sütü Sabunu" />
        </Field>
        <button
          type="button"
          disabled={create.isPending}
          onClick={() => create.mutate()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-hm-rose text-sm font-semibold text-white disabled:opacity-60"
        >
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Kaydet
        </button>
      </div>
    </Sheet>
  );
}
