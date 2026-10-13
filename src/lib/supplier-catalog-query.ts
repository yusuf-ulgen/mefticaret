import { queryOptions } from "@tanstack/react-query";
import type { supplierSearchCatalog } from "@/lib/supplier-workflow.functions";

export type SupplierCatalogFilter = "all" | "visible" | "hidden" | "out";
type CatalogInput = {
  supplierId: string;
  search: string;
  page: number;
  category: string;
  sort: "recent" | "price" | "stock";
  filter: SupplierCatalogFilter;
};
type CatalogSearch = (options: {
  data: CatalogInput;
}) => Promise<Awaited<ReturnType<typeof supplierSearchCatalog>>>;
export function supplierCatalogQuery(
  search: CatalogSearch,
  input: {
    supplierId: string;
    search: string;
    page: number;
    category?: string;
    sort?: "recent" | "price" | "stock";
    filter?: SupplierCatalogFilter;
  },
) {
  const data = { category: "", sort: "recent" as const, filter: "all" as const, ...input };
  return queryOptions({
    queryKey: ["supplier-catalog-search", data],
    enabled: Boolean(data.supplierId),
    queryFn: () => search({ data }),
    staleTime: 30_000,
  });
}
