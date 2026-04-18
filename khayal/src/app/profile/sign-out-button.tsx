"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          await supabaseBrowser().auth.signOut();
          router.push("/browse");
          router.refresh();
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-2 h-9 px-4 rounded-sm text-xs tracking-wide uppercase font-mono
        border border-[var(--taupe)]/25 text-[var(--cream-muted)]
        hover:text-[var(--cream)] hover:border-[var(--saffron)]/50 transition-colors
        disabled:opacity-50"
    >
      <LogOut size={12} />
      Sign out
    </button>
  );
}
