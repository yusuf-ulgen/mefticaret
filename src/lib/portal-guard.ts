import { redirect } from "@tanstack/react-router";
import { toast } from "sonner";

import { getPortalAccess, type PortalAccess, type PortalKey } from "./portal-access.functions";

/** Portal hedef adresine yönlendirme (mevcut paneller korunur). */
export function portalRedirect(access: PortalAccess, key: PortalKey): never {
  switch (key) {
    case "merchant":
      throw redirect({ to: "/stores", replace: true });
    case "handmade":
      if (access.kolayStoreId) {
        throw redirect({ to: "/store/$storeId/kolay", params: { storeId: access.kolayStoreId }, replace: true });
      }
      throw redirect({ to: "/ev-hanimlari/kurulum", replace: true });
    case "supplier":
      throw redirect({ to: "/supplier/panel", replace: true });
    case "inbox":
      throw redirect({ to: "/mesajlar", replace: true });
  }
}

/**
 * İstenen portala yetkisi olan kullanıcıyı o panele, olmayanı ise kendi
 * yetkili paneline yönlendirir. Asıl veri güvenliği sunucu işlevleri ve RLS'tedir.
 */
export async function guardPortal(key: PortalKey): Promise<never> {
  const access = await getPortalAccess();
  if (access[key]) portalRedirect(access, key);
  if (typeof window !== "undefined") toast.error("Bu panele erişim yetkiniz yok; kendi panelinize yönlendirildiniz.");
  portalRedirect(access, access.primary);
}
