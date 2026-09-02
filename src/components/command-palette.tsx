import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  ChartNoAxesColumn,
  FileText,
  Package,
  Search,
  ShoppingBag,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchStore } from "@/lib/search.functions";

const QUICK_LINKS = [
  { label: "Panel", path: "dashboard", icon: ChartNoAxesColumn },
  { label: "Ürünler", path: "products", icon: Package },
  { label: "Koleksiyonlar", path: "collections", icon: Boxes },
  { label: "Stok", path: "inventory", icon: Warehouse },
  { label: "Siparişler", path: "orders", icon: ShoppingBag },
  { label: "Müşteriler", path: "customers", icon: Users },
  { label: "Finans", path: "finance", icon: Wallet },
  { label: "İçerik Sayfaları", path: "pages", icon: FileText },
];

const HIT_META = {
  product: { label: "Ürünler", icon: Package },
  order: { label: "Siparişler", icon: ShoppingBag },
  customer: { label: "Müşteriler", icon: Users },
  page: { label: "Sayfalar", icon: FileText },
} as const;

export function CommandPalette({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const trimmed = term.trim();
  const { data: hits, isFetching } = useQuery({
    queryKey: ["store", storeId, "search", trimmed],
    queryFn: () => searchStore({ data: { storeId, term: trimmed } }),
    enabled: open && trimmed.length >= 2,
    staleTime: 10_000,
  });

  function go(path: string) {
    setOpen(false);
    setTerm("");
    void navigate({ to: `/store/${storeId}/${path}` });
  }

  const grouped = (["product", "order", "customer", "page"] as const)
    .map((kind) => ({ kind, rows: (hits ?? []).filter((hit) => hit.kind === kind) }))
    .filter((group) => group.rows.length > 0);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 rounded-lg border border-white/15 bg-white/10 text-sidebar-primary-foreground/70 hover:bg-white/15 hover:text-sidebar-primary-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Ara</span>
        <kbd className="ml-auto hidden rounded border border-white/20 px-1.5 text-[0.65rem] font-medium md:inline">
          CTRL K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={term}
          onValueChange={setTerm}
          placeholder="Ürün, sipariş, müşteri veya sayfa ara..."
        />
        <CommandList>
          <CommandEmpty>
            {trimmed.length < 2
              ? "Aramak için en az 2 karakter yazın."
              : isFetching
                ? "Aranıyor..."
                : "Sonuç bulunamadı."}
          </CommandEmpty>

          {grouped.map((group) => {
            const meta = HIT_META[group.kind];
            return (
              <CommandGroup key={group.kind} heading={meta.label}>
                {group.rows.map((hit) => (
                  <CommandItem
                    key={`${hit.kind}-${hit.id}`}
                    value={`${hit.kind}-${hit.id}-${hit.title}`}
                    onSelect={() =>
                      go(
                        hit.kind === "product"
                          ? `products/${hit.id}`
                          : hit.kind === "order"
                            ? `orders/${hit.id}`
                            : hit.kind === "customer"
                              ? "customers"
                              : "pages",
                      )
                    }
                  >
                    <meta.icon className="mr-2 size-4" />
                    <span className="truncate">{hit.title}</span>
                    {hit.subtitle ? (
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {hit.subtitle}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}

          <CommandGroup heading="Sayfaya git">
            {QUICK_LINKS.map((link) => (
              <CommandItem key={link.path} value={`git-${link.label}`} onSelect={() => go(link.path)}>
                <link.icon className="mr-2 size-4" />
                {link.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
