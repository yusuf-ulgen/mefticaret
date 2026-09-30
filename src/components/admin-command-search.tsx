import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Receipt, Search, Store, User } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adminGlobalSearch } from "@/lib/admin-insights.functions";
import { filterAdminNav } from "@/lib/admin-nav";
import { formatMoney } from "@/lib/mefti";

/** Süper admin genel arama (Ctrl/⌘+K): menü, mağaza, kullanıcı ve sipariş. */
export function AdminCommandSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();
  const search = useServerFn(adminGlobalSearch);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  const results = useQuery({
    queryKey: ["admin-global-search", debounced],
    enabled: open && debounced.length >= 2,
    queryFn: () => search({ data: { term: debounced } }),
  });

  const pages = term.trim() ? filterAdminNav(term).flatMap((g) => g.items).slice(0, 6) : [];

  const go = (fn: () => void) => {
    setOpen(false);
    setTerm("");
    fn();
  };

  const data = results.data;
  const empty =
    debounced.length >= 2 && !results.isFetching && pages.length === 0 &&
    !data?.stores.length && !data?.users.length && !data?.orders.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden min-w-0 flex-1 items-center gap-2 rounded-full bg-background/12 px-3.5 py-2 text-left text-xs text-background/70 transition hover:bg-background/20 sm:flex lg:max-w-md"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="truncate">Mağaza, kullanıcı, sipariş veya sayfa ara</span>
        <kbd className="ml-auto rounded border border-background/25 px-1.5 text-[10px]">Ctrl K</kbd>
      </button>
      <button
        type="button"
        aria-label="Ara"
        onClick={() => setOpen(true)}
        className="grid size-8 place-items-center rounded-full bg-background/12 sm:hidden"
      >
        <Search className="size-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-0 p-0">
          <DialogTitle className="sr-only">Genel arama</DialogTitle>
          <div className="relative border-b border-border p-3">
            <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="En az 2 harf yazın…"
              className="pl-9"
              aria-label="Genel arama"
            />
            {results.isFetching ? (
              <Loader2 className="absolute right-6 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto p-3">
            {pages.length ? (
              <Group title="Sayfalar">
                {pages.map((item) => (
                  <Row key={item.to} icon={<item.icon />} title={item.label} sub={item.hint} onClick={() => go(() => navigate({ to: item.to }))} />
                ))}
              </Group>
            ) : null}
            {data?.stores.length ? (
              <Group title="Mağazalar">
                {data.stores.map((s) => (
                  <Row key={s.id} icon={<Store />} title={s.name} sub={`${s.slug} · ${s.status}`}
                    onClick={() => go(() => navigate({ to: "/admin/store/$storeId", params: { storeId: s.id } }))} />
                ))}
              </Group>
            ) : null}
            {data?.users.length ? (
              <Group title="Kullanıcılar">
                {data.users.map((u) => (
                  <Row key={u.id} icon={<User />} title={u.full_name || u.email || "İsimsiz"} sub={u.email ?? undefined}
                    onClick={() => go(() => navigate({ to: "/admin/user/$userId", params: { userId: u.id } }))} />
                ))}
              </Group>
            ) : null}
            {data?.orders.length ? (
              <Group title="Siparişler">
                {data.orders.map((o) => (
                  <Row key={o.id} icon={<Receipt />} title={`#${o.order_number}`} sub={`${o.customer_email ?? "—"} · ${formatMoney(o.grand_total)}`}
                    onClick={() => go(() => navigate({ to: "/admin/store/$storeId", params: { storeId: o.store_id } }))} />
                ))}
              </Group>
            ) : null}
            {results.isError ? <p className="px-2 py-4 text-sm text-destructive">Arama yapılamadı, tekrar deneyin.</p> : null}
            {empty ? <p className="px-2 py-6 text-center text-sm text-muted-foreground">Sonuç bulunamadı.</p> : null}
            {!term.trim() ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Mağaza adı, e-posta, telefon, sipariş numarası veya sayfa adı yazın.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{title}</p>
      <ul>{children}</ul>
    </section>
  );
}

function Row({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub?: string | undefined; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted">
        <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          {sub ? <span className="block truncate text-xs text-muted-foreground">{sub}</span> : null}
        </span>
      </button>
    </li>
  );
}
