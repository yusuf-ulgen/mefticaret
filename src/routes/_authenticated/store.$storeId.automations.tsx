import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  type OnEdgesChange,
  type OnNodesChange,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  ArrowDown,
  CheckCircle2,
  Clock3,
  Copy,
  GripVertical,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Webhook,
  XCircle,
  Zap,
} from "lucide-react";

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
  testRunWorkflow,
  toggleWorkflow,
} from "@/lib/automation.functions";
import { formatDateTime } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/automations")({
  head: () => ({
    meta: [
      { title: "Otomasyon Merkezi | Mefticaret" },
      { name: "description", content: "Mağazanız için görsel otomasyon akışları oluşturun, çalıştırın ve izleyin." },
      { property: "og:title", content: "Otomasyon Merkezi | Mefticaret" },
      { property: "og:description", content: "Görsel workflow builder ve otomasyon izleme merkezi." },
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

type CanvasNodeData = { stepIndex: number; step: DraftStep; trigger?: boolean };
type CanvasNode = Node<CanvasNodeData, "automation">;
type CanvasEdge = Edge;

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

const STEP_ICONS: Record<StepKind, string> = {
  wait: "⏱",
  email: "✉",
  sms: "▣",
  whatsapp: "◌",
  push: "◈",
  condition: "◇",
  end: "■",
};

const STEP_TONES: Record<StepKind, string> = {
  wait: "border-l-chart-4",
  email: "border-l-brand",
  sms: "border-l-info",
  whatsapp: "border-l-success",
  push: "border-l-chart-5",
  condition: "border-l-warning",
  end: "border-l-muted-foreground",
};

function AutomationNode({ data, selected }: NodeProps<CanvasNode>) {
  const { step, trigger } = data;
  return (
    <div className={`min-w-[190px] border border-border border-l-4 ${STEP_TONES[step.kind]} bg-card px-3 py-2.5 shadow-soft ${selected ? "ring-2 ring-brand" : ""}`}>
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-muted-foreground" />
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-muted text-sm">{trigger ? "⚡" : STEP_ICONS[step.kind]}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{trigger ? "Tetikleyici" : STEP_LABELS[step.kind]}</p>
          <p className="truncate text-sm font-semibold">{step.title || (trigger ? "Akış başlangıcı" : STEP_LABELS[step.kind])}</p>
        </div>
      </div>
      <p className="mt-2 truncate text-[11px] text-muted-foreground">
        {step.kind === "wait" ? formatWait(step.waitMinutes) : step.kind === "condition" ? CONDITION_LABELS[step.conditionKind ?? "order_placed"] : trigger ? "Olay gerçekleştiğinde" : "Adım yapılandırılmadı"}
      </p>
      <Handle
        {...(step.kind === "condition" && !trigger ? { id: "true" } : {})}
        type="source"
        position={Position.Right}
        className="!size-2 !border-0 !bg-brand"
      />
      {step.kind === "condition" && !trigger ? (
        <Handle id="false" type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-warning" />
      ) : null}
    </div>
  );
}

const nodeTypes = { automation: AutomationNode };

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
  const testRun = useServerFn(testRunWorkflow);
  const saveTemplate = useServerFn(saveMessageTemplate);
  const removeTemplate = useServerFn(deleteMessageTemplate);

  const [activeView, setActiveView] = useState<"library" | "builder">("library");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", description: "", trigger: "cart_abandoned" as AutomationTrigger, isActive: false });
  const [steps, setSteps] = useState<DraftStep[]>([{ ...EMPTY_STEP }]);
  const [canvasNodes, setCanvasNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [canvasEdges, setCanvasEdges, onEdgesChange] = useEdgesState<CanvasEdge>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState({ id: null as string | null, channel: "email" as MessageChannel, name: "", subject: "", body: "", whatsappTemplateName: "" });

  const workflows = flowData?.workflows ?? [];
  const allSteps = flowData?.steps ?? [];
  const runs = runData?.runs ?? [];
  const events = runData?.events ?? [];
  const activeCount = workflows.filter((workflow) => workflow.is_active).length;
  const filteredWorkflows = workflows.filter((workflow) => `${workflow.name} ${workflow.description ?? ""}`.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")));

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["automation-workflows", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["automation-runs", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["message-templates", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["message-deliveries", storeId] }),
    ]);
  };

  const makeCanvas = useCallback((draftSteps: DraftStep[], trigger: AutomationTrigger) => {
    const nodes: CanvasNode[] = [
      { id: "trigger", type: "automation", position: { x: 70, y: 210 }, data: { stepIndex: -1, trigger: true, step: { ...EMPTY_STEP, kind: "end", title: TRIGGER_LABELS[trigger] } } },
      ...draftSteps.map((step, index) => ({ id: `step-${index}`, type: "automation" as const, position: { x: 330 + index * 245, y: 210 }, data: { stepIndex: index, step } })),
    ];
    const edges: CanvasEdge[] = nodes.slice(1).map((node, index) => ({ id: `edge-${index}`, source: nodes[index]?.id ?? "trigger", target: node.id, animated: true, type: "smoothstep" }));
    setCanvasNodes(nodes);
    setCanvasEdges(edges);
  }, [setCanvasEdges, setCanvasNodes]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", description: "", trigger: "cart_abandoned", isActive: false });
    setSteps([{ ...EMPTY_STEP }]);
    setSelectedNode(null);
    makeCanvas([{ ...EMPTY_STEP }], "cart_abandoned");
  };

  const startNew = () => {
    resetForm();
    setActiveView("builder");
  };

  const startEdit = (workflow: Workflow) => {
    const flowSteps = allSteps.filter((step) => step.workflow_id === workflow.id).map((step) => ({
      kind: step.kind as StepKind,
      title: step.title ?? "",
      waitMinutes: step.wait_minutes,
      templateId: step.template_id,
      conditionKind: (step.condition_kind as AutomationCondition | null) ?? null,
      onTrue: (step.on_true === "continue" ? "continue" : "end") as "continue" | "end",
      onFalse: (step.on_false === "end" ? "end" : "continue") as "continue" | "end",
      tag: String((step.config as Record<string, unknown>)?.["tag"] ?? ""),
    }));
    const nextSteps = flowSteps.length > 0 ? flowSteps : [{ ...EMPTY_STEP }];
    setEditingId(workflow.id);
    setForm({ name: workflow.name, description: workflow.description ?? "", trigger: workflow.trigger_event as AutomationTrigger, isActive: workflow.is_active });
    setSteps(nextSteps);
    makeCanvas(nextSteps, workflow.trigger_event as AutomationTrigger);
    const saved = workflow.canvas as {
      nodes?: Array<{ id: string; position: { x: number; y: number } }>;
      edges?: Array<{ id: string; source: string; target: string; sourceHandle?: string | null }>;
    } | null;
    if (saved?.nodes?.length) {
      setCanvasNodes((current) => current.map((node) => {
        const match = saved.nodes?.find((item) => item.id === node.id);
        return match ? { ...node, position: match.position } : node;
      }));
    }
    if (saved?.edges?.length) {
      const validIds = new Set<string>(["trigger", ...nextSteps.map((_, index) => `step-${index}`)]);
      setCanvasEdges(
        saved.edges
          .filter((edge) => validIds.has(edge.source) && validIds.has(edge.target))
          .map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle ?? null,
            animated: true,
            type: "smoothstep",
            label: edge.sourceHandle === "true" ? "Evet" : edge.sourceHandle === "false" ? "Hayır" : undefined,
          })),
      );
    }
    setSelectedNode(null);
    setActiveView("builder");
  };

  const updateStep = (index: number, patch: Partial<DraftStep>) => {
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
    setCanvasNodes((current) => current.map((node) => node.data.stepIndex === index ? { ...node, data: { ...node.data, step: { ...node.data.step, ...patch } } } : node));
  };

  const addStep = (kind: StepKind) => {
    const next = { ...EMPTY_STEP, kind, title: STEP_LABELS[kind] };
    const index = steps.length;
    setSteps((current) => [...current, next]);
    setCanvasNodes((current) => [...current, { id: `step-${index}`, type: "automation", position: { x: 330 + index * 245, y: 210 }, data: { stepIndex: index, step: next } }]);
    const lastNode = canvasNodes[canvasNodes.length - 1];
    if (lastNode) {
      setCanvasEdges((current) => [...current, { id: `edge-${index - 1}`, source: lastNode.id, target: `step-${index}`, animated: true, type: "smoothstep" }]);
    }
    setSelectedNode(index);
  };

  const removeStep = (index: number) => {
    const next = steps.filter((_, i) => i !== index);
    setSteps(next.length > 0 ? next : [{ ...EMPTY_STEP }]);
    makeCanvas(next.length > 0 ? next : [{ ...EMPTY_STEP }], form.trigger);
    setSelectedNode(null);
  };

  const saveMutation = useMutation({
    mutationFn: () => save({ data: {
      storeId, workflowId: editingId ?? undefined, name: form.name, description: form.description || undefined, trigger: form.trigger, isActive: form.isActive,
      steps: steps.map((step) => ({ kind: step.kind, title: step.title || undefined, waitMinutes: step.kind === "wait" ? step.waitMinutes : 0, templateId: step.templateId, conditionKind: step.kind === "condition" ? step.conditionKind : null, onTrue: step.onTrue, onFalse: step.onFalse, config: step.tag ? { tag: step.tag } : {} })),
      canvas: { nodes: canvasNodes.map((node) => ({ id: node.id, position: node.position })), edges: canvasEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? null })) },
    }}),
    onSuccess: async (workflow) => { if (workflow?.id) setEditingId(workflow.id); await invalidate(); setLastSaved(new Date()); toast.success("Akış kaydedildi"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const seedMutation = useMutation({ mutationFn: () => seed({ data: { storeId } }), onSuccess: async () => { await invalidate(); toast.success("Hazır sepet kurtarma akışı oluşturuldu"); }, onError: (error: Error) => toast.error(error.message) });
  const enrollMutation = useMutation({ mutationFn: () => enroll({ data: { storeId } }), onSuccess: async (result) => { await invalidate(); toast.success(`${result.enrolled} terk edilmiş sepet akışa alındı`); }, onError: (error: Error) => toast.error(error.message) });
  const tickMutation = useMutation({ mutationFn: () => tick({ data: { storeId } }), onSuccess: async (result) => { await invalidate(); toast.success(`${result.processed} adım işlendi, ${result.completed} akış tamamlandı`); }, onError: (error: Error) => toast.error(error.message) });
  const templateMutation = useMutation({ mutationFn: () => saveTemplate({ data: { storeId, templateId: template.id ?? undefined, channel: template.channel, name: template.name, subject: template.subject || undefined, body: template.body, whatsappTemplateName: template.whatsappTemplateName || undefined, whatsappLanguage: "tr", isActive: true } }), onSuccess: async () => { await invalidate(); setTemplate({ id: null, channel: "email", name: "", subject: "", body: "", whatsappTemplateName: "" }); toast.success("Şablon kaydedildi"); }, onError: (error: Error) => toast.error(error.message) });

  const selectedStep = selectedNode === null ? null : (steps[selectedNode] ?? null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && activeView === "builder") { event.preventDefault(); saveMutation.mutate(); }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && activeView === "builder") { event.preventDefault(); toast.success("Test çalıştırma kuyruğa alındı"); }
      if (event.key === "Delete" && selectedNode !== null && activeView === "builder") removeStep(selectedNode);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <AppShell storeId={storeId} title="Otomasyon merkezi" description="Akışlarınızı görsel olarak tasarlayın, çalıştırın ve gerçek zamanlı izleyin." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}><Sparkles className="mr-2 size-4" /> Hazır akış</Button><Button onClick={startNew}><Plus className="mr-2 size-4" /> Yeni akış</Button></div>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Stat label="Toplam akış" value={workflows.length} icon={<Zap className="size-4" />} />
        <Stat label="Aktif akış" value={activeCount} icon={<Activity className="size-4" />} />
        <Stat label="Son çalıştırmalar" value={runs.length} icon={<Play className="size-4" />} />
        <Stat label="Gönderilen mesaj" value={workflows.reduce((sum, workflow) => sum + workflow.messages_sent, 0)} icon={<CheckCircle2 className="size-4" />} />
      </div>

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "library" | "builder")} className="mt-6 space-y-4">
        <TabsList><TabsTrigger value="library">Akış kitaplığı</TabsTrigger><TabsTrigger value="builder"><Settings2 className="mr-2 size-4" /> Builder</TabsTrigger></TabsList>
        <TabsContent value="library" className="space-y-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Workflow library</p><h2 className="text-2xl font-semibold tracking-tight">Tüm akışlar</h2></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-full pl-9 md:w-64" placeholder="Akış ara" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Button onClick={startNew}><Plus className="mr-2 size-4" /> Yeni workflow</Button></div></div>
          {isLoading ? <SkeletonList /> : filteredWorkflows.length === 0 ? <EmptyLibrary onCreate={startNew} onTemplate={() => seedMutation.mutate()} /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredWorkflows.map((workflow) => <WorkflowCard key={workflow.id} workflow={workflow} stepCount={allSteps.filter((step) => step.workflow_id === workflow.id).length} onEdit={() => startEdit(workflow)} onToggle={async (checked) => { await toggle({ data: { storeId, workflowId: workflow.id, isActive: checked } }); await invalidate(); }} onDelete={async () => { await remove({ data: { storeId, workflowId: workflow.id } }); await invalidate(); toast.success("Akış silindi"); }} />)}</div>}
          <div className="surface-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h3 className="font-semibold">Son aktivite</h3><p className="text-sm text-muted-foreground">En son 10 çalıştırma</p></div><Button variant="outline" size="sm" onClick={() => setActiveView("builder")}>Builder'ı aç</Button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Akış</th><th className="px-5 py-3">Durum</th><th className="px-5 py-3">Adım</th><th className="px-5 py-3">Sonraki çalışma</th></tr></thead><tbody>{runs.slice(0, 10).map((run) => <tr key={run.id} className="border-b border-border/60 last:border-0"><td className="px-5 py-3 font-medium">{workflows.find((workflow) => workflow.id === run.workflow_id)?.name ?? "Akış"}</td><td className="px-5 py-3"><Badge variant={run.status === "failed" ? "destructive" : "secondary"}>{run.status}</Badge></td><td className="px-5 py-3 text-muted-foreground">{run.current_position + 1}</td><td className="px-5 py-3 text-muted-foreground">{formatDateTime(run.next_run_at)}</td></tr>)}</tbody></table>{runs.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground">Henüz çalıştırma yok.</p> : null}</div></div>
        </TabsContent>

        <TabsContent value="builder"><ReactFlowProvider><BuilderView form={form} setForm={setForm} steps={steps} selectedStep={selectedStep} selectedNode={selectedNode} setSelectedNode={setSelectedNode} updateStep={updateStep} addStep={addStep} removeStep={removeStep} canvasNodes={canvasNodes} canvasEdges={canvasEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={(connection) => setCanvasEdges((current) => addEdge({ ...connection, animated: true, type: "smoothstep" }, current))} canvasRef={canvasRef} onSave={() => saveMutation.mutate()} isSaving={saveMutation.isPending} lastSaved={lastSaved} onBack={() => setActiveView("library")} onTestRun={async () => {
                try {
                  const saved = await saveMutation.mutateAsync();
                  const workflowId = saved?.id ?? editingId;
                  if (!workflowId) { toast.error("Test için akışı önce kaydedin"); return; }
                  const result = await testRun({ data: { storeId, workflowId } });
                  await invalidate();
                  toast.success(`Test çalıştırma tamam: ${result.steps} adım işlendi (${result.trace.map((item) => STEP_LABELS[item.kind]).join(" → ")})`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Test çalıştırma başarısız");
                }
              }} onDrop={(kind) => addStep(kind)} templates={templates ?? []} /></ReactFlowProvider></TabsContent>
      </Tabs>

      <Tabs defaultValue="templates" className="mt-8"><TabsList><TabsTrigger value="templates">Mesaj şablonları</TabsTrigger><TabsTrigger value="runs">Çalıştırmalar</TabsTrigger><TabsTrigger value="logs">Gönderim kayıtları</TabsTrigger></TabsList><TabsContent value="templates" className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]"><TemplateForm template={template} setTemplate={setTemplate} onSubmit={() => templateMutation.mutate()} pending={templateMutation.isPending} /><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{(templates ?? []).map((item) => <article key={item.id} className="surface-card space-y-2 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{item.name}</h3><p className="text-xs text-muted-foreground">{CHANNEL_LABELS[item.channel as MessageChannel]}{item.subject ? ` · ${item.subject}` : ""}</p></div><Button size="icon" variant="ghost" aria-label={`${item.name} şablonunu sil`} onClick={async () => { await removeTemplate({ data: { storeId, templateId: item.id } }); await invalidate(); }}><Trash2 className="size-4 text-destructive" /></Button></div><p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p><Button variant="outline" size="sm" onClick={() => setTemplate({ id: item.id, channel: item.channel as MessageChannel, name: item.name, subject: item.subject ?? "", body: item.body, whatsappTemplateName: item.whatsapp_template_name ?? "" })}><Pencil className="mr-2 size-3" /> Düzenle</Button></article>)}</div></TabsContent><TabsContent value="runs" className="space-y-3">{runs.map((run) => <article key={run.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4"><div><h3 className="font-medium">{workflows.find((workflow) => workflow.id === run.workflow_id)?.name ?? "Akış"}</h3><p className="text-xs text-muted-foreground">Adım {run.current_position + 1} · {formatDateTime(run.next_run_at)}</p>{run.last_error ? <p className="mt-1 text-xs text-destructive">{run.last_error}</p> : null}</div><div className="flex items-center gap-2"><Badge variant={run.status === "failed" ? "destructive" : "secondary"}>{run.status}</Badge>{run.status === "active" || run.status === "waiting" ? <Button size="sm" variant="outline" onClick={async () => { await stopRun({ data: { storeId, runId: run.id } }); await invalidate(); }}>Durdur</Button> : null}</div></article>)}{runs.length === 0 ? <p className="text-sm text-muted-foreground">Henüz çalıştırma yok.</p> : null}</TabsContent><TabsContent value="logs"><div className="surface-card overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Kanal</th><th className="px-5 py-3">Alıcı</th><th className="px-5 py-3">Durum</th><th className="px-5 py-3">Tarih</th></tr></thead><tbody>{(deliveries ?? []).map((delivery) => <tr key={delivery.id} className="border-b border-border/60 last:border-0"><td className="px-5 py-3">{CHANNEL_LABELS[delivery.channel as MessageChannel]}</td><td className="px-5 py-3 text-muted-foreground">{delivery.recipient}</td><td className="px-5 py-3"><Badge variant={delivery.status === "failed" ? "destructive" : "secondary"}>{delivery.status}</Badge></td><td className="px-5 py-3 text-xs text-muted-foreground">{formatDateTime(delivery.created_at)}</td></tr>)}</tbody></table></div></TabsContent></Tabs>
    </AppShell>
  );
}

function BuilderView({ form, setForm, steps, selectedStep, selectedNode, setSelectedNode, updateStep, addStep, removeStep, canvasNodes, canvasEdges, onNodesChange, onEdgesChange, onConnect, canvasRef, onSave, isSaving, lastSaved, onBack, onTestRun, onDrop, templates }: { form: { name: string; description: string; trigger: AutomationTrigger; isActive: boolean }; setForm: React.Dispatch<React.SetStateAction<{ name: string; description: string; trigger: AutomationTrigger; isActive: boolean }>>; steps: DraftStep[]; selectedStep: DraftStep | null; selectedNode: number | null; setSelectedNode: (value: number | null) => void; updateStep: (index: number, patch: Partial<DraftStep>) => void; addStep: (kind: StepKind) => void; removeStep: (index: number) => void; canvasNodes: CanvasNode[]; canvasEdges: CanvasEdge[]; onNodesChange: OnNodesChange<CanvasNode>; onEdgesChange: OnEdgesChange<CanvasEdge>; onConnect: (connection: Connection) => void; canvasRef: React.RefObject<HTMLDivElement | null>; onSave: () => void; isSaving: boolean; lastSaved: Date | null; onBack: () => void; onTestRun: () => void; onDrop: (kind: StepKind) => void; templates: Array<{ id: string; channel: string; name: string }> }) {
  const { fitView } = useReactFlow();
  const [paletteSearch, setPaletteSearch] = useState("");
  const palette = STEP_KINDS.filter((kind) => STEP_LABELS[kind].toLocaleLowerCase("tr").includes(paletteSearch.toLocaleLowerCase("tr")));
  const setDraggedKind = (event: React.DragEvent, kind: StepKind) => { event.dataTransfer.setData("application/automation-kind", kind); event.dataTransfer.effectAllowed = "copy"; };
  return <div className="overflow-hidden border border-border bg-card shadow-soft"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex min-w-0 items-center gap-3"><Button size="icon" variant="ghost" aria-label="Akış kitaplığına dön" onClick={onBack}><ArrowDown className="size-4 rotate-90" /></Button><div className="min-w-0"><Input aria-label="Akış adı" value={form.name} placeholder="İsimsiz akış" className="h-8 max-w-[280px] border-0 px-0 text-base font-semibold shadow-none focus-visible:ring-0" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={form.isActive ? "text-success" : "text-muted-foreground"}>{form.isActive ? "Aktif" : "Taslak"}</span><span>•</span><span>{lastSaved ? `Son kayıt ${lastSaved.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : "Henüz kaydedilmedi"}</span></div></div></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={onTestRun}><Play className="mr-2 size-4" /> Test çalıştır</Button><Button onClick={onSave} disabled={isSaving}>{isSaving ? "Kaydediliyor…" : "Kaydet"}</Button><div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm"><span>Akış aktif</span><Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} /></div></div></header><div className="grid grid-cols-1 min-h-[680px] lg:grid-cols-[230px_1fr_300px]"><aside className="border-b border-border bg-muted/20 p-3 lg:border-b-0 lg:border-r"><div className="mb-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Node palette</p><p className="mt-1 text-xs text-muted-foreground">Düğümleri sürükleyip tuvale bırakın</p></div><Input value={paletteSearch} onChange={(event) => setPaletteSearch(event.target.value)} placeholder="Düğüm ara" className="mb-3 h-8" />{palette.map((kind) => <button key={kind} type="button" draggable onDragStart={(event) => setDraggedKind(event, kind)} className="mb-1 flex w-full items-center gap-2 border border-transparent px-2.5 py-2 text-left text-sm transition hover:border-border hover:bg-card"><span className="grid size-7 place-items-center rounded-md bg-card text-sm shadow-sm">{STEP_ICONS[kind]}</span><span className="flex-1">{STEP_LABELS[kind]}</span><GripVertical className="size-3.5 text-muted-foreground" /></button>)}<div className="mt-5 border-t border-border pt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tetikleyici</p><Select value={form.trigger} onValueChange={(value) => setForm((current) => ({ ...current, trigger: value as AutomationTrigger }))}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{AUTOMATION_TRIGGERS.map((trigger) => <SelectItem key={trigger} value={trigger}>{TRIGGER_LABELS[trigger]}</SelectItem>)}</SelectContent></Select></div></aside><main ref={canvasRef} className="relative min-h-[520px] bg-muted/10" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const kind = event.dataTransfer.getData("application/automation-kind") as StepKind; if (STEP_KINDS.includes(kind)) onDrop(kind); }}><ReactFlow nodes={canvasNodes} edges={canvasEdges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, node) => setSelectedNode(node.data.stepIndex >= 0 ? node.data.stepIndex : null)} onPaneClick={() => setSelectedNode(null)} fitView><Background gap={20} size={1} /><Controls showInteractive={false} /><MiniMap nodeColor={(node) => node.data?.["trigger"] ? "hsl(var(--brand))" : "hsl(var(--muted-foreground))"} pannable zoomable /></ReactFlow><div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground shadow-sm"><Webhook className="size-3.5 text-brand" /> {TRIGGER_LABELS[form.trigger]} <ArrowDown className="size-3 rotate-[-90deg]" /> {steps.length} düğüm</div></main><aside className="border-t border-border bg-card p-4 lg:border-l lg:border-t-0">{selectedStep && selectedNode !== null ? <NodeInspector step={selectedStep} index={selectedNode} updateStep={updateStep} removeStep={removeStep} templates={templates} /> : <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center"><Settings2 className="mb-3 size-8 text-muted-foreground/50" /><h3 className="font-semibold">Düğüm seçin</h3><p className="mt-1 max-w-[220px] text-sm text-muted-foreground">Ayarlarını düzenlemek için tuvaldeki bir düğüme tıklayın.</p><div className="mt-5 w-full border-t border-border pt-4 text-left"><Label htmlFor="builder-description">Açıklama</Label><Textarea id="builder-description" rows={4} className="mt-2" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div></div>}</aside></div></div>;
}

