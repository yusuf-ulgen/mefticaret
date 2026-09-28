import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFwCaptcha, solveFwCaptcha } from "@/lib/ddos-firewall.functions";

export const Route = createFileRoute("/guvenlik-kontrolu")({
  validateSearch: (s: Record<string, unknown>) => ({ r: typeof s['r'] === "string" ? s['r'] : "/" }),
  head: () => ({
    meta: [
      { title: "Güvenlik Kontrolü — Mefticaret" },
      { name: "description", content: "Güvenliğiniz için kısa bir doğrulama." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Güvenlik Kontrolü — Mefticaret" },
      { property: "og:description", content: "Güvenliğiniz için kısa bir doğrulama." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaptchaPage,
});

function safeBack(r: string) {
  return r.startsWith("/") && !r.startsWith("//") ? r : "/";
}

function CaptchaPage() {
  const { r } = Route.useSearch();
  const load = useServerFn(getFwCaptcha);
  const solve = useServerFn(solveFwCaptcha);
  const [ch, setCh] = useState<{ id: string; question: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setMsg(null);
    setAnswer("");
    try {
      setCh(await load());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Doğrulama yüklenemedi.");
    }
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ch) return;
    setBusy(true);
    try {
      const res = await solve({ data: { id: ch.id, answer: Number(answer) } });
      if (res.ok) window.location.href = safeBack(r);
      else {
        setMsg(res.message);
        if (/yenileyin/.test(res.message)) await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border p-8 text-center">
        <ShieldCheck className="mx-auto mb-4 size-10 text-primary" />
        <h1 className="text-xl font-semibold">Güvenlik Kontrolü</h1>
        <p className="mt-2 text-sm text-muted-foreground">Güvenliğiniz için kısa bir doğrulama gerekiyor.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <p className="text-2xl font-semibold tabular-nums">{ch?.question ?? "…"}</p>
          <Input inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ""))} placeholder="Cevap" aria-label="Cevap" />
          <Button type="submit" className="w-full rounded-full" disabled={!ch || !answer || busy}>Doğrula</Button>
        </form>
        {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}
        <p className="mt-4 text-xs text-muted-foreground">Sorun yaşıyorsanız sayfayı yenileyin.</p>
      </div>
    </main>
  );
}
