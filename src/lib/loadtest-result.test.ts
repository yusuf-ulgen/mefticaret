import { describe, expect, it } from "vitest";
import { integrityResult, thresholdResult, loadTestScope } from "./loadtest-result";

describe("test kanıtı", () => {
  it("does not turn historic totals or VU targets into capacity evidence", () => {
    expect(loadTestScope({ vusers: 20000, requests: 40000 })).toContain("kanıtı yok");
    expect(loadTestScope({ testKind: "sequential_http_sampling" })).toContain(
      "Core Web Vitals ölçülmedi",
    );
  });
  it.each(["running", "failed", "stopped"])("%s koşuyu başarılı saymaz", (status) => {
    expect(thresholdResult(status, [])).toBe("Değerlendirilemedi");
  });
  it("eksik sonuç ile sıfır başarısızlığı ayırır", () => {
    expect(thresholdResult("completed", undefined)).toBe("Eşik ölçümü yok");
    expect(thresholdResult("completed", 0)).toBe("Eşikler tamam");
    expect(thresholdResult("completed", [])).toBe("Eşikler tamam");
    expect(thresholdResult("completed_with_findings", ["gecikme", "hata"])).toBe(
      "2 başarısız eşik",
    );
  });
  it("veri veya tamamlanmış kontrol yokken mutabakat iddiası üretmez", () => {
    expect(integrityResult(undefined, undefined)).toContain("doğrulanmadı");
    expect(integrityResult("failed", { commissionsChecked: 10, findings: 0 })).toContain(
      "doğrulanmadı",
    );
    expect(integrityResult("completed", { commissionsChecked: 0, findings: 0 })).toContain(
      "bulunmadı",
    );
  });
});
