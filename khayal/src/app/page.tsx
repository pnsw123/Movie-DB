import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { getLandingData } from "@/lib/landing";
import { HeroSection } from "@/components/landing/hero-section";
import { PosterWall } from "@/components/landing/poster-wall";
import { NumbersSection } from "@/components/landing/numbers-section";
import { CtaReveal } from "@/components/landing/cta-reveal";
import { AuthHashHandler } from "@/components/auth-hash-handler";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>;
}) {
  // Supabase email-confirmation / OAuth links sometimes redirect to the Site
  // URL root (`/`) with the auth `?code=` attached instead of `/auth/callback`
  // (e.g. when /auth/callback is not in the project's allowed Redirect URLs).
  // Forward it to the callback handler so the session is actually exchanged —
  // otherwise the user lands back on the homepage still logged out.
  const sp = await searchParams;
  if (sp.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(sp.code)}`);
  }
  if (sp.error) {
    redirect(`/login?error=${encodeURIComponent(sp.error_description ?? sp.error)}`);
  }

  const sb = await supabaseServer();
  const { posters, counts, backdrop } = await getLandingData(sb);

  return (
    <main>
      {/* Completes the Supabase implicit email-confirmation flow when the
          verify redirect lands on `/#access_token=…` instead of /auth/callback. */}
      <AuthHashHandler />

      {/* Section 1 — Hero (above the fold, animates on load) */}
      <HeroSection />

      {/* Section 2 — Parallax poster wall */}
      <PosterWall posters={posters} />

      {/* Section 3 — Numbers, stagger in + count up once */}
      <NumbersSection counts={counts} />

      {/* Section 4 — CTA over a film still that un-curtains on scroll */}
      <CtaReveal backdrop={backdrop} counts={counts} />
    </main>
  );
}
