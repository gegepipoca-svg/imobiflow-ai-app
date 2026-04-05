import { createContext, useEffect, useState, useCallback } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AppRole = "admin" | "consultor";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  participant_id?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isConsultor: boolean;
  participantId: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, userEmail?: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Erro ao buscar perfil:", error);
      setProfile(null);
      return;
    }

    // Map DB fields to Profile interface
    const dbProfile = data as Record<string, unknown>;
    const email = (dbProfile.email as string) || userEmail || "";
    const role = (dbProfile.role as AppRole) || "consultor";

    // For consultors, try to find their participant_id by email match
    let linkedParticipantId = (dbProfile.participant_id as string) || null;

    if (role === "consultor" && !linkedParticipantId && email) {
      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("email", email)
        .eq("is_active", true)
        .single();

      if (participant) {
        linkedParticipantId = participant.id;
      }
    }

    setProfile({
      id: dbProfile.id as string,
      full_name: (dbProfile.full_name as string) || "Usuário",
      email,
      role,
      participant_id: linkedParticipantId,
      avatar_url: (dbProfile.avatar_url as string) || null,
      created_at: dbProfile.created_at as string,
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id, currentSession.user.email);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        fetchProfile(newSession.user.id, newSession.user.email);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const isAdmin = profile?.role === "admin";
  const isConsultor = profile?.role === "consultor";
  const participantId = profile?.participant_id ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signOut,
        isAdmin,
        isConsultor,
        participantId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