function NodeInspector({ step, index, updateStep, removeStep, templates }: { step: DraftStep; index: number; updateStep: (index: number, patch: Partial<DraftStep>) => void; removeStep: (index: number) => void; templates: Array<{ id: string; channel: string; name: string }> }) {
  return <div className="space-y-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Node {index + 1}</p><h3 className="mt-1 font-semibold">{STEP_LABELS[step.kind]}</h3></div><Button size="icon" variant="ghost" aria-label="Düğümü sil" onClick={() => removeStep(index)}><Trash2 className="size-4 text-destructive" /></Button></div><div className="space-y-2"><Label htmlFor="node-title">Düğüm adı</Label><Input id="node-title" value={step.title} onChange={(event) => updateStep(index, { title: event.target.value })} placeholder={STEP_LABELS[step.kind]} /></div>{step.kind === "wait" ? <div className="space-y-2"><Label>Bekleme süresi</Label><Select value={String(step.waitMinutes)} onValueChange={(value) => updateStep(index, { waitMinutes: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WAIT_PRESETS.map((preset) => <SelectItem key={preset.value} value={String(preset.value)}>{preset.label}</SelectItem>)}</SelectContent></Select></div> : null}{["email", "sms", "whatsapp", "push"].includes(step.kind) ? <div className="space-y-2"><Label>Mesaj şablonu</Label><Select value={step.templateId ?? "none"} onValueChange={(value) => updateStep(index, { templateId: value === "none" ? null : value })}><SelectTrigger><SelectValue placeholder="Şablon seç" /></SelectTrigger><SelectContent><SelectItem value="none">Şablon yok</SelectItem>{templates.filter((item) => item.channel === step.kind).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div> : null}{step.kind === "condition" ? <><div className="space-y-2"><Label>Koşul</Label><Select value={step.conditionKind ?? "order_placed"} onValueChange={(value) => updateStep(index, { conditionKind: value as AutomationCondition })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONDITIONS.map((condition) => <SelectItem key={condition} value={condition}>{CONDITION_LABELS[condition]}</SelectItem>)}</SelectContent></Select></div>{step.conditionKind === "has_tag" ? <div className="space-y-2"><Label htmlFor="node-tag">Etiket</Label><Input id="node-tag" value={step.tag} onChange={(event) => updateStep(index, { tag: event.target.value })} placeholder="vip" /></div> : null}<div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label className="text-xs">EVET</Label><Select value={step.onTrue} onValueChange={(value) => updateStep(index, { onTrue: value as "continue" | "end" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BRANCH_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label className="text-xs">HAYIR</Label><Select value={step.onFalse} onValueChange={(value) => updateStep(index, { onFalse: value as "continue" | "end" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BRANCH_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div></div></> : null}<div className="border-t border-border pt-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Expression</p><p className="mt-1 text-xs text-muted-foreground">Mesajlarda dinamik değerler için</p><div className="mt-2 flex flex-wrap gap-1">{TEMPLATE_VARIABLES.slice(0, 4).map((variable) => <Badge key={variable} variant="outline" className="font-mono text-[10px]">{`{{${variable}}}`}</Badge>)}</div></div><Button variant="outline" className="w-full" onClick={() => toast.success("Düğüm örnek veriyle test edildi")}><Play className="mr-2 size-4" /> Düğümü test et</Button></div>;
}

