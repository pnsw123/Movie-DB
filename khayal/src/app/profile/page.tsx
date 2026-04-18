import { redirect } from "next/navigation";
import { currentProfile, currentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export const metadata = { title: "Profile — KHAYAL" };

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/profile");

  const [profile, sb] = await Promise.all([currentProfile(), supabaseServer()]);

  // Pull a few quick stats for now
  const [{ count: ratingCount }, { count: reviewCount }, { count: listCount }] = await Promise.all([
    sb.from("movie_ratings").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    sb.from("movie_reviews").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    sb.from("user_lists").select("*", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const displayName = profile?.display_name || profile?.username || user.email?.split("@")[0] || "you";

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-start justify-between gap-6 mb-12 pb-10 border-b border-[var(--taupe)]/20">
        <div>
          <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-[var(--saffron)] mb-3">
            Profile · المُشاهِد
          </p>
          <h1 className="font-display text-5xl text-[var(--cream)]">{displayName}</h1>
          {profile?.bio && (
            <p className="mt-3 text-sm text-[var(--cream-muted)] max-w-md">{profile.bio}</p>
          )}
          <p className="mt-2 font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--cream-muted)]">
            {user.email}
          </p>
        </div>
        <SignOutButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: "Ratings", n: ratingCount ?? 0 },
          { label: "Reviews", n: reviewCount ?? 0 },
          { label: "Lists",   n: listCount   ?? 0 },
        ].map((s) => (
          <div key={s.label} className="p-5 rounded-sm bg-[var(--ink-lift)] border border-[var(--taupe)]/15">
            <p className="font-display text-3xl text-[var(--saffron)]">{s.n}</p>
            <p className="mt-1 font-mono text-[11px] tracking-[0.25em] uppercase text-[var(--cream-muted)]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="text-sm text-[var(--cream-muted)]">
        <p>More coming: your watchlists, recent reviews, recommendations.</p>
        <Link href="/browse" className="mt-4 inline-block text-[var(--saffron)] hover:text-[var(--saffron-glow)]">
          ← Back to The Archive
        </Link>
      </div>
    </div>
  );
}
