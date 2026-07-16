import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { actualizarMiNombre } from "./db";

export type Role = "contador" | "propietario" | "conductor";

export interface Profile {
  id: string;
  role: Role;
  nombre: string;
}

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (nombre: string, email: string, password: string, role: Role) => Promise<{ needsEmail: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateNombre: (nombre: string) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga el profile del usuario actual (rol + nombre).
  const loadProfile = async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("id, role, nombre").eq("id", uid).single();
    setProfile((data as Profile) ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      await loadProfile(s?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp: AuthState["signUp"] = async (nombre, email, password, role) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre, role } }, // lo lee el trigger handle_new_user
    });
    if (error) throw error;
    // Si el proyecto exige confirmación de correo, no hay sesión todavía.
    return { needsEmail: !data.session };
  };

  const signIn: AuthState["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  // Renombrar al usuario actual: persiste y refresca el profile en memoria para
  // que la barra superior se actualice sin recargar.
  const updateNombre: AuthState["updateNombre"] = async (nombre) => {
    await actualizarMiNombre(nombre);
    setProfile((p) => (p ? { ...p, nombre } : p));
  };

  return (
    <Ctx.Provider value={{ session, profile, loading, signUp, signIn, signOut, updateNombre }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}

export const ROLE_LABEL: Record<Role, string> = {
  contador: "Contador",
  propietario: "Dueño de flota",
  conductor: "Conductor",
};
