import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Download, ExternalLink, Palette, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { storeThemeQuery } from "@/lib/theme-queries";
import { applyThemeTemplate } from "@/lib/theme-templates.functions";
import { THEME_TEMPLATES } from "@/lib/theme-templates";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-store")({
  head: () => ({
    meta: [
      { title: "Tema Mağazası — Mefticaret" },
      {
        name: "description",
        content:
          "Profesyonel hazır temaları incele, ücretli ve ücretsiz temaları tek tıkla mağazana uygula.",
      },
      { property: "og:title", content: "Tema Mağazası — Mefticaret" },
      {
        property: "og:description",
        content: "Profesyonel hazır temaları incele ve tek tıkla mağazana uygula.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThemeStorePage,
});

function ThemeStorePage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: theme } = useQuery(storeThemeQuery(storeId));
  const applyTemplate = useServerFn(applyThemeTemplate);

  const applyMutation = useMutation({
    mutationFn: (code: string) => applyTemplate({ data: { storeId, code } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["theme-sections", storeId] }),
      ]);
      toast.success("Tema mağazana uygulandı. Tema düzenleyiciden ince ayar yapabilirsin.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell storeId={storeId}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tema Mağazası</h1>
            <p className="text-sm text-muted-foreground">
              Hazır profesyonel temaları incele, tek tıkla mağazana kur ve tema düzenleyiciden
              özelleştir.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/store/$storeId/theme-editor" params={{ storeId }}>
              <Palette className="mr-2 size-4" /> Tema düzenleyici
            </Link>
          </Button>
        </header>

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {THEME_TEMPLATES.map((template) => {
            const active = theme?.preset === template.code;
            return (
              <Card key={template.code} className="flex flex-col">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {template.name}
                        {active ? <Badge variant="secondary">Kurulu</Badge> : null}
                      </CardTitle>
                      <CardDescription>{template.tagline}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {template.store?.featured ? (
                        <Badge className="gap-1">
                          <Sparkles className="size-3" /> Öne çıkan
                        </Badge>
                      ) : null}
                      <Badge variant="outline">
                        {template.store?.price
                          ? `${template.store.price.toLocaleString("tr-TR")} ₺`
                          : "Ücretsiz"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <p className="text-sm text-muted-foreground">{template.description}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {template.store?.features?.length ? (
                    <ul className="space-y-1.5 text-sm">
                      {template.store.features.map((feature) => (
                        <li key={feature} className="flex gap-2 text-muted-foreground">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    {template.sections.length} hazır bölüm
                    {template.store?.priceNote ? ` · ${template.store.priceNote}` : ""}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      className="flex-1 gap-2"
                      disabled={applyMutation.isPending}
                      onClick={() => applyMutation.mutate(template.code)}
                    >
                      <Download className="size-4" />
                      {active ? "Yeniden kur" : "Temayı kur"}
                    </Button>
                    {template.store?.demoUrl ? (
                      <Button asChild variant="outline">
                        <a href={template.store.demoUrl} target="_blank" rel="noreferrer noopener">
                          <ExternalLink className="mr-2 size-4" /> Demo
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
