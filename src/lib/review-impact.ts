/** Değerlendirme etkisi: puan bantlarına göre satış, iade ve içerik açığı analizi. */

export type ReviewInput = {
  productId: string;
  rating: number;
  status: string;
  createdAt: string;
};

export type ReviewSaleInput = {
  productId: string | null;
  quantity: number;
  lineTotal: number;
};

export type ReviewReturnInput = {
  productId: string | null;
  quantity: number;
};

export type ReviewProductInput = {
  id: string;
  title: string;
};

export type RatingBand = "none" | "low" | "mid" | "high";

export const RATING_BAND_LABELS: Record<RatingBand, string> = {
  none: "Yorumsuz",
  low: "1–2,9 puan",
  mid: "3–3,9 puan",
  high: "4+ puan",
};

export type ReviewImpactRow = {
  productId: string;
  title: string;
  reviews: number;
  published: number;
  pending: number;
  avgRating: number | null;
  band: RatingBand;
  units: number;
  revenue: number;
  returnedUnits: number;
  returnRate: number;
  revenuePerReview: number | null;
};

export type ReviewImpactAnalysis = {
  rows: ReviewImpactRow[];
  bands: Array<{
    band: RatingBand;
    label: string;
    products: number;
    units: number;
    revenue: number;
    avgRevenuePerProduct: number;
    returnRate: number;
  }>;
  summary: {
    reviews: number;
    pending: number;
    avgRating: number | null;
    coverage: number;
    noReviewRevenue: number;
    lowRatedProducts: number;
  };
};

function bandOf(avg: number | null): RatingBand {
  if (avg === null) return "none";
  if (avg >= 4) return "high";
  if (avg >= 3) return "mid";
  return "low";
}

export function analyzeReviewImpact(
  products: ReviewProductInput[],
  reviews: ReviewInput[],
  sales: ReviewSaleInput[],
  returns: ReviewReturnInput[],
): ReviewImpactAnalysis {
  const reviewStats = new Map<
    string,
    { count: number; published: number; pending: number; ratingSum: number; rated: number }
  >();
  for (const review of reviews) {
    let entry = reviewStats.get(review.productId);
    if (!entry) {
      entry = { count: 0, published: 0, pending: 0, ratingSum: 0, rated: 0 };
      reviewStats.set(review.productId, entry);
    }
    entry.count += 1;
    if (review.status === "published") entry.published += 1;
    if (review.status === "pending") entry.pending += 1;
    if (review.rating > 0) {
      entry.ratingSum += review.rating;
      entry.rated += 1;
    }
  }

  const saleStats = new Map<string, { units: number; revenue: number }>();
  for (const sale of sales) {
    if (!sale.productId) continue;
    const entry = saleStats.get(sale.productId) ?? { units: 0, revenue: 0 };
    entry.units += Math.max(0, sale.quantity);
    entry.revenue += sale.lineTotal;
    saleStats.set(sale.productId, entry);
  }

  const returnStats = new Map<string, number>();
  for (const item of returns) {
    if (!item.productId) continue;
    returnStats.set(item.productId, (returnStats.get(item.productId) ?? 0) + Math.max(0, item.quantity));
  }

  const rows: ReviewImpactRow[] = products.map((product) => {
    const stat = reviewStats.get(product.id);
    const sale = saleStats.get(product.id) ?? { units: 0, revenue: 0 };
    const returnedUnits = returnStats.get(product.id) ?? 0;
    const avgRating = stat && stat.rated > 0 ? stat.ratingSum / stat.rated : null;

    return {
      productId: product.id,
      title: product.title,
      reviews: stat?.count ?? 0,
      published: stat?.published ?? 0,
      pending: stat?.pending ?? 0,
      avgRating,
      band: bandOf(avgRating),
      units: sale.units,
      revenue: sale.revenue,
      returnedUnits,
      returnRate: sale.units > 0 ? returnedUnits / sale.units : 0,
      revenuePerReview: stat && stat.count > 0 ? sale.revenue / stat.count : null,
    };
  });

  rows.sort((a, b) => b.revenue - a.revenue || b.reviews - a.reviews);

  const bandOrder: RatingBand[] = ["high", "mid", "low", "none"];
  const bands = bandOrder
    .map((band) => {
      const bucket = rows.filter((row) => row.band === band);
      const units = bucket.reduce((sum, row) => sum + row.units, 0);
      const returned = bucket.reduce((sum, row) => sum + row.returnedUnits, 0);
      const revenue = bucket.reduce((sum, row) => sum + row.revenue, 0);
      return {
        band,
        label: RATING_BAND_LABELS[band],
        products: bucket.length,
        units,
        revenue,
        avgRevenuePerProduct: bucket.length ? revenue / bucket.length : 0,
        returnRate: units > 0 ? returned / units : 0,
      };
    })
    .filter((entry) => entry.products > 0);

  const rated = rows.filter((row) => row.avgRating !== null);

  return {
    rows,
    bands,
    summary: {
      reviews: reviews.length,
      pending: reviews.filter((review) => review.status === "pending").length,
      avgRating: rated.length
        ? rated.reduce((sum, row) => sum + (row.avgRating ?? 0), 0) / rated.length
        : null,
      coverage: rows.length ? rows.filter((row) => row.reviews > 0).length / rows.length : 0,
      noReviewRevenue: rows
        .filter((row) => row.reviews === 0)
        .reduce((sum, row) => sum + row.revenue, 0),
      lowRatedProducts: rows.filter((row) => row.band === "low").length,
    },
  };
}
