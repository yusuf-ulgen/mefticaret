import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, Check, Globe, Loader2, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addSecurityCountry,
  addSecurityIpRule,
  releaseSecurityLockout,
  removeSecurityCountry,
  removeSecurityIpRule,
  reviewSecurityFraud,
  revokeSecuritySession,
  saveSecurityRetention,
  saveSecuritySettings,
  setAttackFalsePositive,
  toggleSecurityWafRule,
} from "@/lib/security-admin.functions";
import {
  securityAttacksQuery,
  securityCountriesQuery,
  securityFraudQueueQuery,
  securityIpRulesQuery,
  securityLockoutsQuery,
  securityOverviewQuery,
  securityRetentionQuery,
  securitySessionsQuery,
  securitySettingsQuery,
  securityWafRulesQuery,
} from "@/lib/security-admin-queries";
import {
  ATTACK_TYPE_LABELS,
  FRAUD_ACTION_LABELS,
  IP_RULE_LABELS,
  SEC_ACTION_LABELS,
  SEVERITY_LABELS,
  WAF_MODE_LABELS,
  type AttackType,
  type Severity,
} from "@/lib/security-firewall";

/** Güvenlik duvarı ve tehdit yönetimi paneli. Mobil öncelikli, 8 sekme. */

type Row = Record<string, unknown>;

function str(row: Row, key: string) {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value);
}

