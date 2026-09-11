import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  locale: string;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  platformRoles: string[];
  isPlatformAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [platformRoles, setPlatformRoles] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const load = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setProfile(null);
      setPlatformRoles([]);
      return;
    }
    const userId = activeSession.user.id;
    const [{ data: existing }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    let resolved = existing;
    if (!resolved) {
      const { data: created } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email: activeSession.user.email ?? null,
          full_name:
            (activeSession.user.user_metadata?.["full_name"] as string | undefined) ??
            (activeSession.user.user_metadata?.["name"] as string | undefined) ??
            null,
          avatar_url:
            (activeSession.user.user_metadata?.["avatar_url"] as string | undefined) ?? null,
        })
        .select("*")
        .maybeSingle();
      resolved = created;
    }

    setProfile((resolved as Profile | null) ?? null);
    setPlatformRoles((roles ?? []).map((row) => row.role as string));
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      void load(nextSession);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await load(data.session);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await load(data.session);
  }, [load]);

  const signOut = useCallback(async () => {
    // Oturum kapanmadan önce denetim kaydı yaz (token hâlâ geçerli).
    try {
      const { logAuthEvent } = await import("./audit.functions");
      await logAuthEvent({ data: { event: "logout" } });
    } catch {
      // Denetim kaydı başarısız olsa da çıkış işlemi devam etmeli.
    }
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setPlatformRoles([]);
  }, []);


  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      platformRoles,
      isPlatformAdmin: platformRoles.includes("platform_admin"),
      refresh,
      signOut,
    }),
    [loading, session, profile, platformRoles, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
