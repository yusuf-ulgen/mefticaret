import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/mefti";
import { platformTicketMessagesQuery, platformTicketsQuery } from "@/lib/platform-admin-queries";
import { replyPlatformTicket, updatePlatformTicket } from "@/lib/platform-admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/tickets")({
  head: () => ({
    meta: [
      { title: "Ticket — Süper Admin" },
      { name: "description", content: "Destek taleplerini yanıtla, önceliklendir ve durumlarını yönet." },
      { property: "og:title", content: "Ticket — Süper Admin" },
      { property: "og:description", content: "Mağazalardan gelen destek taleplerinin merkezi kuyruğu." },
    ],
  }),
  component: AdminTickets,
});

const STATUSES = ["open", "pending", "answered", "resolved", "closed"] as const;
const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  pending: "Beklemede",
  answered: "Yanıtlandı",
  resolved: "Çözüldü",
  closed: "Kapandı",
};
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

function AdminTickets() {
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);

  const tickets = useQuery(platformTicketsQuery(statusFilter, isPlatformAdmin));
  const messages = useQuery(platformTicketMessagesQuery(selected));

  const sendReply = useServerFn(replyPlatformTicket);
  const patchTicket = useServerFn(updatePlatformTicket);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["platform-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["platform-ticket-messages"] });
  };

  const replyMutation = useMutation({
    mutationFn: () =>
      sendReply({ data: { ticketId: selected as string, body: reply.trim(), isInternal: internal } }),
    onSuccess: () => {
      toast.success(internal ? "İç not eklendi" : "Yanıt gönderildi");
      setReply("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { status?: string; priority?: string; assignToMe?: boolean }) =>
      patchTicket({ data: { id: selected as string, ...input } }),
    onSuccess: () => {
      toast.success("Ticket güncellendi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = tickets.data?.rows ?? [];
  const storeNames = tickets.data?.storeNames ?? {};
  const current = rows.find((row) => String(row["id"]) === selected) ?? null;

  return (
    <AdminShell
      title="Ticket"
      description="Destek kuyruğu: talebi seç, yanıtla, önceliklendir."
      actions={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <div className="surface-card divide-y divide-border overflow-hidden">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Bu filtrede talep yok.</p>
          ) : null}
          {rows.map((row) => {
            const id = String(row["id"]);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className={cn(
                  "flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-muted/50",
                  selected === id && "bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{String(row["subject"] ?? "—")}</span>
                  <Badge variant="secondary">{STATUS_LABELS[String(row["status"])] ?? String(row["status"])}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {storeNames[String(row["store_id"] ?? "")] ?? "Platform"} ·{" "}
                  {PRIORITY_LABELS[String(row["priority"])] ?? String(row["priority"])} ·{" "}
                  {formatDateTime(String(row["created_at"]))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {!current ? (
            <p className="surface-card p-6 text-sm text-muted-foreground">
              Detayı görmek için soldan bir talep seç.
            </p>
          ) : (
            <>
              <section className="surface-card space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-lg font-semibold">{String(current["subject"] ?? "—")}</h2>
                  <Badge variant="secondary">{String(current["category"] ?? "genel")}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={String(current["status"])}
                    onValueChange={(value) => updateMutation.mutate({ status: value })}
                  >
                    <SelectTrigger className="h-9 w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(current["priority"])}
                    onValueChange={(value) => updateMutation.mutate({ priority: value })}
                  >
                    <SelectTrigger className="h-9 w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {PRIORITY_LABELS[priority]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateMutation.mutate({ assignToMe: true })}
                  >
                    Bana ata
                  </Button>
                </div>
              </section>

              <section className="surface-card space-y-3 p-5">
                <h3 className="text-sm font-semibold">Yazışma</h3>
                <ul className="space-y-3">
                  {(messages.data ?? []).map((message) => (
                    <li
                      key={String(message["id"])}
                      className={cn(
                        "rounded-lg border border-border p-3 text-sm",
                        message["is_internal"] ? "bg-muted/50" : "bg-card",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{String(message["author_name"] ?? "Kullanıcı")}</span>
                        <span>
                          {message["is_internal"] ? "İç not · " : ""}
                          {formatDateTime(String(message["created_at"]))}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap">{String(message["body"] ?? "")}</p>
                    </li>
                  ))}
                  {(messages.data ?? []).length === 0 ? (
                    <li className="text-sm text-muted-foreground">Henüz mesaj yok.</li>
                  ) : null}
                </ul>

                <form
                  className="space-y-3 border-t border-border pt-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!reply.trim()) return;
                    replyMutation.mutate();
                  }}
                >
                  <Textarea
                    rows={4}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Yanıtını yaz"
                    aria-label="Yanıt"
                  />
                  <div className="flex items-center gap-3">
                    <Switch id="internal" checked={internal} onCheckedChange={setInternal} />
                    <Label htmlFor="internal" className="text-xs">
                      İç not (müşteri görmez)
                    </Label>
                    <Button
                      type="submit"
                      size="sm"
                      className="ml-auto"
                      disabled={replyMutation.isPending || !reply.trim()}
                    >
                      {replyMutation.isPending ? "Gönderiliyor…" : "Gönder"}
                    </Button>
                  </div>
                </form>
              </section>
            </>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
