/**
 * Besleme listesi: içe ve dışa aktarım beslemeleri, düzenleme paneli.
 */

import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { emptyFeed, FeedSheet, type FeedFormValue } from "@/components/xml-integrator/feed-sheet";
import { FeedCard } from "@/components/xml-integrator/shared";
import { xmlIntegratorOverviewQuery } from "@/lib/xml-integrator-queries";
import type {
  FieldMapping,
  XmlAuthType,
  XmlDirection,
  XmlPlatform,
  XmlSchedule,
  XmlSourceFormat,
} from "@/lib/xml-integrator";

export function XmlFeedList({ storeId }: { storeId: string }) {
  const client = useQueryClient();
  const overview = useQuery(xmlIntegratorOverviewQuery(storeId));
  const [editing, setEditing] = useState<FeedFormValue | null>(null);

  if (overview.isLoading) return <CardSkeleton />;
  if (overview.error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        Besleme listesi yüklenemedi: {(overview.error as Error).message}
      </div>
    );
  }

  const feeds = overview.data?.feeds ?? [];
  const groups: Array<{ direction: XmlDirection; label: string; rows: typeof feeds }> = [
    { direction: "import", label: "İçe aktarım", rows: feeds.filter((feed) => feed.direction === "import") },
    { direction: "export", label: "Dışa aktarım", rows: feeds.filter((feed) => feed.direction === "export") },
  ];

  const openEdit = (feed: (typeof feeds)[number]) =>
    setEditing({
      id: feed.id,
      name: feed.name,
      direction: feed.direction,
      platform: feed.platform as XmlPlatform,
      sourceFormat: feed.sourceFormat as XmlSourceFormat,
      sourceUrl: feed.sourceUrl ?? "",
      itemPath: feed.itemPath ?? "",
      authType: feed.authType as XmlAuthType,
      hasCredentials: feed.hasCredentials,
      outputFilename: feed.outputFilename ?? "",
      schedule: feed.schedule as XmlSchedule,
      cronExpression: feed.cronExpression ?? "",
      fieldMapping: feed.fieldMapping as FieldMapping,
      currency: feed.currency,
      priceMarkup: feed.priceMarkup,
      isActive: feed.isActive,
      deltaSync: feed.deltaSyncConfig,
      lastFullSyncAt: feed.lastFullSyncAt,
    });

  return (
    <div className="space-y-4">
      <Button asChild className="w-full sm:w-auto">
        <Link to="/store/$storeId/xml-integrator/feeds/new" params={{ storeId }}>
          <Plus className="mr-1 size-4" /> Yeni besleme
        </Link>
      </Button>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2">
          {groups.map((group) => (
            <TabsTrigger key={group.direction} className="whitespace-normal py-2" value={group.direction}>
              {group.label} ({group.rows.length})
            </TabsTrigger>
          ))}
        </TabsList>

        {groups.map((group) => (
          <TabsContent key={group.direction} value={group.direction} className="mt-0 space-y-2">
            {group.rows.length ? (
              group.rows.map((feed) => (
                <FeedCard key={feed.id} storeId={storeId} feed={feed} onEdit={() => openEdit(feed)} />
              ))
            ) : (
              <div className="rounded-xl border border-dashed bg-card p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {group.direction === "import"
                    ? "Henüz tedarikçi beslemesi eklemediniz."
                    : "Henüz pazaryeri çıktısı tanımlamadınız."}
                </p>
                <Button asChild className="mt-4">
                  <Link to="/store/$storeId/xml-integrator/feeds/new" params={{ storeId }}>
                    Besleme ekle
                  </Link>
                </Button>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <FeedSheet
        storeId={storeId}
        open={editing !== null}
        value={editing ?? emptyFeed}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={() => void client.invalidateQueries({ queryKey: ["xml-integrator", storeId] })}
      />
    </div>
  );
}
