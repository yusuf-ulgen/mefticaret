import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { collectionsQuery } from "@/lib/catalog-queries";
import { createCollection } from "@/lib/catalog.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/collections")({
  head: () => ({
    meta: [
      { title: "Koleksiyonlar — Mefticaret" },
      {
        name: "description",
        content: "Ürünlerini koleksiyonlara ayır, vitrin ve kampanya gruplarını yönet.",
      },
      { property: "og:title", content: "Koleksiyonlar — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret katalog koleksiyonları ve vitrin gruplama.",
      },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: collections, isLoading } = useQuery(collectionsQuery(storeId));
  const create = useServerFn(createCollection);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () => create({ data: { storeId, title, description: description || undefined } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collections", storeId] });
      toast.success("Koleksiyon oluşturuldu");
      setTitle("");
      setDescription("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      storeId={storeId}
      title="Koleksiyonlar"
      description="Vitrin, kampanya ve kategori gruplarını burada yönet."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <form
          className="surface-card space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <h2 className="text-lg font-semibold">Yeni koleksiyon</h2>
          <div className="space-y-2">
            <Label htmlFor="c-title">Başlık</Label>
            <Input
              id="c-title"
              required
              minLength={2}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Örn. Yeni Sezon"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-desc">Açıklama</Label>
            <Textarea
              id="c-desc"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={mutation.isPending}>
            <Plus className="size-4" />
            {mutation.isPending ? "Oluşturuluyor…" : "Oluştur"}
          </Button>
        </form>

        <div className="lg:col-span-2">
          {isLoading ? (
            <p className="text-muted-foreground">Yükleniyor…</p>
          ) : (collections ?? []).length === 0 ? (
            <div className="surface-card p-10 text-center">
              <Boxes className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Henüz koleksiyon yok</p>
              <p className="text-sm text-muted-foreground">
                Soldaki formla ilk koleksiyonunu oluştur.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {(collections ?? []).map((collection) => (
                <li key={collection.id} className="surface-card p-5">
                  <h3 className="font-semibold">{collection.title}</h3>
                  <p className="text-xs text-muted-foreground">/{collection.slug}</p>
                  {collection.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{collection.description}</p>
                  ) : null}
                  <p className="mt-3 text-sm">
                    {(collection.product_collections ?? []).length} ürün
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
