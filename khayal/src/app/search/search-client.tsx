"use client";

import { useState, useTransition } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { MovieCard } from "@/components/movie-card";
import { cn } from "@/lib/utils";
import { Search, Play, LoaderCircle, Table2 } from "lucide-react";

type Tab = "find" | "sql";
type SavedQuery = { id: number; title: string; query_text: string };

interface SearchAllRow {
  id: number; type: "movie" | "tv"; title: string; slug: string;
  overview: string | null; poster_url: string | null; release_year: number | null; relevance: number;
}

export function SearchClient({ defaultQueries }: { defaultQueries: SavedQuery[] }) {
  const [tab, setTab] = useState<Tab>("find");
  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--taupe)]/15 mb-8">
        <TabBtn active={tab === "find"} onClick={() => setTab("find")} icon={<Search size={14} />} label="Find" />
        <TabBtn active={tab === "sql"}  onClick={() => setTab("sql")}  icon={<Table2 size={14} />} label="SQL" />
      </div>

      {tab === "find" ? <FindTab /> : <SqlTab defaultQueries={defaultQueries} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-2 px-5 py-3 text-sm tracking-wide transition-colors",
        active ? "text-[var(--saffron)]" : "text-[var(--cream-muted)] hover:text-[var(--cream)]"
      )}
    >
      {icon} {label}
      {active && <span className="absolute left-3 right-3 -bottom-[1px] h-[2px] bg-[var(--saffron)] shadow-[0_0_12px_var(--saffron)]" />}
    </button>
  );
}

// ─── Normal full-text search tab ──────────────────────────────────────────

function FindTab() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchAllRow[]>([]);
  const [pending, start] = useTransition();
  const [touched, setTouched] = useState(false);

  const run = (text: string) => {
    setTouched(true);
    if (!text.trim()) { setRows([]); return; }
    start(async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.rpc("search_all", { query_text: text, page_size: 30 });
      setRows((data ?? []) as SearchAllRow[]);
    });
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="relative mb-10">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--cream-muted)]" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Title, phrase, idea…"
          className="w-full h-14 pl-12 pr-28 rounded-sm text-base bg-[var(--ink-lift)] border border-[var(--taupe)]/25 text-[var(--cream)] placeholder:text-[var(--cream-muted)]/60 focus:outline-none focus:border-[var(--saffron)]/60"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-4 rounded-sm bg-[var(--saffron)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--saffron-glow)] inline-flex items-center gap-2"
        >
          {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />} Search
        </button>
      </form>

      {!touched && (
        <p className="text-sm text-[var(--cream-muted)]">
          Full-text search across 3,400+ films and 1,000+ TV series. Matches across titles and overviews,
          ranked by relevance.
        </p>
      )}

      {touched && rows.length === 0 && !pending && (
        <div className="py-16 text-center">
          <p className="font-arabic text-3xl text-[var(--saffron)]/70 mb-3">لا خيال هنا</p>
          <p className="font-display italic text-xl text-[var(--cream)]">No such fantasy.</p>
          <p className="mt-2 text-sm text-[var(--cream-muted)]">Try a different title or phrase.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-8">
          {rows.map((r) => (
            <MovieCard
              key={`${r.type}-${r.id}`}
              title={r.title}
              year={r.release_year ? String(r.release_year) : null}
              posterUrl={r.poster_url}
              href={r.type === "movie" ? `/movies/${r.slug}` : `/tv/${r.slug}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SQL explorer tab ─────────────────────────────────────────────────────

function SqlTab({ defaultQueries }: { defaultQueries: SavedQuery[] }) {
  const [sql, setSql] = useState(defaultQueries[0]?.query_text || "select title, release_date from movies order by release_date desc limit 10");
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr]   = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    setErr(null);
    start(async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb.rpc("run_query", { query_text: sql });
      if (error) { setErr(error.message); setRows([]); return; }
      setRows(Array.isArray(data) ? data : []);
    });
  };

  const cols = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-6">
      {/* Sidebar: default queries */}
      <aside>
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[var(--cream-muted)] mb-3">
          Default queries
        </p>
        <ul className="space-y-1">
          {defaultQueries.map((q) => (
            <li key={q.id}>
              <button
                onClick={() => setSql(q.query_text)}
                className="text-left w-full px-3 py-2 text-sm rounded-sm border border-transparent text-[var(--cream-muted)] hover:text-[var(--cream)] hover:bg-[var(--ink-lift)] hover:border-[var(--taupe)]/25 transition-colors"
              >
                {q.title}
              </button>
            </li>
          ))}
          {defaultQueries.length === 0 && (
            <li className="text-xs text-[var(--cream-muted)] px-3 py-2">None seeded.</li>
          )}
        </ul>
      </aside>

      {/* Editor + results */}
      <div>
        <div className="relative mb-3">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            className="w-full h-44 p-4 rounded-sm font-mono text-sm bg-[var(--ink-lift)] border border-[var(--taupe)]/25 text-[var(--cream)] focus:outline-none focus:border-[var(--saffron)]/60 resize-y"
          />
          <button
            onClick={run}
            className="absolute bottom-3 right-3 h-9 px-4 rounded-sm bg-[var(--saffron)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--saffron-glow)] inline-flex items-center gap-2"
          >
            {pending ? <LoaderCircle size={13} className="animate-spin" /> : <Play size={13} />} Run
          </button>
        </div>

        <p className="text-[11px] font-mono text-[var(--cream-muted)] mb-4">
          Read-only SQL. Only SELECT statements are accepted.
        </p>

        {err && (
          <div className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-sm px-3 py-2 mb-4">
            {err}
          </div>
        )}

        {rows.length > 0 && (
          <div className="border border-[var(--taupe)]/15 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--ink-lift)]">
                  <tr>
                    {cols.map((c) => (
                      <th key={c} className="text-left px-4 py-3 font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--saffron)] border-b border-[var(--taupe)]/15">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--taupe)]/10 last:border-b-0 hover:bg-[var(--ink-lift)]/50">
                      {cols.map((c) => (
                        <td key={c} className="px-4 py-3 text-[var(--cream)] font-mono text-xs align-top">
                          {formatCell(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2 font-mono text-[10px] tracking-wider uppercase text-[var(--cream-muted)] bg-[var(--ink-lift)]/50 border-t border-[var(--taupe)]/15">
              {rows.length} row{rows.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCell(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
