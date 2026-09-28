import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addIpAction,
  deleteFwRule,
  enableHighRiskCountries,
  getFirewallDashboard,
  removeIpRule,
  saveFirewallSettings,
  toggleFwRule,
  upsertAsnRule,
  upsertCountryRule,
  upsertEndpointLimit,
} from "@/lib/ddos-firewall.functions";

export const Route = createFileRoute("/_authenticated/admin/firewall")({
  head: () => ({
    meta: [
      { title: "DDoS & Güvenlik Duvarı — Süper Admin" },
      { name: "description", content: "DDoS seviyesi, IP/ülke/ASN kuralları, hız limitleri ve doğrulama istatistikleri." },
      { property: "og:title", content: "DDoS & Güvenlik Duvarı — Süper Admin" },
      { property: "og:description", content: "Platform geneli DDoS ve erişim kuralları." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FirewallPage,
});

const LEVELS = ["Normal", "Dikkat", "Uyarı", "Saldırı", "Kritik"];
const RULE_LABEL: Record<string, string> = {
  block: "Engelle", allow: "İzin ver", captcha: "Doğrulama", rate_limit: "Yavaşlat",
  blacklist: "Kara liste", whitelist: "İzin listesi",
};
const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(n);
const dt = (s: string) => new Date(s).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

type Dash = Awaited<ReturnType<typeof getFirewallDashboard>>;

function FirewallPage() {
  const fetchDash = useServerFn(getFirewallDashboard);
  const q = useQuery({ queryKey: ["fw-dashboard"], queryFn: () => fetchDash(), refetchInterval: 30_000 });
  return (
    <AdminShell title="DDoS & güvenlik duvarı" description="Platform geneli saldırı seviyesi, erişim kuralları ve hız limitleri.">
      {q.isLoading && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && <Body d={q.data} />}
    </AdminShell>
  );
}

function useAct<T>(fn: (a: { data: T }) => Promise<unknown>, ok = "Kaydedildi") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: T) => fn({ data }),
    onSuccess: () => { toast.success(ok); void qc.invalidateQueries({ queryKey: ["fw-dashboard"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
}

function Body({ d }: { d: Dash }) {
  const s = d.settings;
  const last = d.snapshots.at(-1);
  const active = d.events.find((e) => e.is_active);
  const bans = d.ipRules.filter((r) => r.rule_type === "blacklist").length;
  const level = s?.current_level ?? 0;
  return (
    <div className="space-y-6">
      {!s?.enabled && (
        <div className="rounded-xl border border-border bg-muted p-4 text-sm">
          Sistem şu an <b>kapalı</b>. Ayarlar sekmesinden açabilirsiniz; kapalıyken ziyaretçiler hiçbir kontrolden geçmez.
        </div>
      )}
      <div className={`rounded-2xl border p-5 ${active ? "border-destructive bg-destructive/5" : "border-border"}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{active ? "Saldırı tespit edildi" : "Sistem durumu"}</p>
        <p className="mt-1 text-2xl font-semibold">Seviye {level} — {LEVELS[level]}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Son dakika istek" value={fmt(Number(last?.requests_total ?? 0))} />
          <Stat label="Engellenen (son dk)" value={fmt(Number(last?.requests_blocked ?? 0))} />
          <Stat label="Aktif ban" value={fmt(bans)} />
          <Stat label="Bekleyen doğrulama (24s)" value={fmt(d.captcha.pending ?? 0)} />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="ddos">DDoS İzleme</TabsTrigger>
          <TabsTrigger value="ip">IP Kuralları</TabsTrigger>
          <TabsTrigger value="country">Ülke Kuralları</TabsTrigger>
          <TabsTrigger value="asn">ASN Kuralları</TabsTrigger>
          <TabsTrigger value="rate">Hız Limitleri</TabsTrigger>
          <TabsTrigger value="traffic">Trafik & Doğrulama</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview d={d} /></TabsContent>
        <TabsContent value="ddos"><Ddos d={d} /></TabsContent>
        <TabsContent value="ip"><IpTab d={d} /></TabsContent>
        <TabsContent value="country"><CountryTab d={d} /></TabsContent>
        <TabsContent value="asn"><AsnTab d={d} /></TabsContent>
        <TabsContent value="rate"><RateTab d={d} /></TabsContent>
        <TabsContent value="traffic"><TrafficTab d={d} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-border p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Overview({ d }: { d: Dash }) {
  const max = Math.max(1, ...d.snapshots.map((x) => Number(x.requests_total)));
  return (
    <>
      <Card title="Son 60 dakika (istek/dakika)">
        {d.snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz veri yok. Sistem açıkken her dakika bir ölçüm eklenir.</p>
        ) : (
          <div className="flex h-32 items-end gap-0.5">
            {d.snapshots.map((x) => (
              <div key={x.snapshot_at} className="relative flex-1" title={`${dt(x.snapshot_at)} · ${fmt(Number(x.requests_total))}`}>
                <div className={`w-full rounded-t ${x.level >= 2 ? "bg-destructive" : "bg-primary"}`} style={{ height: `${(Number(x.requests_total) / max) * 120}px` }} />
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Son hız limiti ihlalleri">
        <List rows={d.violations.slice(0, 15).map((v) => [dt(v.created_at), v.ip_address, v.endpoint, `${v.requests_in_window}/${v.limit_threshold}`, v.action_taken])} empty="İhlal yok." />
      </Card>
    </>
  );
}

function List({ rows, empty }: { rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => <td key={j} className="whitespace-nowrap px-2 py-2">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ddos({ d }: { d: Dash }) {
  const save = useAct(useServerFn(saveFirewallSettings));
  const s = d.settings;
  const [f, setF] = useState(() => ({
    enabled: s?.enabled ?? false, auto_mitigation: s?.auto_mitigation ?? true,
    level1_rpm: s?.level1_rpm ?? 60000, level2_rpm: s?.level2_rpm ?? 300000,
    level3_rpm: s?.level3_rpm ?? 1200000, level4_rpm: s?.level4_rpm ?? 6000000,
    auto_ban_per_minute: s?.auto_ban_per_minute ?? 600, auto_ban_minutes: s?.auto_ban_minutes ?? 60,
  }));
  useEffect(() => { if (s) setF((p) => ({ ...p, enabled: s.enabled })); }, [s?.enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  const num = (k: keyof typeof f, label: string) => (
    <label className="text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input type="number" value={String(f[k])} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
    </label>
  );
  return (
    <>
      <Card title="Ayarlar">
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">Sistem açık <Switch checked={f.enabled} onCheckedChange={(v) => setF({ ...f, enabled: v })} /></label>
          <label className="flex items-center justify-between gap-3 text-sm">Otomatik müdahale (ban + doğrulama) <Switch checked={f.auto_mitigation} onCheckedChange={(v) => setF({ ...f, auto_mitigation: v })} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            {num("level1_rpm", "Seviye 1 eşiği (istek/dk)")}
            {num("level2_rpm", "Seviye 2 eşiği (istek/dk)")}
            {num("level3_rpm", "Seviye 3 eşiği (istek/dk)")}
            {num("level4_rpm", "Seviye 4 eşiği (istek/dk)")}
            {num("auto_ban_per_minute", "Otomatik ban: IP başına istek/dk")}
            {num("auto_ban_minutes", "Ban süresi (dakika)")}
          </div>
          <Button className="rounded-full" onClick={() => save.mutate(f)} disabled={save.isPending}>Kaydet</Button>
          <p className="text-xs text-muted-foreground">Büyük hacimli ağ saldırıları sitenin önündeki Cloudflare katmanında karşılanır; bu ayarlar uygulama katmanını korur.</p>
        </div>
      </Card>
      <Card title="Olaylar">
        <List
          rows={d.events.map((e) => [
            e.is_active ? <Badge variant="destructive">Aktif</Badge> : <Badge variant="secondary">Bitti</Badge>,
            dt(e.started_at), e.ended_at ? dt(e.ended_at) : "—", `Seviye ${e.peak_level}`, `Tepe ${fmt(Number(e.peak_rpm))}/dk`, `${fmt(Number(e.blocked_requests))} engellendi`,
          ])}
          empty="Aktif saldırı yok, geçmiş olay yok."
        />
      </Card>
    </>
  );
}

function IpTab({ d }: { d: Dash }) {
  const add = useAct(useServerFn(addIpAction), "Kural eklendi");
  const rm = useAct(useServerFn(removeIpRule), "Kural kaldırıldı");
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState("");
  const [search, setSearch] = useState("");
  const rows = d.ipRules.filter((r) => !search || `${r.ip_address ?? ""} ${r.ip_range ?? ""} ${r.reason ?? ""}`.includes(search));
  return (
    <>
      <Card title="Yeni IP kuralı">
        <div className="grid gap-2 sm:grid-cols-4">
          <Input placeholder="IP veya CIDR (ör. 1.2.3.0/24)" value={ip} onChange={(e) => setIp(e.target.value)} />
          <Input placeholder="Neden" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Input placeholder="Süre (saat, boş = kalıcı)" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ""))} />
          <div className="flex gap-2">
            <Button className="flex-1 rounded-full" onClick={() => add.mutate({ ip, type: "blacklist", reason, hours: hours ? Number(hours) : undefined })}>Ban</Button>
            <Button variant="outline" className="flex-1 rounded-full" onClick={() => add.mutate({ ip, type: "whitelist", reason, hours: hours ? Number(hours) : undefined })}>İzin ver</Button>
          </div>
        </div>
      </Card>
      <Card title={`Aktif kurallar (${d.ipRules.length})`}>
        <Input className="mb-3" placeholder="IP veya neden ara" value={search} onChange={(e) => setSearch(e.target.value)} />
        <List
          rows={rows.map((r) => [
            <span className="font-mono">{r.ip_address ?? r.ip_range}</span>,
            <Badge variant={r.rule_type === "blacklist" ? "destructive" : "secondary"}>{RULE_LABEL[r.rule_type] ?? r.rule_type}</Badge>,
            r.reason ?? "—", r.expires_at ? `Bitiş ${dt(r.expires_at)}` : "Kalıcı",
            <Button size="sm" variant="ghost" onClick={() => rm.mutate({ id: r.id })}>Kaldır</Button>,
          ])}
          empty="Kural yok."
        />
      </Card>
    </>
  );
}

function RuleActions({ kind, id, active }: { kind: "country" | "asn" | "endpoint"; id: string; active: boolean }) {
  const toggle = useAct(useServerFn(toggleFwRule));
  const del = useAct(useServerFn(deleteFwRule), "Silindi");
  return (
    <div className="flex items-center gap-2">
      <Switch checked={active} onCheckedChange={(v) => toggle.mutate({ kind, id, active: v })} aria-label="Aktif" />
      <Button size="sm" variant="ghost" onClick={() => del.mutate({ kind, id })}>Sil</Button>
    </div>
  );
}

function CountryTab({ d }: { d: Dash }) {
  const up = useAct(useServerFn(upsertCountryRule));
  const hr = useAct(useServerFn(enableHighRiskCountries), "Yüksek riskli ülkelerde doğrulama açıldı");
  const [f, setF] = useState({ country_code: "", country_name: "", rule_type: "block" as "block" | "allow" | "captcha" | "rate_limit", reason: "" });
  return (
    <>
      <Card title="Ülke kuralı ekle">
        <div className="grid gap-2 sm:grid-cols-5">
          <Input placeholder="Kod (ör. DE)" maxLength={2} value={f.country_code} onChange={(e) => setF({ ...f, country_code: e.target.value.toUpperCase() })} />
          <Input placeholder="Ülke adı" value={f.country_name} onChange={(e) => setF({ ...f, country_name: e.target.value })} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={f.rule_type} onChange={(e) => setF({ ...f, rule_type: e.target.value as typeof f.rule_type })}>
            <option value="block">Engelle</option><option value="captcha">Doğrulama</option><option value="rate_limit">Yavaşlat</option><option value="allow">İzin ver</option>
          </select>
          <Input placeholder="Neden" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <Button className="rounded-full" onClick={() => up.mutate(f)}>Ekle</Button>
        </div>
        <Button variant="outline" className="mt-3 rounded-full" onClick={() => hr.mutate(undefined as never)}>Yüksek riskli ülkelerde doğrulamayı aç</Button>
      </Card>
      <Card title="Ülke kuralları">
        <List rows={d.countries.map((c) => [<b>{c.country_code}</b>, c.country_name, <Badge variant={c.rule_type === "block" ? "destructive" : "secondary"}>{RULE_LABEL[c.rule_type]}</Badge>, c.reason ?? "—", <RuleActions kind="country" id={c.id} active={c.is_active} />])} empty="Kural yok." />
      </Card>
    </>
  );
}

function AsnTab({ d }: { d: Dash }) {
  const up = useAct(useServerFn(upsertAsnRule));
  const [f, setF] = useState({ asn: "", asn_name: "", rule_type: "captcha" as "block" | "captcha" | "rate_limit", reason: "" });
  return (
    <>
      <Card title="ASN kuralı ekle">
        <div className="grid gap-2 sm:grid-cols-5">
          <Input placeholder="AS numarası (ör. 14061)" value={f.asn} onChange={(e) => setF({ ...f, asn: e.target.value.replace(/\D/g, "") })} />
          <Input placeholder="Ağ adı" value={f.asn_name} onChange={(e) => setF({ ...f, asn_name: e.target.value })} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={f.rule_type} onChange={(e) => setF({ ...f, rule_type: e.target.value as typeof f.rule_type })}>
            <option value="captcha">Doğrulama</option><option value="block">Engelle</option><option value="rate_limit">Yavaşlat</option>
          </select>
          <Input placeholder="Neden" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <Button className="rounded-full" onClick={() => up.mutate({ asn_number: Number(f.asn), asn_name: f.asn_name, rule_type: f.rule_type, reason: f.reason })}>Ekle</Button>
        </div>
      </Card>
      <Card title="ASN kuralları">
        <List rows={d.asns.map((a) => [<b>AS{a.asn_number}</b>, a.asn_name, <Badge variant={a.rule_type === "block" ? "destructive" : "secondary"}>{RULE_LABEL[a.rule_type]}</Badge>, a.reason ?? "—", <RuleActions kind="asn" id={a.id} active={a.is_active} />])} empty="Kural yok." />
      </Card>
    </>
  );
}

function RateTab({ d }: { d: Dash }) {
  const up = useAct(useServerFn(upsertEndpointLimit));
  const [f, setF] = useState({ path_prefix: "", limit_count: "10", window_seconds: "60", on_exceed: "block" as "block" | "captcha" });
  const [test, setTest] = useState("");
  const match = test ? [...d.endpoints].filter((e) => e.is_active).sort((a, b) => b.path_prefix.length - a.path_prefix.length).find((e) => test === e.path_prefix || test.startsWith(`${e.path_prefix}/`)) : undefined;
  return (
    <>
      <Card title="Sayfa bazlı kural ekle / güncelle">
        <div className="grid gap-2 sm:grid-cols-5">
          <Input placeholder="/login" value={f.path_prefix} onChange={(e) => setF({ ...f, path_prefix: e.target.value })} />
          <Input placeholder="İstek" inputMode="numeric" value={f.limit_count} onChange={(e) => setF({ ...f, limit_count: e.target.value.replace(/\D/g, "") })} />
          <Input placeholder="Saniye" inputMode="numeric" value={f.window_seconds} onChange={(e) => setF({ ...f, window_seconds: e.target.value.replace(/\D/g, "") })} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={f.on_exceed} onChange={(e) => setF({ ...f, on_exceed: e.target.value as typeof f.on_exceed })}>
            <option value="block">Aşılırsa 429</option><option value="captcha">Aşılırsa doğrulama</option>
          </select>
          <Button className="rounded-full" onClick={() => up.mutate({ path_prefix: f.path_prefix, limit_count: Number(f.limit_count), window_seconds: Number(f.window_seconds), on_exceed: f.on_exceed })}>Kaydet</Button>
        </div>
      </Card>
      <Card title="Kurallar">
        <List rows={d.endpoints.map((e) => [<span className="font-mono">{e.path_prefix}</span>, `${e.limit_count} istek / ${e.window_seconds} sn / IP`, e.on_exceed === "captcha" ? "Doğrulama" : "429", <RuleActions kind="endpoint" id={e.id} active={e.is_active} />])} empty="Kural yok." />
      </Card>
      <Card title="Test aracı">
        <Input placeholder="/login" value={test} onChange={(e) => setTest(e.target.value)} />
        <p className="mt-2 text-sm">{!test ? "Bir adres yazın." : match ? `Eşleşen kural: ${match.path_prefix} — ${match.limit_count} istek / ${match.window_seconds} sn, aşılırsa ${match.on_exceed === "captcha" ? "doğrulama" : "429"}.` : "Sayfaya özel kural yok; yalnız genel IP limiti uygulanır."}</p>
      </Card>
    </>
  );
}

function TrafficTab({ d }: { d: Dash }) {
  const add = useAct(useServerFn(addIpAction), "Kural eklendi");
  const totals = d.snapshots.reduce((a, x) => ({ req: a.req + Number(x.requests_total), bl: a.bl + Number(x.requests_blocked), ch: a.ch + Number(x.requests_challenged) }), { req: 0, bl: 0, ch: 0 });
  const countries = new Map<string, number>();
  const paths = new Map<string, number>();
  for (const s of d.snapshots) {
    for (const c of (s.top_countries as { key: string; count: number }[]) ?? []) countries.set(c.key, (countries.get(c.key) ?? 0) + c.count);
    for (const p of (s.top_endpoints as { key: string; count: number }[]) ?? []) paths.set(p.key, (paths.get(p.key) ?? 0) + p.count);
  }
  const topC = [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topP = [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const cap = d.captcha;
  const capTotal = (cap.passed ?? 0) + (cap.failed ?? 0) + (cap.expired ?? 0);
  const pct = (n: number) => (totals.req ? `%${((n / totals.req) * 100).toFixed(1)}` : "—");
  return (
    <>
      <Card title="Son 1 saat özeti">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Toplam istek" value={fmt(totals.req)} />
          <Stat label="Engellenen" value={`${fmt(totals.bl)} (${pct(totals.bl)})`} />
          <Stat label="Doğrulama istenen" value={`${fmt(totals.ch)} (${pct(totals.ch)})`} />
          <Stat label="Doğrulama geçme (24s)" value={capTotal ? `%${Math.round(((cap.passed ?? 0) / capTotal) * 100)}` : "—"} />
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Ülkeler (top 10)"><List rows={topC.map(([k, v]) => [k, fmt(v)])} empty="Veri yok." /></Card>
        <Card title="Sayfalar (top 10)"><List rows={topP.map(([k, v]) => [<span className="font-mono">{k}</span>, fmt(v)])} empty="Veri yok." /></Card>
      </div>
      <Card title="En çok ihlal yapan IP'ler">
        <List
          rows={d.topIps.map((r) => [
            <span className="font-mono">{r.ip}</span>, `${r.count} ihlal`,
            <div className="flex gap-2">
              <Button size="sm" onClick={() => add.mutate({ ip: r.ip, type: "blacklist", reason: "Trafik analizinden ban", hours: 24 })}>Ban (24s)</Button>
              <Button size="sm" variant="outline" onClick={() => add.mutate({ ip: r.ip, type: "whitelist", reason: "Trafik analizinden izin" })}>İzin ver</Button>
            </div>,
          ])}
          empty="İhlal yapan IP yok."
        />
      </Card>
    </>
  );
}
