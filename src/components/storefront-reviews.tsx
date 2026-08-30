import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { myProductReviewQuery } from "@/lib/reviews-queries";
import { submitReview } from "@/lib/reviews.functions";
import { formatDateTime } from "@/lib/mefti";

type StorefrontReview = {
  id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified_purchase: boolean;
  reply: string | null;
  created_at: string;
};

type Tokens = {
  accent: string;
  muted: string;
  border: string;
  cardBg: string;
  radius: number;
  headingFont: string;
};

function Stars({ value, color }: { value: number; color: string }) {
  return (
    <span aria-label={`${value} / 5 puan`} style={{ color, letterSpacing: 1 }}>
      {"★".repeat(Math.round(value))}
      <span style={{ opacity: 0.3 }}>{"★".repeat(Math.max(0, 5 - Math.round(value)))}</span>
    </span>
  );
}

export function StorefrontReviews({
  storeSlug,
  productId,
  reviews,
  ratingAverage,
  tokens,
}: {
  storeSlug: string;
  productId: string;
  reviews: StorefrontReview[];
  ratingAverage: number;
  tokens: Tokens;
}) {
  const { accent, muted, border, cardBg, radius, headingFont } = tokens;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const send = useServerFn(submitReview);
  const { data: mine } = useQuery(myProductReviewQuery(productId, user?.id ?? null));

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          storeSlug,
          productId,
          rating,
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(body.trim() ? { body: body.trim() } : {}),
          authorName:
            (user?.user_metadata?.["full_name"] as string | undefined)?.trim() ||
            user?.email?.split("@")[0] ||
            "Müşteri",
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-review", productId] });
      toast.success("Değerlendirmen alındı, onaydan sonra yayınlanacak");
      setTitle("");
      setBody("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    color: "inherit",
    border: `1px solid ${border}`,
    borderRadius: radius,
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "inherit",
  };

  return (
    <section style={{ marginTop: 56, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: headingFont, fontSize: 22, margin: 0 }}>Değerlendirmeler</h2>
        {reviews.length ? (
          <span style={{ fontSize: 14, color: muted }}>
            <Stars value={ratingAverage} color={accent} /> {ratingAverage.toFixed(1)} / 5 ·{" "}
            {reviews.length} yorum
          </span>
        ) : (
          <span style={{ fontSize: 14, color: muted }}>Henüz yorum yok, ilk yorumu sen yaz.</span>
        )}
      </div>

      <div
        style={{
          marginTop: 20,
          display: "grid",
          gap: 24,
          gridTemplateColumns: "minmax(0,1fr) minmax(0,360px)",
        }}
      >
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {reviews.map((review) => (
            <li
              key={review.id}
              style={{
                border: `1px solid ${border}`,
                background: cardBg,
                borderRadius: radius,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong style={{ fontSize: 14 }}>{review.author_name}</strong>
                <Stars value={review.rating} color={accent} />
              </div>
              <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                {formatDateTime(review.created_at)}
                {review.is_verified_purchase ? " · Doğrulanmış satın alma" : ""}
              </div>
              {review.title ? (
                <p style={{ margin: "10px 0 0", fontWeight: 600, fontSize: 15 }}>{review.title}</p>
              ) : null}
              {review.body ? (
                <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, color: muted }}>
                  {review.body}
                </p>
              ) : null}
              {review.reply ? (
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 13,
                    lineHeight: 1.6,
                    borderLeft: `2px solid ${accent}`,
                    paddingLeft: 10,
                  }}
                >
                  <strong>Mağaza yanıtı:</strong> {review.reply}
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        <div
          style={{
            border: `1px solid ${border}`,
            background: cardBg,
            borderRadius: radius,
            padding: 18,
            alignSelf: "start",
          }}
        >
          {!user ? (
            <>
              <p style={{ margin: 0, fontSize: 14 }}>Yorum yazmak için giriş yap.</p>
              <Link
                to="/s/$slug/account"
                params={{ slug: storeSlug }}
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  background: accent,
                  color: "#12181f",
                  borderRadius: radius,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Hesabım
              </Link>
            </>
          ) : mine ? (
            <>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Değerlendirmen kaydedildi</p>
              <div style={{ marginTop: 8 }}>
                <Stars value={mine.rating} color={accent} />
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: muted }}>
                {mine.status === "published"
                  ? "Yorumun yayında."
                  : mine.status === "rejected"
                    ? "Yorumun yayınlanmadı."
                    : "Onay bekliyor."}
              </p>
            </>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate();
              }}
            >
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Bu ürünü değerlendir</p>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} yıldız`}
                    onClick={() => setRating(value)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 22,
                      color: value <= rating ? accent : border,
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
              <input
                style={{ ...inputStyle, marginTop: 12 }}
                placeholder="Başlık (opsiyonel)"
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <textarea
                style={{ ...inputStyle, marginTop: 10, minHeight: 96 }}
                placeholder="Deneyimini paylaş"
                maxLength={2000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              <button
                type="submit"
                disabled={mutation.isPending}
                style={{
                  marginTop: 12,
                  width: "100%",
                  background: accent,
                  color: "#12181f",
                  border: "none",
                  borderRadius: radius,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {mutation.isPending ? "Gönderiliyor…" : "Değerlendirmeyi gönder"}
              </button>
              <p style={{ margin: "10px 0 0", fontSize: 12, color: muted }}>
                Yorumlar mağaza onayından sonra yayınlanır.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
