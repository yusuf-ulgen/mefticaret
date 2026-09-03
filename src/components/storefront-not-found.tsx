import { useEffect } from "react";

import { recordStorefront404 } from "@/lib/seo-runtime.functions";

export function StorefrontNotFound({ slug, text }: { slug: string; text: string }) {
  useEffect(() => {
    const path = `${window.location.pathname}${window.location.search}`;
    void recordStorefront404({
      data: {
        slug,
        path,
        referrer: document.referrer || undefined,
        userAgent: navigator.userAgent,
      },
    });
  }, [slug]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">404</p>
      <h1 className="text-2xl font-semibold">{text}</h1>
      <a className="text-sm underline underline-offset-4" href={`/s/${slug}`}>
        Mağazaya dön
      </a>
    </div>
  );
}
