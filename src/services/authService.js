import { supabase } from "./supabaseClient.js";

export async function getAuthSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Erro ao verificar sessão do Supabase:", error);
    return null;
  }

  return data.session ?? null;
}

export async function getCurrentAuthUser() {
  const session = await getAuthSession();

  return session?.user ?? null;
}

export async function signInWithEmailPassword(email, password) {
  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signOutAuth() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Erro ao sair do Supabase:", error);
  }

  return { error };
}

export function onAuthSessionChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ?? null);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