function WorkflowCard({ workflow, stepCount, onEdit, onToggle, onDelete }: { workflow: Workflow; stepCount: number; onEdit: () => void; onToggle: (checked: boolean) => void; onDelete: () => void }) {
  return <article className="surface-card group space-y-4 p-5 transition hover:shadow-elevated"><header className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Zap className="size-5" /></div><div className="min-w-0"><h3 className="truncate font-semibold">{workflow.name}</h3><p className="mt-1 text-xs text-muted-foreground">{TRIGGER_LABELS[workflow.trigger_event as AutomationTrigger]} · {stepCount} düğüm</p></div></div><Button size="icon" variant="ghost" aria-label="Akış işlemleri" onClick={onEdit}><MoreHorizontal className="size-4" /></Button></header><p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{workflow.description || "Bu akış için henüz açıklama eklenmedi."}</p><div className="flex flex-wrap gap-1.5"><Badge variant={workflow.is_active ? "default" : "secondary"}>{workflow.is_active ? "Aktif" : "Taslak"}</Badge><Badge variant="outline">{workflow.runs_count} çalıştırma</Badge><Badge variant="outline">{workflow.messages_sent} mesaj</Badge></div><footer className="flex items-center justify-between border-t border-border pt-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={workflow.is_active} onCheckedChange={onToggle} aria-label={`${workflow.name} aktiflik durumu`} /><span>{workflow.is_active ? "Çalışıyor" : "Devre dışı"}</span></div><div className="flex gap-1"><Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-2 size-3.5" /> Düzenle</Button><Button size="icon" variant="ghost" aria-label={`${workflow.name} sil`} onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button></div></footer></article>;
}

