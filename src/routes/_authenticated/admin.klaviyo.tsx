import { createFileRoute, redirect } from "@tanstack/react-router";

/** Klaviyo bölümü kaldırıldı; platformun kendi E-posta Pazarlama sistemi kullanılır. */
export const Route = createFileRoute("/_authenticated/admin/klaviyo")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/email-marketing", replace: true });
  },
});
