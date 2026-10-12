import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Printer, Save } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BigButton, Sheet, SoftCard } from "@/components/homemaker/kolay-parts";
import type { SimpleProduct } from "@/lib/homemaker-queries";
import { materialsQuery, productMaterialsQuery } from "@/lib/kolay-v4-queries";
import { setProductMaterials } from "@/lib/kolay-v4.functions";
import { formatMoney } from "@/lib/mefti";

/**
 * Ambalaj etiketi: mağaza logosu, "Sevgiyle Yapıldı" rozeti, içindekiler ve
 * ürün sayfasına giden QR kod. Yazdır penceresinden PDF olarak kaydedilebilir.
 */
export function LabelSheet({
  product,
  onClose,
  storeId,
  storeName,
  storeLogo,
  storeUrl,
  currency,
}: {
  product: SimpleProduct | null;
  onClose: () => void;
  storeId: string;
  storeName: string;
  storeLogo: string | null;
  storeUrl: string;
  currency: string;
}) {
  const queryClient = useQueryClient();
  const { data: materials } = useQuery(materialsQuery(storeId));
  const { data: links } = useQuery(productMaterialsQuery(storeId));
  const saveLinks = useServerFn(setProductMaterials);

  const [selected, setSelected] = useState<string[]>([]);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);

  const productUrl = product?.slug ? `${storeUrl}/products?urun=${product.slug}` : storeUrl;

  useEffect(() => {
    if (!product) return;
    setSelected(links?.[product.id] ?? []);
  }, [product, links]);

  useEffect(() => {
    if (!product) return;
    QRCode.toDataURL(productUrl, { width: 400, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [product, productUrl]);

  const ingredientNames = (materials ?? [])
    .filter((material) => selected.includes(material.id))
    .map((material) => material.name);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const persist = async () => {
    if (!product) return;
    setBusy(true);
    try {
      await saveLinks({ data: { storeId, productId: product.id, materialIds: selected } });
      await queryClient.invalidateQueries({ queryKey: ["kolay-product-materials", storeId] });
      toast.success("İçindekiler kaydedildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    if (!product) return;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      toast.error("Yazdırma penceresi açılamadı. Tarayıcı izinlerini kontrol edin.");
      return;
    }
    const esc = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sticker = `
      <div class="sticker">
        ${storeLogo ? `<img class="logo" src="${esc(storeLogo)}" alt="" />` : `<div class="logo placeholder">${esc(storeName.slice(0, 1))}</div>`}
        <div class="body">
          <p class="store">${esc(storeName)}</p>
          <p class="title">${esc(product.title)}</p>
          <p class="badge">♥ Sevgiyle Yapıldı</p>
          <p class="ing">${ingredientNames.length ? `İçindekiler: ${esc(ingredientNames.join(", "))}` : "İçindekiler: ürününüze malzeme seçerek yazdırabilirsiniz"}</p>
          <p class="price">${esc(formatMoney(product.base_price, product.currency || currency))}</p>
        </div>
        ${qr ? `<img class="qr" src="${qr}" alt="" />` : ""}
      </div>`;
    win.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8" />
      <title>${esc(product.title)} etiketi</title>
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: Geist, system-ui, sans-serif; color: #3b3330; margin: 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
        .sticker { border: 1px dashed #d9cfca; border-radius: 6mm; padding: 5mm; display: flex; gap: 4mm; align-items: center; height: 42mm; box-sizing: border-box; }
        .logo { width: 16mm; height: 16mm; border-radius: 4mm; object-fit: cover; }
        .placeholder { display: grid; place-items: center; background: #fdf6f4; font-weight: 700; font-size: 8mm; }
        .body { flex: 1; min-width: 0; }
        .store { margin: 0; font-size: 3mm; color: #7a716d; letter-spacing: .4mm; text-transform: uppercase; }
        .title { margin: 1mm 0 0; font-size: 4.6mm; font-weight: 700; }
        .badge { margin: 1mm 0 0; font-size: 3.2mm; color: #c2415a; font-weight: 600; }
        .ing { margin: 1mm 0 0; font-size: 2.8mm; color: #7a716d; }
        .price { margin: 1mm 0 0; font-size: 4mm; font-weight: 700; color: #2f7d6b; }
        .qr { width: 18mm; height: 18mm; }
      </style></head><body>
      <div class="grid">${sticker.repeat(8)}</div>
      <script>window.onload = function () { window.print(); };</script>
      </body></html>`);
    win.document.close();
  };

  return (
    <Sheet open={Boolean(product)} title="Etiket tasarla & yazdır" onClose={onClose}>
      <div className="grid gap-4">
        <SoftCard className="grid gap-2 bg-hm-sand">
          <div className="flex items-center gap-3">
            <div className="size-14 shrink-0 overflow-hidden rounded-2xl bg-white">
              {storeLogo ? <img src={storeLogo} alt="" className="size-full object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-hm-ink-soft">
                {storeName}
              </p>
              <p className="truncate font-bold text-hm-ink">{product?.title}</p>
              <p className="text-sm font-semibold text-hm-rose">♥ Sevgiyle Yapıldı</p>
              <p className="text-xs text-hm-ink-soft">
                {ingredientNames.length
                  ? `İçindekiler: ${ingredientNames.join(", ")}`
                  : "İçindekiler için aşağıdan malzeme seçin"}
              </p>
            </div>
            {qr ? <img src={qr} alt="" className="size-16 rounded-xl bg-white p-1" /> : null}
          </div>
        </SoftCard>

        <div className="grid gap-2">
          <p className="text-sm font-semibold text-hm-ink">Bu ürünün içindekileri</p>
          {(materials ?? []).length === 0 ? (
            <p className="text-sm text-hm-ink-soft">
              Henüz malzeme eklemediniz. "Ürünlerim" sekmesindeki malzeme bölümünden un, fındık, yağ
              gibi malzemelerinizi ekleyin.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(materials ?? []).map((material) => {
                const active = selected.includes(material.id);
                return (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => toggle(material.id)}
                    className={`min-h-11 rounded-2xl px-3 text-sm font-semibold ${
                      active ? "bg-hm-teal text-white" : "bg-hm-sand text-hm-ink-soft"
                    }`}
                  >
                    {material.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <BigButton tone="ghost" disabled={busy} onClick={() => void persist()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Kaydet
          </BigButton>
          <BigButton tone="rose" onClick={print}>
            <Printer className="size-4" /> Yazdır (PDF)
          </BigButton>
        </div>
        <p className="text-xs text-hm-ink-soft">
          Yazdırma penceresinde "Hedef: PDF olarak kaydet" seçeneğini kullanarak A4 sayfada 8
          etiketi indirebilirsiniz.
        </p>
      </div>
    </Sheet>
  );
}
