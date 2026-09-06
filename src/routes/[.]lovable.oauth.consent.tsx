import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Supabase OAuth 2.1 onay ekranı: bir ajan istemcisinin hesap adına çalışmasını onaylar. */

type AuthorizationDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id: typeof search["authorization_id"] === "string" ? search["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("authorization_id eksik");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/auth",
        search: { mode: "login" as const, next: location.pathname + location.searchStr },
      });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">Bağlantı isteği açılamadı</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "Bu uygulama";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: apiError } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (apiError) {
      setBusy(false);
      setError(apiError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Yetkilendirme sunucusu bir yönlendirme adresi döndürmedi.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <span className="eyebrow">Bağlantı İzni</span>
        <h1 className="mt-4 text-2xl font-bold leading-snug">
          {clientName} hesabınıza bağlanmak istiyor
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Onaylarsanız {clientName}, Mefticaret panelindeki mağazalarınızı sizin adınıza
          görüntüleyebilir ve izin verdiğiniz güncellemeleri yapabilir. Bu izni dilediğiniz zaman
          geri alabilirsiniz.
        </p>
        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1 rounded-full" disabled={busy} onClick={() => decide(true)}>
            Onayla
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-full"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Reddet
          </Button>
        </div>
      </div>
    </main>
  );
}
