import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquare, Paperclip, Plus, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/mefti";
import { cn } from "@/lib/utils";
import {
  STORE_ASSIGNABLE_STATUSES,
  SUPPORT_ALLOWED_MIME,
  SUPPORT_ATTACHMENT_BUCKET,
  SUPPORT_AUTHOR_ROLE_LABELS,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_MAX_FILE_BYTES,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  type SupportAttachment,
  type SupportCategory,
  type SupportPriority,
} from "@/lib/support-tickets";
import {
  storeTicketsQuery,
  supportDepartmentsQuery,
  ticketMessagesQuery,
} from "@/lib/support-tickets-queries";
import {
  createStoreTicket,
  replyStoreTicket,
  signSupportAttachment,
  updateStoreTicket,
} from "@/lib/support-tickets.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/support")({
  head: () => ({
    meta: [
      { title: "Destek Talepleri — Mefticaret" },
      {
        name: "description",
        content:
          "Destek talebi oluştur, departman ve öncelik belirle, dosya ekleyerek destek ekibiyle yazış.",
      },
      { property: "og:title", content: "Destek Talepleri — Mefticaret" },
      {
        property: "og:description",
        content: "Ticket oluşturma, departman, öncelik, dosya eki ve canlı yazışma akışı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

const STATUS_TONE: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  pending: "bg-amber-500/10 text-amber-600",
  answered: "bg-sky-500/10 text-sky-600",
  resolved: "bg-emerald-500/10 text-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

function SupportPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const departments = useQuery(supportDepartmentsQuery());
  const tickets = useQuery(storeTicketsQuery(storeId, statusFilter));
  const messages = useQuery(ticketMessagesQuery(storeId, activeId));

  const active = useMemo(
    () => tickets.data?.find((ticket) => ticket.id === activeId) ?? null,
    [tickets.data, activeId],
  );

  // Canlı destek hazırlığı: mesaj tablosu realtime yayınına dahil, akış anlık güncellenir.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`support-ticket-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_ticket_messages",
          filter: `ticket_id=eq.${activeId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["store", storeId, "ticket-messages", activeId],
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, queryClient, storeId]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, "tickets"] });
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, "ticket-messages"] });
  }

  return (
    <AppShell
      storeId={storeId}
      title="Destek Talepleri"
      description="Departman, öncelik ve dosya ekiyle ticket oluştur; destek ekibiyle yazışmayı tek akışta takip et."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" /> Yenile
          </Button>
          <Button size="sm" onClick={() => setComposerOpen((open) => !open)}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Talep
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        {composerOpen ? (
          <TicketComposer
            storeId={storeId}
            departments={(departments.data ?? []).map((item) => ({
              code: item.code,
              label: item.label,
            }))}
            onCreated={(id) => {
              setComposerOpen(false);
              setActiveId(id);
              refresh();
            }}
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          {["all", ...SUPPORT_STATUSES].map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? "default" : "outline"}
              onClick={() => setStatusFilter(status)}
            >
              {status === "all"
                ? "Tümü"
                : SUPPORT_STATUS_LABELS[status as keyof typeof SUPPORT_STATUS_LABELS]}
            </Button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-2">
            {tickets.isLoading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : (tickets.data ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Henüz destek talebi yok.
              </p>
            ) : (
              (tickets.data ?? []).map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setActiveId(ticket.id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                    activeId === ticket.id && "border-primary bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{ticket.subject}</span>
                    <Badge className={cn("shrink-0", STATUS_TONE[ticket.status])}>
                      {SUPPORT_STATUS_LABELS[ticket.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ticket.department} · {SUPPORT_PRIORITY_LABELS[ticket.priority]} ·{" "}
                    {formatDateTime(ticket.last_reply_at ?? ticket.created_at)}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="rounded-lg border">
            {!active ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-40" />
                Yazışmayı görmek için soldan bir talep seç.
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                  <div>
                    <h2 className="text-lg font-semibold">{active.subject}</h2>
                    <p className="text-xs text-muted-foreground">
                      {active.department} · {SUPPORT_CATEGORY_LABELS[active.category]} ·{" "}
                      {formatDateTime(active.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {STORE_ASSIGNABLE_STATUSES.map((status) => (
                      <StatusButton
                        key={status}
                        storeId={storeId}
                        ticketId={active.id}
                        status={status}
                        current={active.status}
                        onDone={refresh}
                      />
                    ))}
                  </div>
                </div>

                <div className="max-h-[26rem] space-y-3 overflow-y-auto p-4">
                  {messages.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    (messages.data ?? []).map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "rounded-lg border p-3 text-sm",
                          message.author_role === "platform" && "bg-muted/60",
                          message.is_internal && "border-amber-500/50 bg-amber-500/5",
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {SUPPORT_AUTHOR_ROLE_LABELS[message.author_role]}
                          </span>
                          <span>{formatDateTime(message.created_at)}</span>
                          {message.is_internal ? <Badge variant="outline">İç not</Badge> : null}
                        </div>
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <AttachmentList
                          storeId={storeId}
                          attachments={message.attachments ?? []}
                        />
                      </div>
                    ))
                  )}
                </div>

                <ReplyBox storeId={storeId} ticketId={active.id} onSent={refresh} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatusButton({
  storeId,
  ticketId,
  status,
  current,
  onDone,
}: {
  storeId: string;
  ticketId: string;
  status: (typeof STORE_ASSIGNABLE_STATUSES)[number];
  current: string;
  onDone: () => void;
}) {
  const updateFn = useServerFn(updateStoreTicket);
  const mutation = useMutation({
    mutationFn: () => updateFn({ data: { storeId, ticketId, status } }),
    onSuccess: () => {
      toast.success("Durum güncellendi");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Button
      size="sm"
      variant={current === status ? "default" : "outline"}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {SUPPORT_STATUS_LABELS[status]}
    </Button>
  );
}

function AttachmentList({
  storeId,
  attachments,
}: {
  storeId: string;
  attachments: SupportAttachment[];
}) {
  const signFn = useServerFn(signSupportAttachment);
  if (attachments.length === 0) return null;

  async function open(path: string) {
    try {
      const result = await signFn({ data: { storeId, path } });
      window.open(result.url, "_blank", "noopener");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <ul className="mt-2 space-y-1">
      {attachments.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            onClick={() => void open(file.path)}
            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
          >
            <Paperclip className="h-3 w-3" /> {file.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

function useAttachmentUpload(storeId: string, ticketId?: string) {
  const [files, setFiles] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setUploading(true);
    try {
      const uploaded: SupportAttachment[] = [];
      for (const file of Array.from(selected)) {
        if (file.size > SUPPORT_MAX_FILE_BYTES) throw new Error(`${file.name}: dosya çok büyük`);
        if (!SUPPORT_ALLOWED_MIME.includes(file.type)) {
          throw new Error(`${file.name}: desteklenmeyen dosya türü`);
        }
        const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
        const path = `${storeId}/${ticketId ?? "new"}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage
          .from(SUPPORT_ATTACHMENT_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error(error.message);
        uploaded.push({ path, name: file.name, size: file.size, mimeType: file.type });
      }
      setFiles((current) => [...current, ...uploaded]);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return { files, setFiles, uploading, inputRef, upload };
}

function AttachmentPicker({
  uploading,
  inputRef,
  onSelect,
  files,
}: {
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (files: FileList | null) => void;
  files: SupportAttachment[];
}) {
  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={SUPPORT_ALLOWED_MIME.join(",")}
        onChange={(event) => void onSelect(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="mr-2 h-4 w-4" />
        )}
        Dosya ekle
      </Button>
      {files.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {files.map((file) => file.name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function TicketComposer({
  storeId,
  departments,
  onCreated,
}: {
  storeId: string;
  departments: { code: string; label: string }[];
  onCreated: (id: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [department, setDepartment] = useState(departments[0]?.code ?? "general");
  const [category, setCategory] = useState<SupportCategory>("other");
  const [priority, setPriority] = useState<SupportPriority>("normal");
  const [body, setBody] = useState("");
  const upload = useAttachmentUpload(storeId);
  const createFn = useServerFn(createStoreTicket);

  useEffect(() => {
    if (!department && departments[0]) setDepartment(departments[0].code);
  }, [departments, department]);

  const mutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          storeId,
          subject: subject.trim(),
          department,
          category,
          priority,
          channel: "ticket",
          body: body.trim(),
          attachments: upload.files,
        },
      }),
    onSuccess: (result) => {
      toast.success("Destek talebi oluşturuldu");
      setSubject("");
      setBody("");
      upload.setFiles([]);
      onCreated(result.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="grid gap-4 rounded-lg border p-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="ticket-subject">Konu</Label>
        <Input
          id="ticket-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Örn. Kargo entegrasyonunda hata alıyorum"
          required
          minLength={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-department">Departman</Label>
        <select
          id="ticket-department"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        >
          {(departments.length > 0 ? departments : [{ code: "general", label: "Genel" }]).map(
            (item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-category">Kategori</Label>
        <select
          id="ticket-category"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value as SupportCategory)}
        >
          {SUPPORT_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {SUPPORT_CATEGORY_LABELS[item]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-priority">Öncelik</Label>
        <select
          id="ticket-priority"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={priority}
          onChange={(event) => setPriority(event.target.value as SupportPriority)}
        >
          {SUPPORT_PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {SUPPORT_PRIORITY_LABELS[item]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="ticket-body">Mesaj</Label>
        <Textarea
          id="ticket-body"
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Sorunu, adımları ve beklediğin sonucu açıkla."
          required
          minLength={5}
        />
      </div>

      <AttachmentPicker
        uploading={upload.uploading}
        inputRef={upload.inputRef}
        onSelect={upload.upload}
        files={upload.files}
      />

      <div className="flex items-end justify-end md:col-span-1">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Talebi Gönder
        </Button>
      </div>
    </form>
  );
}

function ReplyBox({
  storeId,
  ticketId,
  onSent,
}: {
  storeId: string;
  ticketId: string;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const upload = useAttachmentUpload(storeId, ticketId);
  const replyFn = useServerFn(replyStoreTicket);

  const mutation = useMutation({
    mutationFn: () =>
      replyFn({ data: { storeId, ticketId, body: body.trim(), attachments: upload.files } }),
    onSuccess: () => {
      setBody("");
      upload.setFiles([]);
      onSent();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-3 border-t p-4">
      <Textarea
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Yanıtını yaz…"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AttachmentPicker
          uploading={upload.uploading}
          inputRef={upload.inputRef}
          onSelect={upload.upload}
          files={upload.files}
        />
        <Button
          disabled={mutation.isPending || body.trim().length === 0}
          onClick={() => mutation.mutate()}
        >
          <Send className="mr-2 h-4 w-4" /> Gönder
        </Button>
      </div>
    </div>
  );
}
