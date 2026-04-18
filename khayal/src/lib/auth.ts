import { supabaseServer } from "./supabase-server";

/** Returns the current user or null. SSR-safe. */
export async function currentUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

/** Returns the current user's profile row (joined from user). */
export async function currentProfile() {
  const user = await currentUser();
  if (!user) return null;
  const sb = await supabaseServer();
  const { data } = await sb
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio")
    .eq("id", user.id)
    .maybeSingle();
  return data;
}
