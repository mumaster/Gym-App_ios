import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../integrations/supabase/client";

export type { Session };

export function onAuthStateChange(cb: (session: Session | null) => void) {
  try {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
    return () => data.subscription.unsubscribe();
  } catch {
    // Supabase isn't configured (e.g. local dev without env vars) — the app
    // stays fully usable offline, just without cloud sync.
    return () => {};
  }
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signUp(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Fetch this user's cloud state, or null if they've never synced before. */
export async function pullCloudState(userId: string): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("user_gym_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.state ?? null;
}

export async function pushCloudState(userId: string, state: unknown): Promise<void> {
  const { error } = await supabase
    .from("user_gym_state")
    .upsert({ user_id: userId, state: state as never, updated_at: new Date().toISOString() });
  if (error) throw error;
}
