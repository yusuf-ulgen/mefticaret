/** Yayınlanmış politika metnini (mağaza veya platform) okunabilir biçimde gösterir. */

import type { PublicPolicy } from "@/lib/policies-public.functions";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : null;

export function PolicyArticle({ policy, muted }: { policy: PublicPolicy; muted?: string }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 pb-12 pt-4">
      <h1 style={{ fontSize: "clamp(24px, 6vw, 32px)", fontWeight: 700, lineHeight: 1.25, margin: 0 }}>{policy.title}</h1>
      <p style={{ color: muted, fontSize: 13, marginTop: 8 }}>
        {[`Sürüm ${policy.version}`, policy.effectiveDate ? `Yürürlük: ${fmt(policy.effectiveDate)}` : null, policy.publishedAt ? `Son güncelleme: ${fmt(policy.publishedAt)}` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="blog-prose" style={{ marginTop: 20, fontSize: 16 }} dangerouslySetInnerHTML={{ __html: policy.content }} />
      <p className="print:hidden" style={{ marginTop: 28 }}>
        <button type="button" onClick={() => window.print()} style={{ fontSize: 13, textDecoration: "underline", background: "none", border: 0, color: "inherit", cursor: "pointer", padding: 0 }}>
          Yazdır / PDF olarak kaydet
        </button>
      </p>
    </article>
  );
}
