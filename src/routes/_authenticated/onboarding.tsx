import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Check, Rocket } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createStore } from "@/lib/stores.functions";
import { plansQuery } from "@/lib/store-queries";
import { CURRENCIES, INDUSTRIES, LOCALES, ONBOARDING_STEPS, slugify, SUBDOMAIN_SUFFIX } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Mağaza Kurulumu — Mefticaret" },
      { name: "description", content: "10 adımlık kurulum sihirbazı ile mağazanı dakikalar içinde aç." },
      { property: "og:title", content: "Mağaza Kurulumu — Mefticaret" },
      { property: "og:description", content: "Mağaza adı, sektör, para birimi ve domain: kurulum başlıyor." },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useServerFn(createStore);
  const { data: plans } = useQuery(plansQuery());

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<string>("moda");
  const [currency, setCurrency] = useState<string>("TRY");
  const [locale, setLocale] = useState<string>("tr");
  const [planCode, setPlanCode] = useState<string>("free");

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          name: name.trim(),
          industry,
          currency: currency as "TRY",
          locale: locale as "tr",
          planCode,
        },
      }),
    onSuccess: async (store) => {
      await queryClient.invalidateQueries({ queryKey: ["my-stores"] });
      toast.success("Mağazan oluşturuldu — kurulum sihirbazına yönlendiriliyorsun.");
      void navigate({ to: "/store/$storeId/setup", params: { storeId: store.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const slug = slugify(name) || "magaza-adi";

  return (
    <AppShell
      title="Mağaza kurulumu"
      description="Marka adı, sektör ve temel ayarlar. Kalan adımlar Kurulum Sihirbazı ile tamamlanır."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <form
          className="surface-card space-y-6 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length < 2) {
              toast.error("Mağaza adı en az 2 karakter olmalı");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="store-name">Mağaza adı</Label>
            <Input
              id="store-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Örn. Atlas Moda"
              required
            />
            <p className="text-xs text-muted-foreground">
              Alt alan adın: <span className="font-medium text-foreground">{slug}.{SUBDOMAIN_SUFFIX}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sektör</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paket</Label>
              <Select value={planCode} onValueChange={setPlanCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(plans ?? []).map((plan) => (
                    <SelectItem key={plan.id} value={plan.code}>{plan.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Para birimi</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dil</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCALES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Mağaza kuruluyor..." : "Mağazamı oluştur"}
            <ArrowRight className="ml-2 size-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Mağaza oluşturulurken alt alan adı, ayarlar kaydı ve sahiplik yetkisi sunucu tarafında
            atanır; slug ve yetki istemciden kabul edilmez.
          </p>
        </form>

        <aside className="surface-card p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl brand-gradient text-brand-foreground">
              <Rocket className="size-4" />
            </span>
            <h2 className="font-display text-lg font-semibold">Kurulum adımları</h2>
          </div>
          <Progress value={30} className="mt-4" />
          <p className="mt-2 text-xs text-muted-foreground">Bu formu tamamladığında %40'a ulaşırsın.</p>
          <ol className="mt-5 space-y-3">
            {ONBOARDING_STEPS.map((step) => (
              <li key={step.step} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-xs font-semibold">
                  {step.step <= 1 ? <Check className="size-3 text-success" /> : step.step}
                </span>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <Badge variant="secondary" className="mt-5">Kurulum sihirbazı</Badge>
        </aside>
      </div>
    </AppShell>
  );
}
