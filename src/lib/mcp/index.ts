import { auth, defineMcp } from "@lovable.dev/mcp-js";

import listStores from "./tools/list-stores";
import listProducts from "./tools/list-products";
import listOrders from "./tools/list-orders";
import storeSummary from "./tools/store-summary";
import updateProduct from "./tools/update-product";

/** OAuth issuer doğrudan Supabase host'u olmalı; yayınlanmış build proxy URL'ini reddeder. */
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "evo-commerce-suite",
  title: "Evo Commerce Suite",
  version: "0.1.0",
  instructions:
    "Mefticaret mağaza yönetimi araçları. Önce `list_stores` ile mağaza kimliğini al, ardından `list_products`, `list_orders`, `store_summary` ile veri oku; `update_product` ile fiyat veya yayın durumunu güncelle. Tüm araçlar oturum açan kullanıcının yetkili olduğu mağazalarla sınırlıdır.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listStores, listProducts, listOrders, storeSummary, updateProduct],
});
