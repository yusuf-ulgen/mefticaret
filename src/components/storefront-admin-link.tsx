import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * Vitrini yöneten kullanıcıya panel kısayolu gösterir.
 * Yetki kontrolü sunucu tarafında (RLS + panel guard) yapılır; buradaki
 * sorgu yalnızca bağlantının gereksiz görünmesini engeller.
 */
function useManagesStore(storeId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["manages-store", storeId, user?.id],
    enabled: Boolean(user?.id && storeId),
    staleTime: 60_000,
    queryFn: async () => {
      const [ownerRes, memberRes] = await Promise.all([
        supabase.from("stores").select("id").eq("id", storeId).eq("owner_id", user!.id).maybeSingle(),
        supabase
          .from("store_users")
          .select("store_id")
          .eq("store_id", storeId)
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);
      return Boolean(ownerRes.data || memberRes.data);
    },
  });
}

export function StorefrontAdminLink({
  storeId,
  productId,
  border,
  muted,
}: {
  storeId: string;
  productId?: string;
  border: string;
  muted: string;
}) {
  const { data: manages } = useManagesStore(storeId);
  if (!manages) return null;

  const style = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: `1px solid ${border}`,
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 12,
    color: muted,
    textDecoration: "none",
  } as const;

  return productId ? (
    <Link to="/store/$storeId/catalog-v2/$productId" params={{ storeId, productId }} style={style}>
      Panelde düzenle
    </Link>
  ) : (
    <Link to="/store/$storeId/catalog-v2" params={{ storeId }} style={style}>
      Panelde yönet
    </Link>
  );
}