function num(row: Row, key: string) {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function dt(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

const SEVERITY_TONE: Record<Severity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  critical: "bg-destructive/15 text-destructive",
};

function SeverityBadge({ value }: { value: string }) {
  const key = (["low", "medium", "high", "critical"] as Severity[]).includes(value as Severity)
    ? (value as Severity)
    : "low";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SEVERITY_TONE[key]}`}>
      {SEVERITY_LABELS[key]}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4">
        <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-10 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

export function SecurityPanel() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["security"] });

  return (
    <Tabs defaultValue="overview" className="w-full">
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <TabsList className="w-max min-w-full justify-start">
          <TabsTrigger value="overview">Genel bakış</TabsTrigger>
          <TabsTrigger value="attacks">Saldırılar</TabsTrigger>
          <TabsTrigger value="ips">IP kuralları</TabsTrigger>
          <TabsTrigger value="waf">WAF</TabsTrigger>
          <TabsTrigger value="fraud">Dolandırıcılık</TabsTrigger>
          <TabsTrigger value="sessions">Oturumlar</TabsTrigger>
          <TabsTrigger value="kvkk">KVKK</TabsTrigger>
          <TabsTrigger value="settings">Ayarlar</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="mt-4">
        <OverviewTab />
      </TabsContent>
      <TabsContent value="attacks" className="mt-4">
        <AttacksTab onChanged={invalidate} />
      </TabsContent>
      <TabsContent value="ips" className="mt-4">
        <IpRulesTab onChanged={invalidate} />
      </TabsContent>
      <TabsContent value="waf" className="mt-4">
        <WafTab onChanged={invalidate} />
      </TabsContent>
      <TabsContent value="fraud" className="mt-4">
        <FraudTab onChanged={invalidate} />
      </TabsContent>
      <TabsContent value="sessions" className="mt-4">
        <SessionsTab onChanged={invalidate} />
      </TabsContent>
      <TabsContent value="kvkk" className="mt-4">
        <RetentionTab onChanged={invalidate} />
      </TabsContent>
      <TabsContent value="settings" className="mt-4">
        <SettingsTab onChanged={invalidate} />
      </TabsContent>
    </Tabs>
  );
}

function OverviewTab() {
  const { data, isLoading, refetch, isRefetching } = useQuery(securityOverviewQuery());
  if (isLoading) return <Loading />;
  if (!data) return <Empty text="Güvenlik verisi okunamadı." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-600" />
          <div>
            <p className="text-sm font-medium">Güvenlik skoru</p>
            <p className="text-xs text-muted-foreground">
              {data.settings.firewallEnabled ? "Güvenlik duvarı açık" : "Güvenlik duvarı kapalı"} · WAF{" "}
              {WAF_MODE_LABELS[data.settings.wafMode as keyof typeof WAF_MODE_LABELS] ?? data.settings.wafMode}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-semibold tabular-nums">{data.score}</span>
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Yenile">
            <RefreshCw className={`size-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {!data.settings.firewallEnabled ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>
            Güvenlik duvarı şu anda kapalı; istekler kontrol edilmiyor. Ayarlar sekmesinden açabilirsiniz.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bugün engellenen" value={String(data.blockedToday)} hint="son 24 saat" />
        <Stat label="Saldırı kaydı" value={String(data.attacksToday)} hint="son 24 saat" />
        <Stat label="Kritik olay" value={String(data.criticalToday)} hint="son 24 saat" />
        <Stat label="İnceleme kuyruğu" value={String(data.fraudPending)} hint="bekleyen sipariş" />
        <Stat label="Aktif oturum" value={String(data.activeSessions)} hint="son 1 saat" />
        <Stat label="Kilitli hesap" value={String(data.lockouts)} />
        <Stat label="Kara liste IP" value={String(data.blacklistRules)} />
        <Stat
          label="SSL süresi"
          value={data.sslExpiringDays === null ? "—" : `${data.sslExpiringDays} gün`}
          hint={data.sslExpiringDays === null ? "kayıt yok" : "en yakın sertifika"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Saldırı türleri (24 saat)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.typeBreakdown.length === 0 ? (
            <Empty text="Son 24 saatte kayıtlı saldırı yok." />
          ) : (
            data.typeBreakdown.map((row) => (
              <div key={row.type} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">
                  {ATTACK_TYPE_LABELS[row.type as AttackType] ?? row.type}
                </span>
                <span className="tabular-nums text-muted-foreground">{row.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Son olaylar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recent.length === 0 ? (
            <Empty text="Kayıt yok." />
          ) : (
            data.recent.map((row) => (
              <div key={row.id} className="rounded-xl border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge value={row.severity} />
                  <span className="font-medium">
                    {ATTACK_TYPE_LABELS[row.attackType as AttackType] ?? row.attackType}
                  </span>
                  <Badge variant="outline">
                    {SEC_ACTION_LABELS[row.action as keyof typeof SEC_ACTION_LABELS] ?? row.action}
                  </Badge>
                </div>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {row.ip ?? "IP yok"} {row.country ? `· ${row.country}` : ""} · {dt(row.createdAt)}
                </p>
                {row.url ? <p className="mt-0.5 break-all text-xs text-muted-foreground">{row.url}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AttacksTab({ onChanged }: { onChanged: () => void }) {
  const [severity, setSeverity] = useState<string>("all");
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery(
    securityAttacksQuery({
      days,
      ...(severity === "all" ? {} : { severity: severity as Severity }),
    }),
  );
  const mutation = useMutation({
    mutationFn: (input: { id: string; isFalsePositive: boolean }) =>
      setAttackFalsePositive({ data: input }),
    onSuccess: () => {
      toast.success("Kayıt güncellendi");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm seviyeler</SelectItem>
            {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Son 24 saat</SelectItem>
            <SelectItem value="7">Son 7 gün</SelectItem>
            <SelectItem value="30">Son 30 gün</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Loading />
      ) : !data || data.length === 0 ? (
        <Empty text="Bu filtrelerle saldırı kaydı yok." />
      ) : (
        <div className="space-y-2">
          {(data as Row[]).map((row) => (
            <div key={str(row, "id")} className="rounded-xl border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge value={str(row, "severity")} />
                <span className="font-medium">
                  {ATTACK_TYPE_LABELS[str(row, "attack_type") as AttackType] ?? str(row, "attack_type")}
                </span>
                <Badge variant="outline">
                  {SEC_ACTION_LABELS[str(row, "action_taken") as keyof typeof SEC_ACTION_LABELS] ??
                    str(row, "action_taken")}
                </Badge>
                {row["is_false_positive"] ? <Badge variant="secondary">Yanlış alarm</Badge> : null}
              </div>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {str(row, "ip_address") || "IP yok"} · {dt(str(row, "created_at"))}
              </p>
              <p className="mt-0.5 break-all text-xs text-muted-foreground">
                {str(row, "request_method")} {str(row, "request_url")}
              </p>
              {str(row, "request_payload") ? (
                <p className="mt-1 break-all rounded-lg bg-muted/60 p-2 text-[11px]">
                  {str(row, "request_payload").slice(0, 300)}
                </p>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    id: str(row, "id"),
                    isFalsePositive: !row["is_false_positive"],
                  })
                }
              >
                {row["is_false_positive"] ? "Yanlış alarm işaretini kaldır" : "Yanlış alarm olarak işaretle"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IpRulesTab({ onChanged }: { onChanged: () => void }) {
  const rules = useQuery(securityIpRulesQuery());
  const countries = useQuery(securityCountriesQuery());
  const lockouts = useQuery(securityLockoutsQuery());

  const [ruleType, setRuleType] = useState("blacklist");
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [country, setCountry] = useState("");

  const addRule = useMutation({
    mutationFn: () =>
      addSecurityIpRule({
        data: {
          ruleType: ruleType as "whitelist" | "blacklist" | "rate_limit",
          ...(ip.includes("/") ? { ipRange: ip.trim() } : { ipAddress: ip.trim() }),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("IP kuralı eklendi");
      setIp("");
      setReason("");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeRule = useMutation({
    mutationFn: (id: string) => removeSecurityIpRule({ data: { id } }),
    onSuccess: () => {
      toast.success("Kural kaldırıldı");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const addCountry = useMutation({
    mutationFn: () => addSecurityCountry({ data: { countryCode: country.trim().toUpperCase() } }),
    onSuccess: () => {
      toast.success("Ülke engellendi");
      setCountry("");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeCountry = useMutation({
    mutationFn: (id: string) => removeSecurityCountry({ data: { id } }),
    onSuccess: () => {
      toast.success("Ülke engeli kaldırıldı");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const release = useMutation({
    mutationFn: (id: string) => releaseSecurityLockout({ data: { id } }),
    onSuccess: () => {
      toast.success("Kilit kaldırıldı");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Yeni IP kuralı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Kural türü</Label>
              <Select value={ruleType} onValueChange={setRuleType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IP_RULE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>IP veya aralık</Label>
              <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="85.100.0.1 veya 85.100.0.0/24" />
            </div>
            <div className="space-y-1.5">
              <Label>Gerekçe</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="İsteğe bağlı" />
            </div>
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={!ip.trim() || addRule.isPending}
            onClick={() => addRule.mutate()}
          >
            <Ban className="mr-2 size-4" /> Kuralı ekle
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">IP kuralları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rules.isLoading ? (
            <Loading />
          ) : !rules.data || rules.data.length === 0 ? (
            <Empty text="Henüz IP kuralı yok." />
          ) : (
            (rules.data as Row[]).map((row) => (
              <div key={str(row, "id")} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {str(row, "ip_address") || str(row, "ip_range")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {IP_RULE_LABELS[str(row, "rule_type") as keyof typeof IP_RULE_LABELS] ??
                      str(row, "rule_type")}{" "}
                    · {num(row, "hits_count")} eşleşme
                    {str(row, "reason") ? ` · ${str(row, "reason")}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Kaldır"
                  disabled={removeRule.isPending}
                  onClick={() => removeRule.mutate(str(row, "id"))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ülke engelleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={2}
              placeholder="Ülke kodu (RU, CN…)"
            />
            <Button
              disabled={country.trim().length !== 2 || addCountry.isPending}
              onClick={() => addCountry.mutate()}
            >
              <Globe className="mr-2 size-4" /> Engelle
            </Button>
          </div>
          {countries.data && countries.data.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(countries.data as Row[]).map((row) => (
                <span
                  key={str(row, "id")}
                  className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
                >
                  {str(row, "country_code")}
                  <button
                    type="button"
                    aria-label="Engeli kaldır"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => removeCountry.mutate(str(row, "id"))}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Engellenmiş ülke yok.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Kilitli hesap ve IP'ler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lockouts.isLoading ? (
            <Loading />
          ) : !lockouts.data || lockouts.data.length === 0 ? (
            <Empty text="Kilitli kayıt yok." />
          ) : (
            (lockouts.data as Row[]).map((row) => (
              <div key={str(row, "id")} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{str(row, "identifier_value")}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {str(row, "identifier_type")} · {num(row, "lockout_count")} kilit · bitiş{" "}
                    {dt(str(row, "locked_until"))}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={release.isPending}
                  onClick={() => release.mutate(str(row, "id"))}
                >
                  Kilidi aç
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WafTab({ onChanged }: { onChanged: () => void }) {
  const { data, isLoading } = useQuery(securityWafRulesQuery());
  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => toggleSecurityWafRule({ data: input }),
    onSuccess: () => {
      toast.success("Kural güncellendi");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <Loading />;
  if (!data || data.length === 0) return <Empty text="WAF kuralı yok." />;

  return (
    <div className="space-y-2">
      {(data as Row[]).map((row) => (
        <div key={str(row, "id")} className="flex items-start justify-between gap-3 rounded-xl border p-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{str(row, "rule_name")}</p>
              <SeverityBadge value={str(row, "severity")} />
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {ATTACK_TYPE_LABELS[str(row, "rule_type") as AttackType] ?? str(row, "rule_type")} ·{" "}
              {num(row, "hits_count")} eşleşme
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
              {str(row, "pattern").slice(0, 120)}
            </p>
          </div>
          <Switch
            checked={Boolean(row["is_active"])}
            disabled={toggle.isPending}
            onCheckedChange={(checked) => toggle.mutate({ id: str(row, "id"), isActive: checked })}
            aria-label="Kuralı aç/kapat"
          />
        </div>
      ))}
    </div>
  );
}

function FraudTab({ onChanged }: { onChanged: () => void }) {
  const { data, isLoading } = useQuery(securityFraudQueueQuery());
  const review = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "rejected" }) =>
      reviewSecurityFraud({ data: input }),
    onSuccess: () => {
      toast.success("İnceleme kaydedildi");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <Loading />;
  if (!data || data.length === 0) return <Empty text="Risk kaydı yok." />;

  return (
    <div className="space-y-2">
      {(data as Row[]).map((row) => {
        const signals = Array.isArray(row["sec_fraud_signals"]) ? (row["sec_fraud_signals"] as Row[]) : [];
        const score = num(row, "total_risk_score");
        return (
          <div key={str(row, "id")} className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Risk {score}/100 ·{" "}
                  {FRAUD_ACTION_LABELS[str(row, "action_taken") as keyof typeof FRAUD_ACTION_LABELS] ??
                    str(row, "action_taken")}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {str(row, "ip_address") || "IP yok"} · {dt(str(row, "created_at"))}
                </p>
              </div>
              <Badge
                variant={
                  str(row, "status") === "rejected"
                    ? "destructive"
                    : str(row, "status") === "approved"
                      ? "secondary"
                      : "outline"
                }
              >
                {str(row, "status") === "pending"
                  ? "Beklemede"
                  : str(row, "status") === "approved"
                    ? "Onaylandı"
                    : "Reddedildi"}
              </Badge>
            </div>
            {signals.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {signals.map((signal) => (
                  <li key={str(signal, "id")} className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{str(signal, "signal_value")}</span>
                    <span className="tabular-nums">+{num(signal, "risk_contribution")}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {str(row, "status") === "pending" ? (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: str(row, "id"), status: "approved" })}
                >
                  <Check className="mr-1.5 size-4" /> Onayla
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: str(row, "id"), status: "rejected" })}
                >
                  <X className="mr-1.5 size-4" /> Reddet
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SessionsTab({ onChanged }: { onChanged: () => void }) {
  const { data, isLoading } = useQuery(securitySessionsQuery());
  const revoke = useMutation({
    mutationFn: (id: string) => revokeSecuritySession({ data: { id } }),
    onSuccess: () => {
      toast.success("Oturum kapatıldı");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <Loading />;
  if (!data || data.length === 0) return <Empty text="Kayıtlı aktif oturum yok." />;

  return (
    <div className="space-y-2">
      {(data as Row[]).map((row) => (
        <div key={str(row, "id")} className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{str(row, "device_name") || "Bilinmeyen cihaz"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {str(row, "ip_address") || "IP yok"}
              {str(row, "city") ? ` · ${str(row, "city")}` : ""}
              {str(row, "country_code") ? ` · ${str(row, "country_code")}` : ""} · son hareket{" "}
              {dt(str(row, "last_activity_at"))}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(str(row, "id"))}
          >
            Kapat
          </Button>
        </div>
      ))}
    </div>
  );
}

const RETENTION_LABELS: Record<string, string> = {
  orders: "Siparişler",
  customers: "Müşteriler",
  logs: "Kayıtlar",
  analytics: "Analitik",
  sessions: "Oturumlar",
  attacks: "Saldırı kayıtları",
};

function RetentionTab({ onChanged }: { onChanged: () => void }) {
  const { data, isLoading } = useQuery(securityRetentionQuery());
  const save = useMutation({
    mutationFn: (input: {
      dataType: "orders" | "customers" | "logs" | "analytics" | "sessions" | "attacks";
      retentionDays: number;
      autoDelete: boolean;
    }) => saveSecurityRetention({ data: input }),
    onSuccess: () => {
      toast.success("Saklama süresi güncellendi");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        KVKK saklama süreleri. Süresi geçen kayıtlar otomatik silme açıkken temizlenir.
      </p>
      {(data as Row[] | undefined)?.map((row) => (
        <div key={str(row, "id")} className="space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {RETENTION_LABELS[str(row, "data_type")] ?? str(row, "data_type")}
            </p>
            <Switch
              checked={Boolean(row["auto_delete"])}
              disabled={save.isPending}
              aria-label="Otomatik silme"
              onCheckedChange={(checked) =>
                save.mutate({
                  dataType: str(row, "data_type") as "orders",
                  retentionDays: num(row, "retention_days"),
                  autoDelete: checked,
                })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              defaultValue={num(row, "retention_days")}
              className="w-28"
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (value > 0 && value !== num(row, "retention_days"))
                  save.mutate({
                    dataType: str(row, "data_type") as "orders",
                    retentionDays: value,
                    autoDelete: Boolean(row["auto_delete"]),
                  });
              }}
            />
            <span className="text-xs text-muted-foreground">gün saklanır</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ onChanged }: { onChanged: () => void }) {
  const { data, isLoading } = useQuery(securitySettingsQuery());
  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) => saveSecuritySettings({ data: input as never }),
    onSuccess: () => {
      toast.success("Ayarlar kaydedildi");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <Loading />;
  const row = (data ?? {}) as Row;

  const toggles: { key: string; label: string; hint: string }[] = [
    { key: "firewall_enabled", label: "Güvenlik duvarı", hint: "Tüm istek kontrollerini açar" },
    { key: "rate_limit_enabled", label: "Hız limiti", hint: "Aşırı istek yapan IP'leri yavaşlatır" },
    { key: "bot_detection_enabled", label: "Bot tespiti", hint: "Zararlı tarayıcı/bot imzalarını engeller" },
    { key: "country_block_enabled", label: "Ülke engeli", hint: "Seçili ülkelerden erişimi kapatır" },
    { key: "fraud_detection_enabled", label: "Dolandırıcılık kontrolü", hint: "Siparişleri risk skoruyla değerlendirir" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Koruma katmanları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {toggles.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </div>
              <Switch
                checked={Boolean(row[item.key])}
                disabled={save.isPending}
                aria-label={item.label}
                onCheckedChange={(checked) =>
                  save.mutate({
                    [item.key === "firewall_enabled"
                      ? "firewallEnabled"
                      : item.key === "rate_limit_enabled"
                        ? "rateLimitEnabled"
                        : item.key === "bot_detection_enabled"
                          ? "botDetectionEnabled"
                          : item.key === "country_block_enabled"
                            ? "countryBlockEnabled"
                            : "fraudDetectionEnabled"]: checked,
                  })
                }
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>WAF modu</Label>
            <Select
              value={str(row, "waf_mode") || "active"}
              onValueChange={(value) => save.mutate({ wafMode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(WAF_MODE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Giriş güvenliği</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Parola en az karakter"
            value={num(row, "password_min_length")}
            onSave={(value) => save.mutate({ passwordMinLength: value })}
          />
          <NumberField
            label="Hatalı deneme sınırı"
            value={num(row, "brute_force_max_attempts")}
            onSave={(value) => save.mutate({ bruteForceMaxAttempts: value })}
          />
          <NumberField
            label="Kilitleme süresi (dakika)"
            value={num(row, "brute_force_lock_minutes")}
            onSave={(value) => save.mutate({ bruteForceLockMinutes: value })}
          />
          <NumberField
            label="IP yasağı eşiği"
            value={num(row, "brute_force_ip_ban_attempts")}
            onSave={(value) => save.mutate({ bruteForceIpBanAttempts: value })}
          />
          <NumberField
            label="Yönetici oturum süresi (saat)"
            value={num(row, "admin_session_hours")}
            onSave={(value) => save.mutate({ adminSessionHours: value })}
          />
          <NumberField
            label="Satıcı oturum süresi (saat)"
            value={num(row, "seller_session_hours")}
            onSave={(value) => save.mutate({ sellerSessionHours: value })}
          />
          <NumberField
            label="Müşteri oturum süresi (gün)"
            value={num(row, "customer_session_days")}
            onSave={(value) => save.mutate({ customerSessionDays: value })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">İki adımlı doğrulama</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["admin_2fa", "admin2fa", "Yönetici"],
              ["seller_2fa", "seller2fa", "Satıcı"],
              ["customer_2fa", "customer2fa", "Müşteri"],
            ] as const
          ).map(([column, field, label]) => (
            <div key={column} className="space-y-1.5">
              <Label>{label}</Label>
              <Select
                value={str(row, column) || "optional"}
                onValueChange={(value) => save.mutate({ [field]: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Zorunlu</SelectItem>
                  <SelectItem value="optional">İsteğe bağlı</SelectItem>
                  <SelectItem value="off">Kapalı</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Uyarı kanalları</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Uyarı e-postası"
            value={str(row, "alert_email")}
            placeholder="guvenlik@mefticaret.com"
            onSave={(value) => save.mutate({ alertEmail: value || null })}
          />
          <TextField
            label="Webhook adresi (Slack / Discord)"
            value={str(row, "alert_webhook_url")}
            placeholder="https://hooks.slack.com/..."
            onSave={(value) => save.mutate({ alertWebhookUrl: value || null })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        defaultValue={value}
        onBlur={(e) => {
          const next = Number(e.target.value);
          if (next > 0 && next !== value) onSave(next);
        }}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next !== value) onSave(next);
        }}
      />
    </div>
  );
}
