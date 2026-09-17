import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Store, Tag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { HOME_MAKER_CATEGORIES, createHomeMakerStore, getHomeMakerProfile } from "@/lib/home-maker.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ev-hanimlari/kurulum")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mağazanızı Kurun — Ev Hanımları Portalı" },
      {
        name: "description",
        content: "Adınız, mağaza adınız ve üretim kategorinizle mağazanızı üç adımda açın.",
      },
      { property: "og:title", content: "Mağazanızı Kurun — Ev Hanımları Portalı" },
      { property: "og:description", content: "Üç bilgiyle mağazanız hazır." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeMakerSetupPage,
});

function HomeMakerSetupPage() {
  const navigate = useNavigate();
  const readProfile = useServerFn(getHomeMakerProfile);
  const create = useServerFn(createHomeMakerStore);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [category, setCategory] = useState<(typeof HOME_MAKER_CATEGORIES)[number] | "">("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        await navigate({ to: "/ev-hanimlari", replace: true });
        return;
      }
      try {
        const profile = await readProfile();
        if (profile?.store_id) {
          await navigate({
            to: "/store/$storeId/kolay",
            params: { storeId: profile.store_id },
            replace: true,
          });
          return;
        }
      } catch {
        /* kayıt yoksa kurulum formu gösterilir */
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!category) {
      toast.error("Bir üretim kategorisi seçin.");
      return;
    }
    setBusy(true);
    try {
      const store = await create({ data: { fullName: fullName.trim(), storeName: storeName.trim(), category } });
      toast.success("Mağazanız hazır!");
      await navigate({ to: "/store/$storeId/kolay", params: { storeId: store.storeId }, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mağaza kurulamadı, tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-hm-sand">
        <Loader2 className="size-6 animate-spin text-hm-rose" />
      </div>
    );
  }

  return (
    <div className="hm-app min-h-screen bg-hm-sand px-5 py-10">
      <form onSubmit={submit} className="mx-auto grid w-full max-w-[420px] gap-5">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight text-hm-ink">Mağazanızı açalım</h1>
          <p className="mt-2 text-sm text-hm-ink-soft">Sadece üç bilgi yeterli.</p>
        </div>

        <div className="grid gap-2 rounded-[24px] border border-hm-line bg-white p-5">
          <label className="flex items-center gap-2 text-sm font-medium text-hm-ink" htmlFor="hm-name">
            <User className="size-4 text-hm-rose" /> Adınız
          </label>
          <Input
            id="hm-name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Ayşe Yılmaz"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="h-14 rounded-2xl border-hm-line text-base"
          />
        </div>

        <div className="grid gap-2 rounded-[24px] border border-hm-line bg-white p-5">
          <label className="flex items-center gap-2 text-sm font-medium text-hm-ink" htmlFor="hm-store">
            <Store className="size-4 text-hm-teal" /> Mağaza adınız
          </label>
          <Input
            id="hm-store"
            required
            minLength={2}
            maxLength={60}
            placeholder="Ayşe'nin El Emeği"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            className="h-14 rounded-2xl border-hm-line text-base"
          />
        </div>

        <div className="grid gap-3 rounded-[24px] border border-hm-line bg-white p-5">
          <span className="flex items-center gap-2 text-sm font-medium text-hm-ink">
            <Tag className="size-4 text-hm-amber" /> Ne üretiyorsunuz?
          </span>
          <div className="grid grid-cols-2 gap-2">
            {HOME_MAKER_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "min-h-14 rounded-2xl border px-3 py-2 text-left text-sm font-medium transition-colors",
                  category === item
                    ? "border-hm-rose bg-hm-rose/10 text-hm-ink"
                    : "border-hm-line bg-white text-hm-ink-soft",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {category === item ? <Check className="size-4 text-hm-rose" /> : null}
                  {item}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          disabled={busy}
          className="h-14 rounded-2xl bg-hm-rose text-base font-semibold text-white hover:bg-hm-rose/90"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : "Mağazamı oluştur"}
        </Button>
      </form>
    </div>
  );
}
