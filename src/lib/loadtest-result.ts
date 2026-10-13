export function loadTestScope(metrics: Record<string, unknown>): string {
  if (metrics["testKind"] !== "sequential_http_sampling")
    return "Senaryo kanıtı yok; eşzamanlı kapasite sonucu çıkarılamaz.";
  return "Sıralı HTTP örnekleme (eşzamanlılık: 1) ve test siparişi simülasyonu. Gerçek banka ödemesi, tarayıcı açılışı ve Core Web Vitals ölçülmedi.";
}

export function thresholdResult(status: string, failures: unknown): string {
  if (!status.startsWith("completed")) return "Değerlendirilemedi";
  const count = Array.isArray(failures)
    ? failures.length
    : typeof failures === "number" && Number.isInteger(failures) && failures >= 0
      ? failures
      : null;
  if (count === null) return "Eşik ölçümü yok";
  return count === 0 ? "Eşikler tamam" : `${count} başarısız eşik`;
}

export function integrityResult(status: string | undefined, integrity: unknown): string {
  if (!status?.startsWith("completed") || !integrity || typeof integrity !== "object")
    return "Mutabakat henüz doğrulanmadı.";
  const data = integrity as Record<string, unknown>;
  if (typeof data["commissionsChecked"] !== "number" || data["commissionsChecked"] === 0)
    return "Kontrol edilecek komisyon kaydı bulunmadı.";
  if (data["findings"] !== 0) return "Mutabakat bulguları incelenmeli.";
  return `${data["commissionsChecked"]} komisyon kaydı kontrol edildi; bu kontrol kapsamında bulgu yok.`;
}
