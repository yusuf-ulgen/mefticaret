import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { collectionsQuery, productsQuery } from "@/lib/catalog-queries";
import { paymentMethodsQuery, shippingZonesQuery } from "@/lib/commerce-queries";
import { buildStorefrontCommerce } from "@/lib/storefront-commerce";
import type { SectionProduct } from "@/components/storefront-sections";
import { myStoresQuery, storeQuery } from "@/lib/store-queries";
import type { DesignTokens } from "@/lib/theme-design";
import { storeThemeQuery } from "@/lib/theme-queries";
import { themeSectionsQuery } from "@/lib/theme-sections-queries";
import type { ResolvedSection, SectionSettings, ThemeSectionType } from "@/lib/theme-sections";
import {
  addThemeSection,
  removeThemeSection,
  reorderThemeSections,
  updateThemeSection,
} from "@/lib/theme-sections.functions";
import { publishThemeVersion } from "@/lib/theme-versions.functions";

import {
  EMPTY_DRAFT,
  draftFromSections,
  groupOf,
  sameDraft,
  type StudioDraft,
  type StudioGroup,
  type StudioItem,
} from "./studio-model";

const HISTORY_LIMIT = 60;

/**
 * Tema Stüdyosu'nun tüm durumu ve sunucu işlemleri.
 * Bileşenler yalnızca sunum yapar; tüm yazma işlemleri server function'lardan geçer.
 */
