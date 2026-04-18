"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Globe, Trash2, LoaderCircle } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function ListActions({
  listId, isFavorites, isPublic,
}: { listId: number; isFavorites: boolean; isPublic: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const togglePublic = () => {
    start(async () => {
      const sb = supabaseBrowser();
      await sb.from("user_lists").update({ is_public: !isPublic }).eq("id", listId);
      router.refresh();
    });
  };

  const remove = () => {
    if (isFavorites) { alert("Favorites list can't be deleted."); return; }
    if (!confirm("Delete this list? Items will be unlinked, not deleted.")) return;
    start(async () => {
      const sb = supabaseBrowser();
      await sb.from("user_lists").delete().eq("id", listId);
      router.push("/profile");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2 pb-2">
      <button
        onClick={togglePublic}
        disabled={pending}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-sm text-xs tracking-wider uppercase font-mono border border-[var(--taupe)]/25 text-[var(--cream-muted)] hover:text-[var(--cream)] hover:border-[var(--saffron)]/50 disabled:opacity-50"
      >
        {isPublic ? <><Globe size={12} /> Public</> : <><Lock size={12} /> Private</>}
        {pending && <LoaderCircle size={11} className="animate-spin" />}
      </button>
      {!isFavorites && (
        <button
          onClick={remove}
          disabled={pending}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-sm text-xs tracking-wider uppercase font-mono border border-[var(--taupe)]/25 text-[var(--cream-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]/50 disabled:opacity-50"
        >
          <Trash2 size={11} /> Delete
        </button>
      )}
    </div>
  );
}
