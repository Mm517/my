import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      prevUserIdRef.current = data.session?.user.id ?? null;
      setIsLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const newUserId = newSession?.user.id ?? null;
      if (prevUserIdRef.current !== newUserId) {
        // switched account or signed out — drop all cached queries (messages, me, etc.)
        qc.clear();
      }
      prevUserIdRef.current = newUserId;
      setSession(newSession);
      setIsLoaded(true);
    });

    return () => listener.subscription.unsubscribe();
  }, [qc]);

  const value: AuthContextValue = {
    session,
    isLoaded,
    isSignedIn: !!session,
    async signInWithPassword(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    async signUpWithPassword(email, password, displayName) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) return { error: error.message, needsEmailConfirmation: false };
      // If email confirmation is required, Supabase returns a user with no session yet.
      const needsEmailConfirmation = !data.session;
      return { error: null, needsEmailConfirmation };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    async resetPasswordForEmail(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error: error?.message ?? null };
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
