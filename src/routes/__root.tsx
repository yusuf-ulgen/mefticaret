import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installClientErrorReporting, reportClientError } from "../lib/client-error-reporter";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart";
import { CompareProvider } from "@/lib/compare";
import { FavoritesProvider } from "@/lib/favorites";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { GA_EXCLUDED, GA_ID, GA_INLINE } from "@/lib/google-analytics";
import { documentLocale } from "@/lib/document-locale";
import { isChunkLoadError } from "@/lib/chunk-recovery";
import { ChunkRecovery } from "@/components/chunk-recovery";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Sayfa bulunamadı</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const chunkFailure = isChunkLoadError(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    reportClientError({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      severity: "CRITICAL",
      source: "react_error_boundary",
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Bu sayfa yüklenemedi
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {chunkFailure
            ? "Sayfa dosyası yüklenemedi. Bağlantınızı kontrol edin ve yeni sürümü almak için sayfayı yenileyin."
            : "Bir şeyler ters gitti. Sayfayı yenileyebilir veya ana sayfaya dönebilirsiniz."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (chunkFailure) {
                window.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {chunkFailure ? "Sayfayı yenile" : "Tekrar dene"}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ana sayfa
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mefticaret — Online Mağaza Kur, Pazaryerlerinde Sat" },
      {
        name: "description",
        content:
          "Mefticaret ile dakikalar içinde online mağazanı aç; ürün, sipariş, ödeme, kargo ve pazaryeri satışlarını tek panelden yönet.",
      },
      { property: "og:title", content: "Mefticaret — Online Mağaza Kur, Pazaryerlerinde Sat" },
      {
        property: "og:description",
        content:
          "Mefticaret ile dakikalar içinde online mağazanı aç; ürün, sipariş, ödeme, kargo ve pazaryeri satışlarını tek panelden yönet.",
      },
      { name: "author", content: "Mefticaret" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Mefticaret" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "google-site-verification",
        content: "8XkHbmDYTXWX4NVVyJppjPPk8WDnBCL9qEvrxOmAeXI",
      },
      {
        name: "google-site-verification",
        content: "jClDOjn42c5a7nqHlx8LDKO5vK9QAfq8TSdrOGcqzuc",
      },
      {
        name: "strix-verification",
        content: "strix-verify-e2df2dce799345923c84988a2b4bf8e4",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        // Tek istek: 5 ayrı engelleyici font CSS'i yerine birleşik dosya (mobil FCP/LCP).
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Tenor+Sans&family=Jost:wght@300;400;500;600&family=Cormorant+Garamond:wght@400;500;600;700&family=Karla:wght@300;400;500;600;700&family=Montserrat:wght@500;600;700;800&family=Nunito+Sans:wght@400;600;700&family=Inter:wght@400;500;600;700;800&display=swap",
      },

      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function manifestFor(path: string): string {
  if (path.startsWith("/mesaj")) return "/manifest-chat.webmanifest";
  if (path.startsWith("/tedarikci") || path.startsWith("/supplier"))
    return "/manifest-supplier.webmanifest";
  if (path.startsWith("/ev-hanimlari") || path.includes("/kolay"))
    return "/manifest-handmade.webmanifest";
  if (
    path.startsWith("/auth") ||
    path.startsWith("/stores") ||
    path.startsWith("/store/") ||
    path.startsWith("/dashboard")
  )
    return "/manifest-merchant.webmanifest";
  return "/manifest-main.webmanifest";
}

function RootShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const locale = documentLocale(pathname, search);
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <head>
        {!GA_EXCLUDED.test(pathname) && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <script dangerouslySetInnerHTML={{ __html: GA_INLINE }} />
          </>
        )}
        <HeadContent />
        <link rel="manifest" href={manifestFor(pathname)} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    installClientErrorReporting();
    if ("serviceWorker" in navigator && !window.location.hostname.includes("id-preview")) {
      void navigator.serviceWorker.register("/chat-sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);

  const { queryClient } = Route.useRouteContext();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const currentSearch = useRouterState({ select: (s) => s.location.searchStr });
  const explicitLocale =
    new URLSearchParams(currentSearch).has("locale") ||
    currentPath === "/" ||
    /^\/(en|de|fr|ar|ev-hanimlari|auth)(\/|$)/.test(currentPath);
  const routeLocale = documentLocale(currentPath, currentSearch);
  useEffect(() => {
    // Başlığın güncellenmesi için kısa gecikme.
    const timer = window.setTimeout(() => {
      void import("@/lib/platform-track").then((m) => m.trackPlatformView(currentPath));
      void import("@/lib/google-analytics").then((m) => m.trackGaPageView(currentPath));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [currentPath]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider
        initialLocale={routeLocale}
        routeLocale={explicitLocale ? routeLocale : undefined}
      >
        <AuthProvider>
          <CartProvider>
            <FavoritesProvider>
              <CompareProvider>
                {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                <Outlet />
                <ChunkRecovery />
              </CompareProvider>
            </FavoritesProvider>
          </CartProvider>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
