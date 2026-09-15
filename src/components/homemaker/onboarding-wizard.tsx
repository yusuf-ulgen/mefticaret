import { Heart, Package, Share2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { BigButton, Sheet } from "@/components/homemaker/kolay-parts";

const STEPS = [
  {
    icon: Heart,
    title: "Hoş geldiniz",
    text: "Bu panel üç bölümden oluşur: Mağazam, Ürünlerim ve Siparişlerim. Hepsi alt taraftaki düğmelerde.",
  },
  {
    icon: Wallet,
    title: "Mağazanızı tanıtın",
    text: "Mağazam bölümünde adınızı, fotoğrafınızı, WhatsApp numaranızı ve paranızı nasıl almak istediğinizi yazın.",
  },
  {
    icon: Package,
    title: "İlk ürününüzü ekleyin",
    text: "Ürünlerim bölümünde fotoğraf, isim ve fiyat yazmanız yeterli. Açıklamayı yardımcı sizin için yazabilir.",
  },
  {
    icon: Share2,
    title: "Bağlantınızı paylaşın",
    text: "Üst taraftaki paylaş düğmesinden mağaza bağlantınızı veya QR kodunuzu müşterilerinize gönderin.",
  },
];

/** İlk girişte gösterilen dört adımlı sade tanıtım. */
export function OnboardingWizard({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const key = `mefti.kolay.onboarded.${storeId}`;

  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {
      /* depolama kapalıysa tanıtım gösterilmez */
    }
  }, [key]);

  const finish = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* yoksay */
    }
    setOpen(false);
  };

  const current = STEPS[step]!;
  const Icon = current.icon;

  return (
    <Sheet open={open} title="Kısa tanıtım" onClose={finish}>
      <div className="grid gap-4 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-hm-rose-soft text-hm-rose">
          <Icon className="size-7" />
        </div>
        <h3 className="text-xl font-bold text-hm-ink">{current.title}</h3>
        <p className="text-sm text-hm-ink-soft">{current.text}</p>
        <div className="flex justify-center gap-1.5">
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={`h-2 rounded-full transition-all ${
                index === step ? "w-6 bg-hm-rose" : "w-2 bg-hm-line"
              }`}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <BigButton tone="ghost" onClick={finish}>
            Geç
          </BigButton>
          <BigButton
            onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}
          >
            {step === STEPS.length - 1 ? "Başla" : "Devam"}
          </BigButton>
        </div>
      </div>
    </Sheet>
  );
}
