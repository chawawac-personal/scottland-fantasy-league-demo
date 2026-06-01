"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { BarChart2, CheckCircle2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Match {
  id: string;
  matchday: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  kickoff_time: string;
  season: string;
}

const SFC = "Scottland FC";

function getResult(m: Match): "W" | "L" | "D" | null {
  if (m.home_score === null || m.away_score === null) return null;
  const sfcGoals = m.home_team === SFC ? m.home_score : m.away_score;
  const oppGoals = m.home_team === SFC ? m.away_score : m.home_score;
  if (sfcGoals > oppGoals) return "W";
  if (sfcGoals < oppGoals) return "L";
  return "D";
}

const RESULT_STYLE: Record<string, string> = {
  W: "bg-green-100 text-green-700",
  L: "bg-red-100   text-red-600",
  D: "bg-slate-100 text-slate-500",
};

export default function MatchStatsPage() {
  const [matches, setMatches]   = useState<Match[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<"results" | "fixtures">("results");

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data } = await (supabase as any)
          .from("matches")
          .select("*")
          .order("kickoff_time", { ascending: false });
        if (data) setMatches(data);
      } catch { /* empty state */ } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const results  = matches.filter(m => m.status === "finished");
  const fixtures = matches.filter(m => m.status !== "finished").reverse();

  const wins         = results.filter(m => getResult(m) === "W").length;
  const losses       = results.filter(m => getResult(m) === "L").length;
  const draws        = results.filter(m => getResult(m) === "D").length;
  const goalsFor     = results.reduce((s, m) => s + (m.home_team === SFC ? (m.home_score ?? 0) : (m.away_score ?? 0)), 0);
  const goalsAgainst = results.reduce((s, m) => s + (m.home_team === SFC ? (m.away_score ?? 0) : (m.home_score ?? 0)), 0);

  const list = tab === "results" ? results : fixtures;

  return (
    <div className="min-h-screen">
      <TopBar title="Match Stats" subtitle="Results, fixtures & performance" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-5">

        {/* Season summary */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Played",        value: results.length,  cls: "text-sfc-black" },
              { label: "Won",           value: wins,            cls: "text-green-600" },
              { label: "Lost",          value: losses,          cls: "text-red-500"   },
              { label: "Goals For",     value: goalsFor,        cls: "text-sfc-blue"  },
              { label: "Goals Against", value: goalsAgainst,    cls: "text-slate-500" },
            ].map(s => (
              <div key={s.label} className="glass-card p-4 text-center">
                <p className={cn("text-2xl font-bold", s.cls)}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(["results", "fixtures"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === t ? "bg-white text-sfc-black shadow-sm" : "text-muted-foreground hover:text-sfc-black"
              )}
            >
              {t === "results" ? "Results" : "Upcoming"}
            </button>
          ))}
        </div>

        {/* Match cards */}
        {loading ? (
          <div className="glass-card p-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : list.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-muted-foreground">
              {tab === "results" ? "No results yet." : "No upcoming fixtures."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((m, i) => {
              const result   = getResult(m);
              const hasScore = m.home_score !== null && m.away_score !== null;
              const date     = new Date(m.kickoff_time);
              const dateStr  = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
              const timeStr  = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="p-4 rounded-xl border bg-slate-50 border-slate-200"
                >
                  {/* Top row: matchday + date + result */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs text-sfc-blue font-semibold">MD{m.matchday}</span>
                    <div className="flex items-center gap-2">
                      {m.status === "finished"
                        ? <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" />{dateStr}</span>
                        : <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{dateStr}</span>
                      }
                      {result && (
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", RESULT_STYLE[result])}>
                          {result}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Teams & score */}
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn("font-semibold flex-1", m.home_team === SFC ? "text-sfc-blue" : "text-sfc-black")}>
                      {m.home_team}
                    </span>
                    <span className={cn("font-bold px-4 tabular-nums", hasScore ? "text-sfc-black" : "text-muted-foreground")}>
                      {hasScore ? `${m.home_score} — ${m.away_score}` : "VS"}
                    </span>
                    <span className={cn("font-semibold flex-1 text-right", m.away_team === SFC ? "text-sfc-blue" : "text-sfc-black")}>
                      {m.away_team}
                    </span>
                  </div>

                  {/* Time for upcoming */}
                  {!hasScore && (
                    <p className="text-center text-xs text-muted-foreground mt-2">{timeStr} CAT</p>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Player stats placeholder */}
        <div className="glass-card p-8 text-center">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-sfc-black mb-1">Player Match Stats</p>
          <p className="text-xs text-muted-foreground">Detailed player stats will appear here once matches are scored.</p>
        </div>

      </div>
    </div>
  );
}
