import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, Play, Plus, Sparkles, Trash2, Zap } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AUTOMATION_TRIGGERS,
  BRANCH_OPTIONS,
  CHANNEL_LABELS,
  CONDITIONS,
  CONDITION_LABELS,
  MESSAGE_CHANNELS,
  STEP_KINDS,
  STEP_LABELS,
  TEMPLATE_VARIABLES,
  TRIGGER_LABELS,
  WAIT_PRESETS,
  formatWait,
  type AutomationCondition,
  type AutomationTrigger,
  type MessageChannel,
  type StepKind,
} from "@/lib/automation";
import {
  automationRunsQuery,
  messageDeliveriesQuery,
  messageTemplatesQuery,
  workflowsQuery,
  type Workflow,
} from "@/lib/automation-queries";
import {
  deleteMessageTemplate,
  deleteWorkflow,
  enrollAbandonedCarts,
  runAutomationTick,
  saveMessageTemplate,
  saveWorkflow,
  seedCartRecoveryFlow,
  stopAutomationRun,
  toggleWorkflow,
} from "@/lib/automation.functions";
import { formatDateTime } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/automations")({
  head: () => ({
    meta: [
      { title: "Pazarlama Otomasyonu | Mefticaret" },
      {
        name: "description",
        content:
          "Sepet kurtarma, sipariş ve kargo bildirimleri için e-posta, SMS, WhatsApp ve push adımlarından oluşan otomasyon akışları kurun.",
      },
      { property: "og:title", content: "Pazarlama Otomasyonu | Mefticaret" },
      {
        property: "og:description",
        content: "Çok kanallı otomasyon motoru: bekle, mesaj gönder, koşula göre dallan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationsPage,
});

type DraftStep = {
  kind: StepKind;
  title: string;
  waitMinutes: number;
  templateId: string | null;
  conditionKind: AutomationCondition | null;
  onTrue: "continue" | "end";
  onFalse: "continue" | "end";
  tag: string;
};

const EMPTY_STEP: DraftStep = {
  kind: "wait",
  title: "",
  waitMinutes: 30,
  templateId: null,
  conditionKind: null,
  onTrue: "end",
  onFalse: "continue",
  tag: "",
};

function AutomationsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: flowData, isLoading } = useQuery(workflowsQuery(storeId));
  const { data: templates } = useQuery(messageTemplatesQuery(storeId));
  const { data: runData } = useQuery(automationRunsQuery(storeId));
  const { data: deliveries } = useQuery(messageDeliveriesQuery(storeId));

  const save = useServerFn(saveWorkflow);
  const toggle = useServerFn(toggleWorkflow);
  const remove = useServerFn(deleteWorkflow);
  const seed = useServerFn(seedCartRecoveryFlow);
  const enroll = useServerFn(enrollAbandonedCarts);
  const tick = useServerFn(runAutomationTick);
  const stopRun = useServerFn(stopAutomationRun);
  const saveTemplate = useServerFn(saveMessageTemplate);
  const removeTemplate = useServerFn(deleteMessageTemplate);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    trigger: "cart_abandoned" as AutomationTrigger,
    isActive: false,
  });
  const [steps, setSteps] = useState<DraftStep[]>([{ ...EMPTY_STEP }]);

  const [template, setTemplate] = useState({
    id: null as string | null,
    channel: "email" as MessageChannel,
    name: "",
    subject: "",
    body: "",
    whatsappTemplateName: "",
  });

  const workflows = flowData?.workflows ?? [];
  const allSteps = flowData?.steps ?? [];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["automation-workflows", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["automation-runs", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["message-templates", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["message-deliveries", storeId] }),
    ]);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", description: "", trigger: "cart_abandoned", isActive: false });
    setSteps([{ ...EMPTY_STEP }]);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId,
          workflowId: editingId ?? undefined,
          name: form.name,
          description: form.description || undefined,
          trigger: form.trigger,
          isActive: form.isActive,
          steps: steps.map((step) => ({
            kind: step.kind,
            title: step.title || undefined,
            waitMinutes: step.kind === "wait" ? step.waitMinutes : 0,
            templateId: step.templateId,
            conditionKind: step.kind === "condition" ? step.conditionKind : null,
            onTrue: step.onTrue,
            onFalse: step.onFalse,
            config: step.tag ? { tag: step.tag } : {},
          })),
        },
      }),
    onSuccess: async () => {
      await invalidate();
      resetForm();
      toast.success("Otomasyon kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const seedMutation = useMutation({
    mutationFn: () => seed({ data: { storeId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Hazır sepet kurtarma akışı oluşturuldu");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const enrollMutation = useMutation({
    mutationFn: () => enroll({ data: { storeId } }),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(`${result.enrolled} terk edilmiş sepet akışa alındı`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tickMutation = useMutation({
    mutationFn: () => tick({ data: { storeId } }),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(`${result.processed} adım işlendi, ${result.completed} akış tamamlandı`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const templateMutation = useMutation({
    mutationFn: () =>
      saveTemplate({
        data: {
          storeId,
          templateId: template.id ?? undefined,
          channel: template.channel,
          name: template.name,
          subject: template.subject || undefined,
          body: template.body,
          whatsappTemplateName: template.whatsappTemplateName || undefined,
          whatsappLanguage: "tr",
          isActive: true,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      setTemplate({
        id: null,
        channel: "email",
        name: "",
        subject: "",
        body: "",
        whatsappTemplateName: "",
      });
      toast.success("Şablon kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEdit = (workflow: Workflow) => {
    setEditingId(workflow.id);
    setForm({
      name: workflow.name,
      description: workflow.description ?? "",
      trigger: workflow.trigger_event as AutomationTrigger,
      isActive: workflow.is_active,
    });
    const flowSteps = allSteps
      .filter((step) => step.workflow_id === workflow.id)
      .map((step) => ({
        kind: step.kind as StepKind,
        title: step.title ?? "",
        waitMinutes: step.wait_minutes,
        templateId: step.template_id,
        conditionKind: (step.condition_kind as AutomationCondition | null) ?? null,
        onTrue: (step.on_true === "continue" ? "continue" : "end") as "continue" | "end",
        onFalse: (step.on_false === "end" ? "end" : "continue") as "continue" | "end",
        tag: String((step.config as Record<string, unknown>)?.["tag"] ?? ""),
      }));
    setSteps(flowSteps.length > 0 ? flowSteps : [{ ...EMPTY_STEP }]);
  };

  const updateStep = (index: number, patch: Partial<DraftStep>) =>
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));

  const activeCount = workflows.filter((workflow) => workflow.is_active).length;
  const runs = runData?.runs ?? [];
  const events = runData?.events ?? [];

  return (
    <AppShell
      storeId={storeId}
      title="Pazarlama otomasyonu"
      description="Bekle, mesaj gönder, koşula göre dallan: e-posta, SMS, WhatsApp ve push adımlarıyla çok kanallı akışlar."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            <Sparkles className="mr-2 size-4" /> Hazır sepet akışı
          </Button>
          <Button variant="outline" onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}>
            <Plus className="mr-2 size-4" /> Sepetleri akışa al
          </Button>
          <Button onClick={() => tickMutation.mutate()} disabled={tickMutation.isPending}>
            <Play className="mr-2 size-4" /> Motoru çalıştır
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Akış" value={workflows.length} />
        <Stat label="Aktif akış" value={activeCount} />
        <Stat label="Devam eden kayıt" value={runs.filter((run) => run.status !== "completed" && run.status !== "stopped").length} />
        <Stat label="Gönderilen mesaj" value={workflows.reduce((sum, wf) => sum + wf.messages_sent, 0)} />
      </div>

      <Tabs defaultValue="flows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flows">Akışlar</TabsTrigger>
          <TabsTrigger value="templates">Şablonlar</TabsTrigger>
          <TabsTrigger value="runs">Çalıştırmalar</TabsTrigger>
          <TabsTrigger value="log">Gönderim kaydı</TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            className="surface-card space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? "Akışı düzenle" : "Yeni akış"}</h2>
              {editingId ? (
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                  Vazgeç
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="wf-name">Akış adı</Label>
              <Input
                id="wf-name"
                required
                minLength={2}
                value={form.name}
                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wf-desc">Açıklama</Label>
              <Textarea
                id="wf-desc"
                rows={2}
                value={form.description}
                onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Tetikleyici</Label>
              <Select
                value={form.trigger}
                onValueChange={(value) => setForm((f) => ({ ...f, trigger: value as AutomationTrigger }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTOMATION_TRIGGERS.map((trigger) => (
                    <SelectItem key={trigger} value={trigger}>
                      {TRIGGER_LABELS[trigger]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Akış aktif</span>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
              />
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Adımlar</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSteps((current) => [...current, { ...EMPTY_STEP }])}
                >
                  <Plus className="mr-1 size-3" /> Adım
                </Button>
              </div>

              {steps.map((step, index) => (
                <div key={index} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{index + 1}</Badge>
                    <Select
                      value={step.kind}
                      onValueChange={(value) => updateStep(index, { kind: value as StepKind })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STEP_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {STEP_LABELS[kind]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`${index + 1}. adımı kaldır`}
                      onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>

                  {step.kind === "wait" ? (
                    <Select
                      value={String(step.waitMinutes)}
                      onValueChange={(value) => updateStep(index, { waitMinutes: Number(value) })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WAIT_PRESETS.map((preset) => (
                          <SelectItem key={preset.value} value={String(preset.value)}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  {["email", "sms", "whatsapp", "push"].includes(step.kind) ? (
                    <Select
                      value={step.templateId ?? "none"}
                      onValueChange={(value) =>
                        updateStep(index, { templateId: value === "none" ? null : value })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Şablon seç" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Şablon yok</SelectItem>
                        {(templates ?? [])
                          .filter((item) => item.channel === step.kind)
                          .map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  {step.kind === "condition" ? (
                    <div className="space-y-2">
                      <Select
                        value={step.conditionKind ?? "order_placed"}
                        onValueChange={(value) =>
                          updateStep(index, { conditionKind: value as AutomationCondition })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITIONS.map((condition) => (
                            <SelectItem key={condition} value={condition}>
                              {CONDITION_LABELS[condition]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {step.conditionKind === "has_tag" ? (
                        <Input
                          className="h-8"
                          placeholder="etiket"
                          value={step.tag}
                          onChange={(event) => updateStep(index, { tag: event.target.value })}
                        />
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">EVET →</span>
                          <Select
                            value={step.onTrue}
                            onValueChange={(value) =>
                              updateStep(index, { onTrue: value as "continue" | "end" })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BRANCH_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">HAYIR →</span>
                          <Select
                            value={step.onFalse}
                            onValueChange={(value) =>
                              updateStep(index, { onFalse: value as "continue" | "end" })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BRANCH_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Kaydediliyor…" : "Akışı kaydet"}
            </Button>
          </form>

          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Yükleniyor…</p>
            ) : workflows.length === 0 ? (
              <div className="surface-card p-6 text-sm text-muted-foreground">
                Henüz otomasyon yok. “Hazır sepet akışı” ile 30 dk bekle → e-posta → 6 saat bekle →
                WhatsApp → sipariş kontrolü → indirim serisini tek tıkla oluşturabilirsin.
              </div>
            ) : (
              workflows.map((workflow) => {
                const flowSteps = allSteps.filter((step) => step.workflow_id === workflow.id);
                return (
                  <article key={workflow.id} className="surface-card space-y-4 p-6">
                    <header className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-lg font-semibold">
                          <Zap className="size-4 text-primary" /> {workflow.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {TRIGGER_LABELS[workflow.trigger_event as AutomationTrigger]} ·{" "}
                          {workflow.runs_count} kayıt · {workflow.messages_sent} mesaj
                        </p>
                        {workflow.description ? (
                          <p className="pt-1 text-sm text-muted-foreground">{workflow.description}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={workflow.is_active}
                          onCheckedChange={async (checked) => {
                            await toggle({
                              data: { storeId, workflowId: workflow.id, isActive: checked },
                            });
                            await invalidate();
                          }}
                        />
                        <Button variant="outline" size="sm" onClick={() => startEdit(workflow)}>
                          Düzenle
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`${workflow.name} akışını sil`}
                          onClick={async () => {
                            await remove({ data: { storeId, workflowId: workflow.id } });
                            await invalidate();
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </header>

                    <ol className="space-y-2">
                      {flowSteps.map((step, index) => (
                        <li key={step.id} className="flex items-start gap-3 text-sm">
                          <Badge variant="outline" className="mt-0.5">
                            {index + 1}
                          </Badge>
                          <div>
                            <p className="font-medium">
                              {step.title || STEP_LABELS[step.kind as StepKind]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {step.kind === "wait"
                                ? formatWait(step.wait_minutes)
                                : step.kind === "condition"
                                  ? `${CONDITION_LABELS[(step.condition_kind ?? "order_placed") as AutomationCondition]} · EVET → ${step.on_true === "end" ? "bitir" : "devam"} · HAYIR → ${step.on_false === "end" ? "bitir" : "devam"}`
                                  : STEP_LABELS[step.kind as StepKind]}
                            </p>
                          </div>
                          {index < flowSteps.length - 1 ? (
                            <ArrowDown className="ml-auto size-3 text-muted-foreground" />
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </article>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            className="surface-card space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              templateMutation.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">Mesaj şablonu</h2>
            <div className="space-y-2">
              <Label>Kanal</Label>
              <Select
                value={template.channel}
                onValueChange={(value) => setTemplate((t) => ({ ...t, channel: value as MessageChannel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESSAGE_CHANNELS.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {CHANNEL_LABELS[channel]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Şablon adı</Label>
              <Input
                id="tpl-name"
                required
                value={template.name}
                onChange={(event) => setTemplate((t) => ({ ...t, name: event.target.value }))}
              />
            </div>
            {template.channel === "email" ? (
              <div className="space-y-2">
                <Label htmlFor="tpl-subject">Konu</Label>
                <Input
                  id="tpl-subject"
                  value={template.subject}
                  onChange={(event) => setTemplate((t) => ({ ...t, subject: event.target.value }))}
                />
              </div>
            ) : null}
            {template.channel === "whatsapp" ? (
              <div className="space-y-2">
                <Label htmlFor="tpl-wa">Onaylı WhatsApp şablon adı (opsiyonel)</Label>
                <Input
                  id="tpl-wa"
                  value={template.whatsappTemplateName}
                  onChange={(event) =>
                    setTemplate((t) => ({ ...t, whatsappTemplateName: event.target.value }))
                  }
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="tpl-body">İçerik</Label>
              <Textarea
                id="tpl-body"
                rows={6}
                required
                value={template.body}
                onChange={(event) => setTemplate((t) => ({ ...t, body: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Değişkenler: {TEMPLATE_VARIABLES.map((variable) => `{{${variable}}}`).join(", ")}
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={templateMutation.isPending}>
              {templateMutation.isPending ? "Kaydediliyor…" : "Şablonu kaydet"}
            </Button>
          </form>

          <div className="space-y-3">
            {(templates ?? []).map((item) => (
              <article key={item.id} className="surface-card space-y-2 p-4">
                <header className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {CHANNEL_LABELS[item.channel as MessageChannel]}
                      {item.subject ? ` · ${item.subject}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setTemplate({
                          id: item.id,
                          channel: item.channel as MessageChannel,
                          name: item.name,
                          subject: item.subject ?? "",
                          body: item.body,
                          whatsappTemplateName: item.whatsapp_template_name ?? "",
                        })
                      }
                    >
                      Düzenle
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`${item.name} şablonunu sil`}
                      onClick={async () => {
                        await removeTemplate({ data: { storeId, templateId: item.id } });
                        await invalidate();
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </header>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="runs" className="space-y-3">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz çalıştırma yok.</p>
          ) : (
            runs.map((run) => {
              const workflow = workflows.find((item) => item.id === run.workflow_id);
              const runEvents = events.filter((event) => event.run_id === run.id).slice(0, 6);
              return (
                <article key={run.id} className="surface-card space-y-2 p-4">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{workflow?.name ?? "Akış"}</h3>
                      <p className="text-xs text-muted-foreground">
                        Adım {run.current_position + 1} · Sonraki çalışma{" "}
                        {formatDateTime(run.next_run_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>
                        {run.status}
                      </Badge>
                      {run.status === "active" || run.status === "waiting" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await stopRun({ data: { storeId, runId: run.id } });
                            await invalidate();
                          }}
                        >
                          Durdur
                        </Button>
                      ) : null}
                    </div>
                  </header>
                  {run.last_error ? (
                    <p className="text-xs text-destructive">{run.last_error}</p>
                  ) : null}
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {runEvents.map((event) => (
                      <li key={event.id}>
                        {formatDateTime(event.created_at)} · {STEP_LABELS[event.kind as StepKind]} ·{" "}
                        {event.outcome}
                        {event.message ? ` — ${event.message}` : ""}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="log">
          <div className="surface-card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Kanal</th>
                  <th className="px-4 py-3">Alıcı</th>
                  <th className="px-4 py-3">İçerik</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {(deliveries ?? []).map((delivery) => (
                  <tr key={delivery.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">{CHANNEL_LABELS[delivery.channel as MessageChannel]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{delivery.recipient}</td>
                    <td className="max-w-[24rem] truncate px-4 py-3 text-muted-foreground">
                      {delivery.body}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={delivery.status === "failed" ? "destructive" : "secondary"}>
                        {delivery.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(delivery.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(deliveries ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Henüz gönderim kaydı yok.</p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
