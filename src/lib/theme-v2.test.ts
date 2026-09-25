import { describe, expect, it } from "vitest";

import { blockSettings, historyInit, historyPush, historyRedo, historyUndo, HISTORY_LIMIT, presetToPages, stripDangerousHtml } from "./theme-v2";

describe("theme-v2", () => {
  it("normalizes settings to defaults and drops unknown keys", () => {
    const s = blockSettings("heading", { text: "Merhaba", evil: "x" });
    expect(s["text"]).toBe("Merhaba");
    expect("evil" in s).toBe(false);
  });

  it("strips scripts and event handlers", () => {
    const out = stripDangerousHtml('<p onclick="x()">a</p><script>alert(1)</script><a href="javascript:x">b</a>');
    expect(out).not.toMatch(/script|onclick|javascript:/i);
  });

  it("history undo/redo with limit", () => {
    let h = historyInit(0);
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) h = historyPush(h, i);
    expect(h.past.length).toBe(HISTORY_LIMIT);
    h = historyUndo(h);
    expect(h.present).toBe(HISTORY_LIMIT + 4);
    h = historyRedo(h);
    expect(h.present).toBe(HISTORY_LIMIT + 5);
  });

  it("converts preset structures with fresh ids", () => {
    let n = 0;
    const r = presetToPages({ settings: {}, pages: { home: [{ type: "hero", blocks: [{ type: "heading" }] }] } }, () => `id${n++}`);
    expect(r.pages["home"]?.[0]?.type).toBe("hero");
    expect(r.pages["home"]?.[0]?.blocks[0]?.id).toMatch(/^id/);
  });
});
