import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { unsubscribeByToken } from "@/lib/tracking-public.functions";

export const Route = createFileRoute("/bildirim-iptal")({
  validateSearch: (s) => z.object({ t: z.string().max(2000).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Bildirimlerden çık — Mefticaret" },
      { name: "description", content: "Mağaza bildirim e-postalarından tek tıkla çıkın." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Bildirimlerden çık — Mefticaret" },
      { property: "og:description", content: "Mağaza bildirim e-postalarından tek tıkla çıkın." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { t } = Route.useSearch();
  const run = useServerFn(unsubscribeByToken);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [store, setStore] = useState("");

  const confirm = async () => {
    if (!t) return;
    setState("busy");
    try {
      const res = await run({ data: { token: t } });
      if (res.ok) { setStore(res.storeName); setState("done"); } else setState("error");
    } catch { setState("error"); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface-card w-full max-w-sm space-y-4 p-6 text-center">
        {state === "done" ? (
          <>
            <h1 className="text-lg font-semibold">Bildirimlerden çıktınız</h1>
            <p className="text-sm text-muted-foreground">{store ? `${store} mağazası` : "Mağaza"} size artık bu kanaldan bildirim göndermeyecek.</p>
          </>
        ) : state === "error" || !t ? (
          <>
            <h1 className="text-lg font-semibold">Bağlantı geçersiz</h1>
            <p className="text-sm text-muted-foreground">Lütfen e-postadaki bağlantıyı yeniden açın.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Bildirimlerden çıkmak istiyor musunuz?</h1>
            <p className="text-sm text-muted-foreground">Bu mağazanın sipariş bildirim e-postalarını artık almayacaksınız.</p>
            <Button className="h-11 w-full" disabled={state === "busy"} onClick={confirm}>Evet, çık</Button>
          </>
        )}
      </div>
    </main>
  );
}
