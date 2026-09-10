import { getPaddleEnvironment } from "@/lib/paddle";

/** Test ortamında ödeme yapıldığını belirten uyarı şeridi. */
export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
      Önizlemede yapılan tüm ödemeler test modundadır.{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline"
      >
        Ayrıntılar
      </a>
    </div>
  );
}