export function useThemeStudio(storeId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const sectionsQuery = useQuery(themeSectionsQuery(storeId));
  const { data: theme } = useQuery(storeThemeQuery(storeId));
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: stores } = useQuery(myStoresQuery(user?.id));
  const { data: products } = useQuery(productsQuery(storeId));
  const { data: collections } = useQuery(collectionsQuery(storeId));
  const { data: shippingZones } = useQuery(shippingZonesQuery(storeId));
  const { data: paymentMethods } = useQuery(paymentMethodsQuery(storeId));

  const sections = sectionsQuery.data;

  const add = useServerFn(addThemeSection);
  const update = useServerFn(updateThemeSection);
  const remove = useServerFn(removeThemeSection);
  const reorder = useServerFn(reorderThemeSections);
  const publish = useServerFn(publishThemeVersion);

  const [history, setHistory] = useState<StudioDraft[]>([EMPTY_DRAFT]);
  const [cursor, setCursor] = useState(0);
  const baseRef = useRef<StudioDraft>(EMPTY_DRAFT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [designDraft, setDesignDraft] = useState<DesignTokens | null>(null);

  const draft = history[cursor] ?? baseRef.current;

  useEffect(() => {
    if (!sections) return;
    const next = draftFromSections(sections);
    if (!sameDraft(next, baseRef.current)) {
      baseRef.current = next;
      setHistory([next]);
      setCursor(0);
    }
    setSelectedId((current) => (current && next.items[current] ? current : (next.order[0] ?? null)));
  }, [sections]);

  const commit = useCallback(
    (next: StudioDraft) => {
      setHistory((current) => {
        const trimmed = [...current.slice(0, cursor + 1), next].slice(-HISTORY_LIMIT);
        setCursor(trimmed.length - 1);
        return trimmed;
      });
    },
    [cursor],
  );

  const dirty = !sameDraft(draft, baseRef.current);
  const canUndo = cursor > 0;
  const canRedo = cursor < history.length - 1;
  const undo = useCallback(() => setCursor((c) => (c > 0 ? c - 1 : c)), []);
  const redo = useCallback(() => setCursor((c) => (c < history.length - 1 ? c + 1 : c)), [history.length]);

  const sectionById = useMemo(
    () => new Map((sections ?? []).map((section) => [section.id, section])),
    [sections],
  );

  const items: StudioItem[] = useMemo(
    () =>
      draft.order
        .map((id) => {
          const section = sectionById.get(id);
          const entry = draft.items[id];
          if (!section || !entry) return null;
          return { id, isEnabled: entry.isEnabled, settings: entry.settings, section } satisfies StudioItem;
        })
        .filter((item): item is StudioItem => item !== null),
    [draft, sectionById],
  );

  const groups = useMemo(() => {
    const map: Record<StudioGroup, StudioItem[]> = { header: [], body: [], footer: [] };
    for (const item of items) map[groupOf(item.section)].push(item);
    return map;
  }, [items]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const setSetting = useCallback(
    (key: string, value: string | number | boolean) => {
      if (!selectedId) return;
      const entry = draft.items[selectedId];
      if (!entry) return;
      commit({
        order: draft.order,
        items: { ...draft.items, [selectedId]: { ...entry, settings: { ...entry.settings, [key]: value } } },
      });
    },
    [commit, draft, selectedId],
  );

  const setSettings = useCallback(
    (next: SectionSettings) => {
      if (!selectedId) return;
      const entry = draft.items[selectedId];
      if (!entry) return;
      commit({ order: draft.order, items: { ...draft.items, [selectedId]: { ...entry, settings: next } } });
    },
    [commit, draft, selectedId],
  );

  const toggleSection = useCallback(
    (id: string) => {
      const entry = draft.items[id];
      if (!entry) return;
      commit({ order: draft.order, items: { ...draft.items, [id]: { ...entry, isEnabled: !entry.isEnabled } } });
    },
    [commit, draft],
  );

  /** Grup içindeki yeni sıra, tam sıralamaya geri yazılır. */
  const reorderGroup = useCallback(
    (group: StudioGroup, ids: string[]) => {
      const next: Record<StudioGroup, string[]> = {
        header: groups.header.map((item) => item.id),
        body: groups.body.map((item) => item.id),
        footer: groups.footer.map((item) => item.id),
      };
      next[group] = ids;
      commit({ order: [...next.header, ...next.body, ...next.footer], items: draft.items });
    },
    [commit, draft.items, groups],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["theme-sections", storeId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const base = baseRef.current;
      const snapshot = draft;
      if (JSON.stringify(base.order) !== JSON.stringify(snapshot.order)) {
        await reorder({ data: { storeId, sectionIds: snapshot.order } });
      }
      for (const id of snapshot.order) {
        const next = snapshot.items[id];
        const previous = base.items[id];
        const section = sectionById.get(id);
        if (!next || !section) continue;
        if (previous && JSON.stringify(previous) === JSON.stringify(next)) continue;
        await update({
          data: {
            storeId,
            sectionId: id,
            type: section.type,
            isEnabled: next.isEnabled,
            settings: next.settings,
          },
        });
      }
      return snapshot;
    },
    onSuccess: async (snapshot) => {
      baseRef.current = snapshot;
      setSavedAt(new Date());
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addMutation = useMutation({
    mutationFn: (type: ThemeSectionType) => add({ data: { storeId, type } }),
    onSuccess: async (created) => {
      await invalidate();
      const id = (created as { id?: string } | null)?.id;
      if (id) setSelectedId(id);
      toast.success("Bölüm eklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const source = items.find((item) => item.id === sectionId);
      if (!source) throw new Error("Bölüm bulunamadı");
      const created = (await add({ data: { storeId, type: source.section.type } })) as { id?: string } | null;
      if (created?.id) {
        await update({
          data: {
            storeId,
            sectionId: created.id,
            type: source.section.type,
            isEnabled: source.isEnabled,
            settings: source.settings,
          },
        });
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Bölüm çoğaltıldı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (sectionId: string) => remove({ data: { storeId, sectionId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Bölüm silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (dirty) await saveMutation.mutateAsync();
      return publish({ data: { storeId } });
    },
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: ["theme-versions", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] }),
      ]);
      toast.success("Tema yayınlandı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Otomatik kaydetme: bekleyen değişiklikler 20 saniyede bir gönderilir.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setInterval(() => {
      if (!saveMutation.isPending) saveMutation.mutate();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [dirty, saveMutation]);

  /** Önizleme: sunucu satırları + kaydedilmemiş taslak ayarları. */
  const previewSections: ResolvedSection[] = useMemo(
    () =>
      items.map((item, index) => ({
        ...item.section,
        position: index,
        isEnabled: item.isEnabled,
        settings: item.settings,
      })),
    [items],
  );

  const previewProducts: SectionProduct[] = useMemo(
    () =>
      (products ?? []).slice(0, 12).map((product) => ({
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.seo_description ?? null,
        base_price: product.base_price,
        compare_at_price: product.compare_at_price,
        currency: product.currency,
        product_type: product.product_type,
        tags: product.tags,
        coverUrl: null,
      })),
    [products],
  );

  const previewCommerce = useMemo(
    () =>
      buildStorefrontCommerce({
        currency: store?.currency ?? "TRY",
        rates: (shippingZones ?? [])
          .filter((zone) => zone.is_active)
          .flatMap((zone) =>
            (zone.shipping_rates ?? [])
              .filter((rate) => rate.is_active)
              .map((rate) => ({
                title: rate.title,
                price: rate.price,
                free_over: rate.free_over,
                eta_days: rate.eta_days,
                zoneName: zone.name,
              })),
          ),
        payments: (paymentMethods ?? [])
          .filter((method) => method.is_active)
          .map((method) => ({
            display_name: method.display_name,
            installments_enabled: method.installments_enabled,
          })),
      }),
    [paymentMethods, shippingZones, store?.currency],
  );

  const previewCollections = useMemo(
    () =>
      (collections ?? []).map((collection) => ({
        id: collection.id,
        title: collection.title,
        slug: collection.slug,
        description: collection.description,
      })),
    [collections],
  );

  return {
    storeId,
    isLoading: sectionsQuery.isLoading,
    store,
    stores: stores ?? [],
    theme,
    products: products ?? [],
    collections: collections ?? [],
    previewCollections,
    previewCommerce,
    previewProducts,
    previewSections,
    items,
    groups,
    selected,
    selectedId,
    setSelectedId,
    dirty,
    savedAt,
    canUndo,
    canRedo,
    undo,
    redo,
    setSetting,
    setSettings,
    toggleSection,
    reorderGroup,
    designDraft,
    setDesignDraft,
    save: () => saveMutation.mutate(),
    saving: saveMutation.isPending,
    addSection: (type: ThemeSectionType) => addMutation.mutate(type),
    adding: addMutation.isPending,
    duplicateSection: (id: string) => duplicateMutation.mutate(id),
    deleteSection: (id: string) => deleteMutation.mutate(id),
    publishTheme: () => publishMutation.mutate(),
    publishing: publishMutation.isPending,
  };
}

export type ThemeStudio = ReturnType<typeof useThemeStudio>;
