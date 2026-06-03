"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { Radio, Trophy, Edit, Plus, Zap, X, Clock, CheckCircle, XCircle } from "lucide-react";
import { cn, getPositionColor } from "@/lib/utils";

interface AdminMatch {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
  status: string;
  matchday: number;
  season: string;
}

interface PlayerStatRow {
  player_id: string;
  name: string;
  position: string;
  minutes: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheet: boolean;
  fantasy_points: number;
}

export default function ManagerPage() {
  const [activeTab, setActiveTab] = useState<"matches" | "players">("matches");

  // ── Matches ──────────────────────────────────────────────────────────────
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [scoringMatch, setScoringMatch] = useState<AdminMatch | null>(null);
  const [playerStatRows, setPlayerStatRows] = useState<PlayerStatRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [savingStats, setSavingStats] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [addFixtureOpen, setAddFixtureOpen] = useState(false);
  const [fixtureForm, setFixtureForm] = useState({ home: "Scottland FC", away: "", matchday: "", kickoff: "", season: "2025/26" });
  const [savingFixture, setSavingFixture] = useState(false);

  // ── Players ───────────────────────────────────────────────────────────────
  const [players, setPlayers] = useState<{ id: string; name: string; position: string; total_points: number; is_injured: boolean }[]>([]);
  const [togglingInjury, setTogglingInjury] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [{ data: m }, { data: p }] = await Promise.all([
        supabase.from("matches").select("*").order("matchday", { ascending: false }),
        supabase.from("players").select("id, name, position, total_points, is_injured").order("position").order("total_points", { ascending: false }),
      ]);
      if (m) {
        setMatches(m as AdminMatch[]);
        const currentSeason = (m as AdminMatch[])[0]?.season ?? "2025/26";
        setFixtureForm(prev => ({ ...prev, season: currentSeason }));
      }
      if (p) setPlayers(p as typeof players);
    }
    load();
  }, []);

  async function openScoring(match: AdminMatch) {
    setScoringMatch(match);
    setStatsLoading(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [{ data: allPlayers }, { data: existingStats }] = await Promise.all([
        supabase.from("players").select("id, name, position").order("position").order("total_points", { ascending: false }),
        sb.from("player_match_stats").select("*").eq("match_id", match.id),
      ]);
      const statsMap: Record<string, Partial<PlayerStatRow>> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (existingStats ?? []).forEach((s: any) => { statsMap[s.player_id] = { ...s, minutes: s.minutes_played }; });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPlayerStatRows((allPlayers ?? []).map((p: any) => ({
        player_id: p.id, name: p.name, position: p.position,
        minutes: statsMap[p.id]?.minutes ?? 0,
        goals: statsMap[p.id]?.goals ?? 0,
        assists: statsMap[p.id]?.assists ?? 0,
        yellow_cards: statsMap[p.id]?.yellow_cards ?? 0,
        red_cards: statsMap[p.id]?.red_cards ?? 0,
        clean_sheet: statsMap[p.id]?.clean_sheet ?? false,
        fantasy_points: statsMap[p.id]?.fantasy_points ?? 0,
      })));
    } finally { setStatsLoading(false); }
  }

  function updateStat(playerId: string, field: keyof PlayerStatRow, value: number | boolean) {
    setPlayerStatRows(prev => prev.map(r => r.player_id === playerId ? { ...r, [field]: value } : r));
  }

  async function saveAndFinalise() {
    if (!scoringMatch) return;
    setSavingStats(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const played = playerStatRows.filter(r => r.minutes > 0);
      if (played.length > 0) {
        await sb.from("player_match_stats").upsert(
          played.map(r => ({
            player_id: r.player_id, match_id: scoringMatch.id,
            goals: r.goals, assists: r.assists, yellow_cards: r.yellow_cards,
            red_cards: r.red_cards, clean_sheet: r.clean_sheet, minutes_played: r.minutes,
          })),
          { onConflict: "player_id,match_id" }
        );
      }
      const sfcIsHome = scoringMatch.home_team === "Scottland FC";
      const sfcGoals = played.filter(r => r.goals > 0).reduce((s, r) => s + r.goals, 0);
      await sb.from("matches").update({
        status: "finished",
        home_score: sfcIsHome ? sfcGoals : null,
        away_score: sfcIsHome ? null : sfcGoals,
      }).eq("id", scoringMatch.id);

      setCalculating(true);
      await sb.rpc("recalculate_matchday_team_points", { p_matchday: scoringMatch.matchday, p_season: scoringMatch.season });

      const { data: fresh } = await supabase.from("matches").select("*").order("matchday", { ascending: false });
      if (fresh) setMatches(fresh as AdminMatch[]);
      setScoringMatch(null);
    } finally { setSavingStats(false); setCalculating(false); }
  }

  async function updateMatchStatus(matchId: string, status: string) {
    setStatusUpdating(matchId);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("matches").update({ status }).eq("id", matchId);
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status } : m));
    } finally { setStatusUpdating(null); }
  }

  async function saveFixture() {
    if (!fixtureForm.away || !fixtureForm.matchday || !fixtureForm.kickoff) return;
    setSavingFixture(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("matches").insert({
        home_team: fixtureForm.home, away_team: fixtureForm.away,
        matchday: parseInt(fixtureForm.matchday), kickoff_time: fixtureForm.kickoff,
        season: fixtureForm.season, status: "scheduled",
      }).select().single();
      if (data) setMatches(prev => [data as AdminMatch, ...prev].sort((a, b) => b.matchday - a.matchday));
      setAddFixtureOpen(false);
      setFixtureForm({ home: "Scottland FC", away: "", matchday: "", kickoff: "", season: "2025/26" });
    } finally { setSavingFixture(false); }
  }

  async function toggleInjury(id: string, current: boolean) {
    setTogglingInjury(id);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("players").update({ is_injured: !current }).eq("id", id);
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, is_injured: !current } : p));
    } finally { setTogglingInjury(null); }
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Manager Panel" subtitle="Match scoring and player management" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Tab nav */}
        <div className="flex gap-2">
          {[
            { id: "matches", label: "Matches & Scoring", short: "Matches", icon: Radio },
            { id: "players", label: "Players",           short: "Players", icon: Trophy },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl text-sm font-medium border transition-all",
                activeTab === tab.id
                  ? "bg-sfc-blue/10 border-sfc-blue/30 text-sfc-blue"
                  : "border-slate-200 text-muted-foreground hover:border-sfc-blue/20 hover:text-sfc-black"
              )}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Matches tab ── */}
          {activeTab === "matches" && (
            <motion.div key="matches" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-sfc-black">Fixture Management</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Set match status · Enter stats · Finalise points</p>
                  </div>
                  <button onClick={() => setAddFixtureOpen(true)} className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0">
                    <Plus className="w-3 h-3" /> Add Fixture
                  </button>
                </div>

                <AnimatePresence>
                  {addFixtureOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-b border-slate-200 bg-slate-50 overflow-hidden">
                      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Home Team</label>
                          <input value={fixtureForm.home} onChange={e => setFixtureForm(p => ({ ...p, home: e.target.value }))} className="input text-sm py-2" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Away Team *</label>
                          <input value={fixtureForm.away} onChange={e => setFixtureForm(p => ({ ...p, away: e.target.value }))} placeholder="e.g. Dynamos FC" className="input text-sm py-2" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Matchday *</label>
                          <input type="number" value={fixtureForm.matchday} onChange={e => setFixtureForm(p => ({ ...p, matchday: e.target.value }))} placeholder="12" className="input text-sm py-2" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Kickoff *</label>
                          <input type="datetime-local" value={fixtureForm.kickoff} onChange={e => setFixtureForm(p => ({ ...p, kickoff: e.target.value }))} className="input text-sm py-2" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Season</label>
                          <input value={fixtureForm.season} onChange={e => setFixtureForm(p => ({ ...p, season: e.target.value }))} className="input text-sm py-2" /></div>
                        <div className="flex items-end gap-2">
                          <button onClick={saveFixture} disabled={savingFixture || !fixtureForm.away} className="btn-primary text-xs py-2 px-4 flex-1 disabled:opacity-60">
                            {savingFixture ? "Saving…" : "Save Fixture"}</button>
                          <button onClick={() => setAddFixtureOpen(false)} className="btn-outline text-xs py-2 px-3">Cancel</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="divide-y divide-slate-100">
                  {matches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No fixtures yet</p>
                  ) : matches.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 hover:bg-slate-50/50 transition-colors">
                      {/* Matchday + date */}
                      <div className="w-14 sm:w-24 shrink-0">
                        <p className="text-xs font-bold text-sfc-blue">MD{m.matchday}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          {new Date(m.kickoff_time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          <span className="hidden sm:inline"> · {new Date(m.kickoff_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                        </p>
                      </div>

                      {/* Teams + score */}
                      <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-3">
                        <span className={cn("text-xs sm:text-sm font-bold text-right flex-1 truncate", m.home_team === "Scottland FC" && "text-sfc-blue")}>{m.home_team}</span>
                        <span className="text-xs sm:text-sm font-bold text-sfc-black shrink-0 w-10 sm:w-12 text-center">
                          {m.status === "finished" || m.status === "live" ? `${m.home_score ?? 0} – ${m.away_score ?? 0}` : "vs"}
                        </span>
                        <span className={cn("text-xs sm:text-sm font-bold flex-1 truncate", m.away_team === "Scottland FC" && "text-sfc-blue")}>{m.away_team}</span>
                      </div>

                      {/* Status badge — hidden on mobile to save space */}
                      <span className={cn("hidden sm:inline text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0",
                        m.status === "live" ? "bg-red-500/20 border-red-500/30 text-red-500 animate-pulse" :
                        m.status === "finished" ? "bg-slate-100 border-slate-200 text-muted-foreground" :
                        "bg-sfc-blue/10 border-sfc-blue/30 text-sfc-blue")}>
                        {m.status.toUpperCase()}
                      </span>

                      {/* Action */}
                      <div className="shrink-0">
                        {m.status === "scheduled" && (
                          <button onClick={() => updateMatchStatus(m.id, "live")} disabled={statusUpdating === m.id}
                            className="text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 whitespace-nowrap">
                            {statusUpdating === m.id ? "…" : "▶ Live"}
                          </button>
                        )}
                        {m.status === "live" && (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openScoring(m)}
                              className="text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-lg bg-sfc-blue/10 border border-sfc-blue/30 text-sfc-blue hover:bg-sfc-blue/20 transition-colors flex items-center gap-1 whitespace-nowrap">
                              <Zap className="w-3 h-3" /> Stats
                            </button>
                            <button onClick={() => updateMatchStatus(m.id, "scheduled")} disabled={statusUpdating === m.id}
                              className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-muted-foreground hover:border-red-400/40 hover:text-red-400 transition-colors whitespace-nowrap disabled:opacity-50"
                              title="Cancel — revert to Scheduled">
                              ✕
                            </button>
                          </div>
                        )}
                        {m.status === "finished" && (
                          <button onClick={() => openScoring(m)}
                            className="text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-muted-foreground hover:border-sfc-blue/30 hover:text-sfc-blue transition-colors flex items-center gap-1 whitespace-nowrap">
                            <Edit className="w-3 h-3" /> Edit
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Players tab ── */}
          {activeTab === "players" && (
            <motion.div key="players" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card">
                <div className="p-4 sm:p-5 border-b border-slate-200">
                  <h2 className="font-bold text-sfc-black">Player Availability</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Toggle injury status — affects market visibility and fantasy selection</p>
                </div>

                {/* Mobile: card list */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {players.map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-display text-sfc-blue/70 shrink-0">
                        {p.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-sfc-black truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPositionColor(p.position))}>{p.position}</span>
                          <span className="text-xs font-bold text-sfc-blue">{p.total_points}pts</span>
                          {p.is_injured && <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">INJ</span>}
                        </div>
                      </div>
                      <button onClick={() => toggleInjury(p.id, p.is_injured)} disabled={togglingInjury === p.id}
                        className="transition-opacity disabled:opacity-50 shrink-0">
                        {togglingInjury === p.id
                          ? <span className="w-5 h-5 border-2 border-slate-300 border-t-sfc-blue rounded-full animate-spin inline-block" />
                          : p.is_injured
                            ? <XCircle className="w-5 h-5 text-red-400" />
                            : <CheckCircle className="w-5 h-5 text-sfc-blue" />}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Player</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Position</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Total Pts</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Availability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {players.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-display text-sfc-blue/70">
                                {p.name.split(" ").map(n => n[0]).join("")}
                              </div>
                              <span className="text-sm font-medium text-sfc-black">{p.name}</span>
                              {p.is_injured && <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">INJ</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPositionColor(p.position))}>{p.position}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-bold text-sfc-blue">{p.total_points}</td>
                          <td className="px-4 py-3.5 text-center">
                            <button onClick={() => toggleInjury(p.id, p.is_injured)} disabled={togglingInjury === p.id}
                              className="transition-opacity disabled:opacity-50">
                              {togglingInjury === p.id
                                ? <span className="w-5 h-5 border-2 border-slate-300 border-t-sfc-blue rounded-full animate-spin inline-block" />
                                : p.is_injured
                                  ? <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                                  : <CheckCircle className="w-5 h-5 text-sfc-blue mx-auto" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Scoring Modal (identical to admin) ── */}
      <AnimatePresence>
        {scoringMatch && (
          <>
            <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingStats && setScoringMatch(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <motion.div key="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-full sm:max-w-4xl max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
                  <div>
                    <h2 className="font-bold text-sfc-black text-lg">{scoringMatch.home_team} vs {scoringMatch.away_team}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">MD{scoringMatch.matchday} · {scoringMatch.season} · Enter minutes + events for each player</p>
                  </div>
                  <button onClick={() => setScoringMatch(null)} disabled={savingStats} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1">
                  {statsLoading ? (
                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading players…</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Player</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-20">Mins</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-16">⚽ G</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-16">🎯 A</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-16">🟨 YC</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-16">🟥 RC</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-20">CS</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-sfc-blue w-16">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(["GK","DEF","MID","FWD"] as const).map(pos => {
                          const rows = playerStatRows.filter(r => r.position === pos);
                          if (!rows.length) return null;
                          return (
                            <>
                              <tr key={`h-${pos}`} className="bg-slate-50/80">
                                <td colSpan={8} className="px-4 py-1.5">
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", getPositionColor(pos))}>{pos}</span>
                                </td>
                              </tr>
                              {rows.map(row => (
                                <tr key={row.player_id} className={cn("hover:bg-slate-50/50 transition-colors", row.minutes > 0 && "bg-sfc-blue/[0.02]")}>
                                  <td className="px-4 py-2.5"><p className="text-sm font-medium text-sfc-black">{row.name}</p></td>
                                  <td className="px-3 py-2.5">
                                    <input type="number" min={0} max={120} value={row.minutes}
                                      onChange={e => updateStat(row.player_id, "minutes", Math.max(0, Math.min(120, parseInt(e.target.value)||0)))}
                                      className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-sfc-blue/50 bg-white" />
                                  </td>
                                  {(["goals","assists","yellow_cards","red_cards"] as const).map(field => (
                                    <td key={field} className="px-3 py-2.5">
                                      <input type="number" min={0} max={field.includes("cards") ? 2 : 10} value={row[field] as number}
                                        onChange={e => updateStat(row.player_id, field, Math.max(0, parseInt(e.target.value)||0))}
                                        className="w-12 text-center border border-slate-200 rounded-lg px-1 py-1 text-sm focus:outline-none focus:border-sfc-blue/50 bg-white mx-auto block" />
                                    </td>
                                  ))}
                                  <td className="px-3 py-2.5 text-center">
                                    {pos !== "FWD" ? (
                                      <input type="checkbox" checked={row.clean_sheet}
                                        onChange={e => updateStat(row.player_id, "clean_sheet", e.target.checked)}
                                        className="w-4 h-4 accent-sfc-blue cursor-pointer" />
                                    ) : <span className="text-muted-foreground text-xs">—</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <span className={cn("text-sm font-bold", row.minutes > 0 ? "text-sfc-blue" : "text-slate-300")}>{row.fantasy_points}</span>
                                  </td>
                                </tr>
                              ))}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="p-4 sm:p-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 bg-slate-50/50">
                  <p className="text-xs text-muted-foreground hidden sm:block flex-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Set minutes to 0 to exclude a player. Points auto-calculate on save.
                  </p>
                  <div className="flex items-center gap-3 sm:shrink-0 justify-end">
                    <button onClick={() => setScoringMatch(null)} disabled={savingStats} className="btn-outline text-sm px-4 sm:px-5 py-2.5">Cancel</button>
                    <button onClick={saveAndFinalise} disabled={savingStats || statsLoading}
                      className="btn-primary text-sm px-4 sm:px-6 py-2.5 flex items-center gap-2 disabled:opacity-60">
                      {savingStats
                        ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{calculating ? "Calculating…" : "Saving…"}</>
                        : <><Zap className="w-4 h-4" /> <span className="hidden sm:inline">Finalise &amp; Calculate </span>Points</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
