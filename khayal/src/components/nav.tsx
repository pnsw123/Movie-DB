import Link from "next/link";
import { currentUser, currentProfile } from "@/lib/auth";
import { NavLink } from "./nav-link";
import { TicketEnter, ProfileStub } from "./nav-controls";

/**
 * Index-style nav. Single compact row, no decorative microbar, no bulb
 * strip. A thin saffron hairline under for subtle brand continuity — not
 * a marquee.
 */
export async function Nav() {
  const user = await currentUser();
  const profile = user ? await currentProfile() : null;

  const links = user
    ? [
        { href: "/browse",   label: "Archive"  },
        { href: "/search",   label: "Search"   },
        { href: "/profile",  label: "Profile"  },
      ]
    : [
        { href: "/browse",   label: "Archive"  },
        { href: "/search",   label: "Search"   },
      ];

  const initial =
    (profile?.display_name || profile?.username || user?.email || "?")
      .charAt(0)
      .toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-[var(--ink)]/85 backdrop-blur-md border-b border-[var(--taupe)]/15">
      <div className="mx-auto max-w-[1600px] px-6 h-16 flex items-center justify-between gap-6">
        <Link href="/browse" className="group flex items-baseline gap-3">
          <span className="font-arabic text-2xl leading-none text-[var(--saffron)] group-hover:text-[var(--saffron-glow)] transition-colors">
            خيال
          </span>
          <span className="h-5 w-px bg-[var(--taupe)]/40 self-center" />
          <span className="font-display text-[1.3rem] leading-none tracking-[0.06em] text-[var(--cream)] group-hover:text-[var(--saffron-glow)] transition-colors">
            KHAYAL
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <nav className="hidden md:flex items-center">
            {links.map((l) => <NavLink key={l.href} href={l.href} label={l.label} />)}
          </nav>

          {user ? (
            <ProfileStub initial={initial} />
          ) : (
            <TicketEnter className="ml-3" />
          )}
        </div>
      </div>
    </header>
  );
}
