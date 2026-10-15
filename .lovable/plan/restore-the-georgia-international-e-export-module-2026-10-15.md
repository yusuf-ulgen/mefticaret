# Restore the Georgia / international e-export module

The Oct 12 module was overwritten by an older bugfix branch. Restore it on top of the current code without undoing the newer fixes.

## What returns
- Language (TR/EN/KA) and currency (TRY/GEL/USD) picker in all storefront themes, with live price conversion on the product, cart and checkout pages.
- Georgian (`ka`) back in the store language list.
- Yellow 300 GEL customs notice in the cart drawer, cart page and order summary.
- Checkout: country selector (Türkiye, Gürcistan, "Diğer ülke…" with free text that does not snap back to Georgia while typing), Georgia city list, required passport/ID number.
- Server: 0% VAT plus the "ETGB İhracat Faturası" tag for Georgia physical orders, rejects bank transfer and cash on delivery for Georgia orders, and saves the exchange rate at order time.
- Keep the later fix: a stale bank-transfer choice is cleared when the country switches to Georgia.

## Technical
- Recover `src/lib/export-ge.ts`, `live-fx.server.ts`, `display-currency.functions.ts`, `display-currency.tsx` from commit 2ea59cc2 via `git show` (read-only).
- Re-apply the diffs to `storefront-chrome.tsx`, the formatMoney imports, `languages.ts`, `checkout.server.ts` (schema customsId, exportInvoice, tax, guard, quote fields), `s.$slug.checkout.tsx`, `s.$slug.cart.tsx` and `wokiee/cart-drawer.tsx`. Merge these by hand against the current files.
- Country match uses an exact match on the full value only, so typing "Ge" in the free-text box does not trigger Georgia.
- Verify with a typecheck and a Playwright run: GEL switch, Georgia checkout, ID required.
