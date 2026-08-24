import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

/**
 * Supabase auth context.
 *
 * Deliberately mirrors the shape of FirebaseContext (`user`, `loading`,
 * `signInWithGoogle`, `logout`) so pages can switch over without touching
 * their own logic.
 *
 * The profile row is created by the `on_auth_user_created` trigger in
 * supabase/migrations, not from the client — a client-side profile write
 * would be an opportunity to set columns the user should not control.
 */

interface SupabaseAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  logout: async () => {},
});

export const useSupabaseAuth = () => useContext(SupabaseAuthContext);

export const SupabaseAuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;

  // Admin status is read from the `admins` table, which RLS makes readable
  // only for your own row and writable by no client at all. It is never taken
  // from a profile column the user could edit.
  useEffect(() => {
    if (!supabase || !user) {
      setIsAdmin(false);
      return;
    }
    let active = true;
    supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsAdmin(Boolean(data));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const value = useMemo<SupabaseAuthContextType>(
    () => ({
      user,
      session,
      loading,
      isAdmin,
      signInWithGoogle: async () => {
        if (!supabase) {
          toast({ title: "Sign-in unavailable", variant: "destructive" });
          return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) {
          toast({ title: "Sign-in failed", description: error.message, variant: "destructive" });
        }
      },
      signInWithEmail: async (email: string, password: string) => {
        if (!supabase) {
          toast({ title: "Sign-in unavailable", variant: "destructive" });
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Deliberately generic: distinguishing "no such user" from "wrong
          // password" tells an attacker which emails are registered.
          toast({ title: "Sign-in failed", description: "Check your email and password.", variant: "destructive" });
        }
      },
      logout: async () => {
        await supabase?.auth.signOut();
        setIsAdmin(false);
      },
    }),
    [user, session, loading, isAdmin, toast]
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
};

export { supabaseConfigured };