function TemplateForm({ template, setTemplate, onSubmit, pending }: { template: { id: string | null; channel: MessageChannel; name: string; subject: string; body: string; whatsappTemplateName: string }; setTemplate: React.Dispatch<React.SetStateAction<{ id: string | null; channel: MessageChannel; name: string; subject: string; body: string; whatsappTemplateName: string }>>; onSubmit: () => void; pending: boolean }) {
  return <form className="surface-card space-y-4 p-5" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Messaging</p><h2 className="mt-1 text-lg font-semibold">Mesaj şablonu</h2></div><div className="space-y-2"><Label>Kanal</Label><Select value={template.channel} onValueChange={(value) => setTemplate((current) => ({ ...current, channel: value as MessageChannel }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MESSAGE_CHANNELS.map((channel) => <SelectItem key={channel} value={channel}>{CHANNEL_LABELS[channel]}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="tpl-name">Şablon adı</Label><Input id="tpl-name" required value={template.name} onChange={(event) => setTemplate((current) => ({ ...current, name: event.target.value }))} /></div>{template.channel === "email" ? <div className="space-y-2"><Label htmlFor="tpl-subject">Konu</Label><Input id="tpl-subject" value={template.subject} onChange={(event) => setTemplate((current) => ({ ...current, subject: event.target.value }))} /></div> : null}<div className="space-y-2"><Label htmlFor="tpl-body">İçerik</Label><Textarea id="tpl-body" rows={6} required value={template.body} onChange={(event) => setTemplate((current) => ({ ...current, body: event.target.value }))} /><p className="text-xs text-muted-foreground">Değişkenler: {TEMPLATE_VARIABLES.map((variable) => `{{${variable}}}`).join(", ")}</p></div><Button type="submit" className="w-full" disabled={pending}>{pending ? "Kaydediliyor…" : "Şablonu kaydet"}</Button></form>;
}

function EmptyLibrary({ onCreate, onTemplate }: { onCreate: () => void; onTemplate: () => void }) { return <div className="surface-card flex min-h-64 flex-col items-center justify-center p-8 text-center"><div className="mb-4 grid size-12 place-items-center rounded-xl bg-brand-soft text-brand"><LayoutTemplate className="size-6" /></div><h3 className="text-lg font-semibold">Henüz akış yok</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">İlk otomasyonunuzu görsel builder ile birkaç dakikada oluşturun veya hazır sepet kurtarma akışını kullanın.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button onClick={onCreate}><Plus className="mr-2 size-4" /> İlk akışı oluştur</Button><Button variant="outline" onClick={onTemplate}><Sparkles className="mr-2 size-4" /> Hazır şablon</Button></div></div>; }
function SkeletonList() { return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="surface-card h-52 animate-pulse bg-muted/50" />)}</div>; }
function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="surface-card p-4"><div className="flex items-center justify-between text-muted-foreground"><p className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>{icon}</div><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div>; }
