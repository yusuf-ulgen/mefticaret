import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, MailOpen } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/mefti";
import { platformContactMessagesQuery } from "@/lib/platform-contact-queries";
import { markPlatformContactMessageRead } from "@/lib/platform-contact.functions";

const DESCRIPTION = "Platform iletişim sayfasından gönderilen mesajları oku ve işaretle.";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  head: () => ({
    meta: [
      { title: "Gelen Mesajlar — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Gelen Mesajlar — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminMessagesPage,
});

type Filter = "all" | "unread";

function AdminMessagesPage() {
  const queryClient = useQueryClient();
  const { data: messages, isLoading } = useQuery(platformContactMessagesQuery());
  const mark = useServerFn(markPlatformContactMessageRead);

  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");

  const rows = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase("tr");
    return (messages ?? []).filter((row) => {
      if (filter === "unread" && row.is_read) return false;
      if (!needle) return true;
      return `${row.name} ${row.email} ${row.subject ?? ""} ${row.message}`
        .toLocaleLowerCase("tr")
        .includes(needle);
    });
  }, [messages, filter, term]);

  const toggle = useMutation({
    mutationFn: (input: { messageId: string; isRead: boolean }) => mark({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["platform-contact-messages"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unread = (messages ?? []).filter((row) => !row.is_read).length;

  return (
    <AdminShell title="Gelen Mesajlar" description={DESCRIPTION}>
      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={filter === "all" ? "default" : "ghost"}
              className="rounded-full"
              onClick={() => setFilter("all")}
            >
              Tümü
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filter === "unread" ? "default" : "ghost"}
              className="rounded-full"
              onClick={() => setFilter("unread")}
            >
              Okunmayan {unread ? `(${unread})` : ""}
            </Button>
          </div>
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Mesaj ara…"
            className="h-9 w-52"
            aria-label="Mesaj ara"
          />
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <Mail className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="font-medium">Mesaj bulunmuyor</p>
            <p className="text-sm text-muted-foreground">
              İletişim sayfasındaki form dolduruldukça mesajlar burada listelenir.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{row.name}</span>
                    <a href={`mailto:${row.email}`} className="text-sm text-muted-foreground hover:underline">
                      {row.email}
                    </a>
                    {row.phone ? (
                      <span className="text-sm text-muted-foreground">{row.phone}</span>
                    ) : null}
                    <Badge variant={row.is_read ? "secondary" : "default"}>
                      {row.is_read ? "Okundu" : "Yeni"}
                    </Badge>
                  </div>
                  {row.subject ? <p className="mt-1 text-sm font-medium">{row.subject}</p> : null}
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{row.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(row.created_at)}
                    {row.page_slug ? ` · /sayfa/${row.page_slug}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={row.is_read ? "Okunmadı işaretle" : "Okundu işaretle"}
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ messageId: row.id, isRead: !row.is_read })}
                >
                  {row.is_read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
