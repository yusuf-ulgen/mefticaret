import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Link2, MessageSquare, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { OMNI_CHANNELS, channelLabel } from "@/lib/omni";

type Account = { channel: string; is_active: boolean };

const DEDICATED: Record<string, string> = {
  whatsapp: "whatsapp",
  instagram: "instagram",
  tiktok: "tiktok",
};

/** ikas benzeri iki adımlı Gelen Kutusu tanıtımı: hoş geldin + kanal bağlama. */
export function InboxOnboarding({
  storeId,
  accounts,
  onOpenChannels,
}: {
  storeId: string;
  accounts: Account[] | undefined;
  onOpenChannels: () => void;
}) {
  const key = `inbox-onboarding-done:${storeId}`;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (accounts === undefined) return;
    const done = window.localStorage.getItem(key) === "1";
    setOpen(!done && !accounts.some((a) => a.is_active));
  }, [accounts, key]);

  if (!open) return null;
  const close = () => {
    window.localStorage.setItem(key, "1");
    setOpen(false);
  };
  const connected = new Set((accounts ?? []).filter((a) => a.is_active).map((a) => a.channel));

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-display text-lg font-semibold">Mesaj Merkezi</span>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Kapat">
          <X className="size-5" />
        </Button>
      </div>
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
        {step === 1 ? (
          <>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold">Destek Hizmetine Hoş Geldin!</h1>
              <p className="text-muted-foreground">
                Bağladığın kanallardan gelen tüm müşteri mesajları burada toplanır. Konuşmaları tek ekranda
                görüp kolayca yanıtlayabilirsin.
              </p>
            </div>
            <div className="surface-card space-y-3 bg-muted/40 p-5">
              <p className="flex items-center gap-2 text-xs font-medium">
                <MessageSquare className="size-4" /> Destek Hizmeti
              </p>
              <div className="max-w-[80%] rounded-2xl bg-card p-3 text-sm shadow-sm">
                Merhaba, siyah deri ceketin M bedeni tekrar stoklara gelecek mi?
              </div>
              <div className="ml-auto max-w-[80%] rounded-2xl bg-primary p-3 text-sm text-primary-foreground">
                Merhaba, M beden 2-3 gün içinde stokta olacak.
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={() => setStep(2)}>
              Devam Et <ArrowRight className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setStep(1)} aria-label="Geri">
                <ArrowLeft className="size-4" />
              </Button>
              <span className="text-sm">2 <span className="text-muted-foreground">/2</span></span>
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold">Bağlamak İstediğin Kanalları Bağla</h1>
              <p className="text-muted-foreground">
                Yönetmek istediğin iletişim kanallarını bağlayarak Mesaj Merkezi'ni kullanmaya başla.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {OMNI_CHANNELS.map((channel) => {
                const isOn = connected.has(channel);
                const dedicated = DEDICATED[channel];
                return (
                  <div
                    key={channel}
                    className="flex min-h-14 items-center justify-between rounded-lg border border-border px-4"
                  >
                    <span className="text-sm font-medium">{channelLabel(channel)}</span>
                    {isOn ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary">
                        <Check className="size-3.5" /> Bağlı
                      </span>
                    ) : dedicated ? (
                      <Button asChild size="sm" variant="outline" onClick={close}>
                        <Link to={`/store/${storeId}/${dedicated}` as string}>
                          <Link2 className="size-3.5" /> Bağla
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          close();
                          onOpenChannels();
                        }}
                      >
                        <Link2 className="size-3.5" /> Bağla
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <Button className="w-full" size="lg" onClick={close}>
              Bağlamadan Devam Et
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
