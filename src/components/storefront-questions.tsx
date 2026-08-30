import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { myProductQuestionsQuery, productQuestionsQuery } from "@/lib/questions-queries";
import { submitQuestion } from "@/lib/questions.functions";
import { formatDateTime } from "@/lib/mefti";

type Tokens = {
  accent: string;
  muted: string;
  border: string;
  cardBg: string;
  radius: string | number;
  headingFont: string;
};

const STATUS_TEXT: Record<string, string> = {
  pending: "Onay bekliyor",
  published: "Yayında",
  rejected: "Yayınlanmadı",
};

export function StorefrontQuestions({
  storeSlug,
  productId,
  tokens,
}: {
  storeSlug: string;
  productId: string;
  tokens: Tokens;
}) {
  const { accent, muted, border, cardBg, radius, headingFont } = tokens;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const send = useServerFn(submitQuestion);
  const { data: questions } = useQuery(productQuestionsQuery(productId));
  const { data: mine } = useQuery(myProductQuestionsQuery(productId, user?.id ?? null));

  const [question, setQuestion] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          storeSlug,
          productId,
          question: question.trim(),
          authorName:
            (user?.user_metadata?.["full_name"] as string | undefined)?.trim() ||
            user?.email?.split("@")[0] ||
            "Müşteri",
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-questions", productId] });
      toast.success("Sorun alındı, mağaza yanıtlayınca yayınlanacak");
      setQuestion("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const list = questions ?? [];

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
        <h2 style={{ fontFamily: headingFont, fontSize: 22, margin: 0 }}>Soru &amp; Cevap</h2>
        <span style={{ fontSize: 14, color: muted }}>
          {list.length
            ? `${list.length} yanıtlanmış soru`
            : "Henüz soru yok, ilk soruyu sen sor."}
        </span>
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
          {list.map((item) => (
            <li
              key={item.id}
              style={{
                border: `1px solid ${border}`,
                background: cardBg,
                borderRadius: radius,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong style={{ fontSize: 14 }}>{item.author_name}</strong>
                <span style={{ fontSize: 12, color: muted }}>
                  {formatDateTime(item.created_at)}
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, fontWeight: 600 }}>
                {item.question}
              </p>
              {item.answer ? (
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 13,
                    lineHeight: 1.6,
                    borderLeft: `2px solid ${accent}`,
                    paddingLeft: 10,
                  }}
                >
                  <strong>Mağaza yanıtı:</strong> {item.answer}
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
              <p style={{ margin: 0, fontSize: 14 }}>Soru sormak için giriş yap.</p>
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
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (question.trim().length < 5) {
                    toast.error("Sorun en az 5 karakter olmalı");
                    return;
                  }
                  mutation.mutate();
                }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Bu ürün hakkında soru sor</p>
                <textarea
                  style={{ ...inputStyle, marginTop: 12, minHeight: 88 }}
                  placeholder="Örn. Bu ürün makinede yıkanabilir mi?"
                  maxLength={1000}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
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
                  {mutation.isPending ? "Gönderiliyor…" : "Soruyu gönder"}
                </button>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: muted }}>
                  Sorular mağaza yanıtından sonra yayınlanır.
                </p>
              </form>

              {mine && mine.length ? (
                <div style={{ marginTop: 18, borderTop: `1px solid ${border}`, paddingTop: 14 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Soruların</p>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "10px 0 0",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    {mine.map((item) => (
                      <li key={item.id} style={{ fontSize: 13 }}>
                        <p style={{ margin: 0, lineHeight: 1.5 }}>{item.question}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: muted }}>
                          {STATUS_TEXT[item.status] ?? item.status}
                          {item.answer ? ` · Yanıt: ${item.answer}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
