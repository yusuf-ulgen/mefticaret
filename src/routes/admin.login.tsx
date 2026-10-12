import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Ayrı süper admin giriş ekranı kaldırıldı.
 *
 * Süper yönetici de normal e-posta/şifre girişini kullanır; `platform_admin`
 * rolü sunucuda doğrulandığında panel oturumu otomatik açılır ve kullanıcı
 * `/admin` adresine yönlendirilir.
 */
export const Route = createFileRoute("/admin/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { next: "/admin" } });
  },
});
