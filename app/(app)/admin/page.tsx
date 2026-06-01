"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import {
  Shield, Users, Trophy, Radio, Bell, BarChart2,
  Plus, Edit, Trash2, CheckCircle, XCircle, Send,
  TrendingUp, AlertTriangle, Database, Eye, ToggleLeft,
  Gift, Globe, Save, Zap, X, Clock,
} from "lucide-react";

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
import { cn, formatPrice, getPositionColor } from "@/lib/utils";


const FLAG_DEFS = [
  { key: "liveScoring",     label: "Live Scoring",       desc: "Stream live fantasy points during matches" },
  { key: "transferWindow",  label: "Transfer Window",    desc: "Allow players to buy/sell in the market" },
  { key: "chat",            label: "Matchday Chat",      desc: "Enable community chat during live matches" },
  { key: "polls",           label: "Fan Polls",          desc: "Let fans vote on matchday polls" },
  { key: "leagueCreation",  label: "League Creation",    desc: "Allow managers to create new private leagues" },
  { key: "notifications",   label: "Push Notifications", desc: "Send in-app notifications to all users" },
  { key: "marketplace",     label: "Player Market",      desc: "Show the buy/sell player market page" },
  { key: "achievements",    label: "Achievements",       desc: "Award XP badges and trophies to users" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "players" | "users" | "matches" | "notifications" | "flags" | "leagues">("overview");
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [notifForm, setNotifForm] = useState({ title: "", body: "", type: "system" });
  const [sending, setSending] = useState(false);
  const [players, setPlayers] = useState<{ id: string; name: string; position: string; price: number; total_points: number; goals: number; is_injured: boolean }[]>([]);
  const [users, setUsers]     = useState<{ id: string; username: string; email: string; level: string; points: number; status: string; joined: string }[]>([]);
  const [userCount, setUserCount] = useState("—");
  const [platformStats, setPlatformStats] = useState({ leagues: 0, liveMatches: 0, notifications: 0 });

  // Load real players and users from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const [{ data: playersData }, { data: profilesData }] = await Promise.all([
          supabase.from("players").select("id, name, position, price, total_points, goals, is_injured").order("total_points", { ascending: false }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("profiles").select("id, username, role, fantasy_points, created_at").order("fantasy_points", { ascending: false }),
        ]);
        if (playersData && playersData.length > 0) setPlayers(playersData as typeof players);
        if (profilesData && profilesData.length > 0) {
          setUserCount(profilesData.length.toLocaleString());
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setUsers((profilesData as any[]).map((p: any, i: number) => ({
            id: String(i + 1),
            username: p.username,
            email: `${p.username.toLowerCase()}@sfc.zw`,
            level: p.role === "admin" ? "Admin" : p.role === "manager" ? "Manager" : p.role === "moderator" ? "Mod" : "User",
            points: p.fantasy_points,
            status: "active",
            joined: new Date(p.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
          })));
        }

        // Matches
        const { data: matchesData } = await supabase.from("matches").select("*").order("matchday", { ascending: false });
        if (matchesData && matchesData.length > 0) setDbMatches(matchesData as AdminMatch[]);

        // Public leagues for prize management
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leaguesData } = await (supabase as any)
          .from("leagues")
          .select("id, name, prizes, league_members(count)")
          .eq("type", "public")
          .order("created_at", { ascending: false });
        if (leaguesData && leaguesData.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped = (leaguesData as any[]).map((l: any) => ({
            id: l.id,
            name: l.name,
            member_count: l.league_members?.[0]?.count ?? 0,
            prizes: l.prizes ?? null,
          }));
          setPublicLeagues(mapped);
          const initial: Record<string, { first: string; second: string; third: string }> = {};
          mapped.forEach(l => { initial[l.id] = { first: l.prizes?.first ?? "", second: l.prizes?.second ?? "", third: l.prizes?.third ?? "" }; });
          setEditingPrizes(initial);
        }

        // Real platform stats
        const [{ count: leagueCount }, { count: liveCount }, { count: notifCount }] = await Promise.all([
          supabase.from("leagues").select("*", { count: "exact", head: true }),
          supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "live"),
          supabase.from("notifications").select("*", { count: "exact", head: true }),
        ]);
        setPlatformStats({ leagues: leagueCount ?? 0, liveMatches: liveCount ?? 0, notifications: notifCount ?? 0 });
      } catch { /* show zeros */ }
    }
    loadData();
  }, []);
  const [dbMatches, setDbMatches] = useState<AdminMatch[]>([]);
  const [scoringMatch, setScoringMatch] = useState<AdminMatch | null>(null);
  const [playerStatRows, setPlayerStatRows] = useState<PlayerStatRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [savingStats, setSavingStats] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [addFixtureOpen, setAddFixtureOpen] = useState(false);
  const [fixtureForm, setFixtureForm] = useState({ home: "Scottland FC", away: "", matchday: "", kickoff: "", season: "2025/26" });
  const [savingFixture, setSavingFixture] = useState(false);
  const [publicLeagues, setPublicLeagues] = useState<{ id: string; name: string; member_count: number; prizes: { first: string; second: string; third: string } | null }[]>([]);
  const [editingPrizes, setEditingPrizes] = useState<Record<string, { first: string; second: string; third: string }>>({});
  const [savingPrize, setSavingPrize] = useState<string | null>(null);

  const [flags, setFlags] = useState<Record<string, boolean>>({
    liveScoring: true, transferWindow: true, chat: true, polls: true,
    leagueCreation: true, notifications: true, marketplace: true, achievements: true,
  });
  const [flagSaved, setFlagSaved]   = useState(false);
  const [flagSaving, setFlagSaving] = useState(false);

  // Load feature flags from Supabase on mount
  useEffect(() => {
    async function loadFlags() {
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("app_config")
          .select("value")
          .eq("key", "feature_flags")
          .single();
        if (data?.value) setFlags(data.value as Record<string, boolean>);
      } catch { /* use defaults */ }
    }
    loadFlags();
  }, []);

  async function saveFlags() {
    setFlagSaving(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("app_config")
        .update({ value: flags, updated_at: new Date().toISOString() })
        .eq("key", "feature_flags");
      setFlagSaved(true);
      setTimeout(() => setFlagSaved(false), 2000);
    } catch { /* silently fail */ }
    finally { setFlagSaving(false); }
  }

  async function sendNotification() {
    setSending(true);
    await new Promise(r => setTimeout(r, 1000));
    setSending(false);
    setNotifForm({ title: "", body: "", type: "system" });
  }

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
        player_id: p.id,
        name: p.name,
        position: p.position,
        minutes: statsMap[p.id]?.minutes ?? 0,
        goals: statsMap[p.id]?.goals ?? 0,
        assists: statsMap[p.id]?.assists ?? 0,
        yellow_cards: statsMap[p.id]?.yellow_cards ?? 0,
        red_cards: statsMap[p.id]?.red_cards ?? 0,
        clean_sheet: statsMap[p.id]?.clean_sheet ?? false,
        fantasy_points: statsMap[p.id]?.fantasy_points ?? 0,
      })));
    } catch { /* keep empty */ }
    finally { setStatsLoading(false); }
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

      // Upsert stats for players who actually played (minutes > 0)
      const played = playerStatRows.filter(r => r.minutes > 0);
      if (played.length > 0) {
        await sb.from("player_match_stats").upsert(
          played.map(r => ({
            player_id: r.player_id,
            match_id: scoringMatch.id,
            goals: r.goals,
            assists: r.assists,
            yellow_cards: r.yellow_cards,
            red_cards: r.red_cards,
            clean_sheet: r.clean_sheet,
            minutes_played: r.minutes,
          })),
          { onConflict: "player_id,match_id" }
        );
      }

      // Update match score and status
      const homeGoals = played.filter(r => scoringMatch.home_team.includes("Scottland")).reduce((s, r) => s + r.goals, 0);
      const awayGoals = played.filter(r => !scoringMatch.home_team.includes("Scottland")).reduce((s, r) => s + r.goals, 0);
      await sb.from("matches").update({
        status: "finished",
        home_score: homeGoals,
        away_score: awayGoals,
      }).eq("id", scoringMatch.id);

      // Recalculate points
      setCalculating(true);
      await sb.rpc("recalculate_matchday_team_points", { p_matchday: scoringMatch.matchday, p_season: scoringMatch.season });

      // Refresh matches list
      const { data: fresh } = await supabase.from("matches").select("*").order("matchday", { ascending: false });
      if (fresh) setDbMatches(fresh as AdminMatch[]);
      setScoringMatch(null);
    } catch { /* show inline */ }
    finally { setSavingStats(false); setCalculating(false); }
  }

  async function updateMatchStatus(matchId: string, status: string) {
    setStatusUpdating(matchId);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("matches").update({ status }).eq("id", matchId);
      setDbMatches(prev => prev.map(m => m.id === matchId ? { ...m, status } : m));
    } catch { /* silently fail */ }
    finally { setStatusUpdating(null); }
  }

  async function saveFixture() {
    if (!fixtureForm.away || !fixtureForm.matchday || !fixtureForm.kickoff) return;
    setSavingFixture(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("matches").insert({
        home_team: fixtureForm.home,
        away_team: fixtureForm.away,
        matchday: parseInt(fixtureForm.matchday),
        kickoff_time: fixtureForm.kickoff,
        season: fixtureForm.season,
        status: "scheduled",
      }).select().single();
      if (data) setDbMatches(prev => [data as AdminMatch, ...prev].sort((a, b) => b.matchday - a.matchday));
      setAddFixtureOpen(false);
      setFixtureForm({ home: "Scottland FC", away: "", matchday: "", kickoff: "", season: "2025/26" });
    } catch { /* silently fail */ }
    finally { setSavingFixture(false); }
  }

  async function savePrizes(leagueId: string) {
    setSavingPrize(leagueId);
    try {
      const supabase = createClient();
      const prizes = editingPrizes[leagueId];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("leagues")
        .update({ prizes: prizes.first || prizes.second || prizes.third ? prizes : null })
        .eq("id", leagueId);
      setPublicLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, prizes } : l));
    } catch { /* silently fail */ }
    finally { setSavingPrize(null); }
  }

  function toggleInjury(id: string) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, is_injured: !p.is_injured } : p));
  }

  return (
    <div className="min-h-screen">
      <TopBar
        title="Admin Panel"
        subtitle="Scottland Fantasy League Management"
        rightContent={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-red-400">Admin Access</span>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-7">
        {/* Tab navigation */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "overview", label: "Overview", icon: BarChart2 },
            { id: "players", label: "Players", icon: Trophy },
            { id: "users", label: "Users", icon: Users },
            { id: "matches", label: "Matches", icon: Radio },
            { id: "notifications", label: "Notifications", icon: Bell },
            { id: "leagues",       label: "Leagues",       icon: Trophy      },
            { id: "flags",         label: "Feature Flags", icon: ToggleLeft  },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm font-medium border transition-all",
                activeTab === tab.id
                  ? "bg-sfc-blue/10 border-sfc-blue/30 text-sfc-blue"
                  : "border-slate-200 text-muted-foreground hover:border-sfc-blue/20 hover:text-sfc-black"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* Real user count from Supabase */}
                <div className="glass-card p-7">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-slate-100/50">
                      <Users className="w-5 h-5 text-sfc-blue" />
                    </div>
                  </div>
                  <p className="text-3xl font-display mb-1 text-sfc-blue">{userCount}</p>
                  <p className="text-sm text-white font-medium">Total Users</p>
                  <p className="text-xs text-muted-foreground">From profiles table</p>
                </div>
                {[
                  { label: "Active Leagues",     value: platformStats.leagues.toLocaleString(),      icon: Trophy, color: "text-amber-400", change: "Total leagues created" },
                  { label: "Live Now",           value: platformStats.liveMatches.toLocaleString(),  icon: Radio,  color: "text-red-400",   change: "Matches with live status" },
                  { label: "Notifications Sent", value: platformStats.notifications.toLocaleString(), icon: Bell,   color: "text-blue-400",  change: "All time" },
                ].map((s) => (
                  <div key={s.label} className="glass-card p-7">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-slate-100/50">
                        <s.icon className={cn("w-5 h-5", s.color)} />
                      </div>
                    </div>
                    <p className={cn("text-3xl font-display mb-1", s.color)}>{s.value}</p>
                    <p className="text-sm text-white font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.change}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="glass-card p-7">
                  <h2 className="font-bold text-sfc-black mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sfc-blue" /> Platform Health
                  </h2>
                  <div className="space-y-3">
                    {[
                      { label: "Daily Active Users", value: 847, max: 2847, color: "bg-sfc-blue" },
                      { label: "Team Submissions", value: 2340, max: 2847, color: "bg-blue-500" },
                      { label: "Transfers Made Today", value: 156, max: 500, color: "bg-amber-500" },
                      { label: "Chat Messages Today", value: 1240, max: 2000, color: "bg-purple-500" },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-sfc-black">{metric.label}</span>
                          <span className="text-muted-foreground">{metric.value.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", metric.color)} style={{ width: `${(metric.value / metric.max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card p-7">
                  <h2 className="font-bold text-sfc-black mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Recent Alerts
                  </h2>
                  <div className="space-y-2">
                    {[
                      { msg: "Tawanda Chimwemwe marked as injured", time: "2h ago", type: "warning" },
                      { msg: "User 'BanTest' reported 3 times", time: "4h ago", type: "error" },
                      { msg: "MD12 fixture confirmed vs Dynamos", time: "1d ago", type: "info" },
                      { msg: "Transfer window closes in 2 days", time: "1d ago", type: "warning" },
                    ].map((alert, i) => (
                      <div key={i} className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-xs",
                        alert.type === "error" ? "bg-red-500/10 border-red-500/20 text-red-300" :
                        alert.type === "warning" ? "bg-amber-500/10 border-amber-500/20 text-amber-300" :
                        "bg-blue-500/10 border-blue-500/20 text-blue-300"
                      )}>
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        <span className="flex-1">{alert.msg}</span>
                        <span className="text-muted-foreground">{alert.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "players" && (
            <motion.div key="players" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card overflow-x-auto">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                  <h2 className="font-bold text-sfc-black">Player Management</h2>
                  <button className="btn-primary text-xs py-2 flex items-center gap-1.5">
                    <Plus className="w-3 h-3" /> Add Player
                  </button>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-100/20">
                    <tr>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground">Player</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground">Pos</th>
                      <th className="text-right px-5 py-4 text-xs font-semibold text-muted-foreground">Price</th>
                      <th className="text-right px-5 py-4 text-xs font-semibold text-muted-foreground">Points</th>
                      <th className="text-right px-5 py-4 text-xs font-semibold text-muted-foreground">Goals</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground">Injured</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player) => (
                      <tr key={player.id} className="data-table-row">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-display text-sfc-blue/70">
                              {player.name.split(" ").map(n => n[0]).join("")}
                            </div>
                            <span className="text-sm font-medium text-sfc-black">{player.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPositionColor(player.position))}>
                            {player.position}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm text-amber-400">{formatPrice(player.price)}</td>
                        <td className="px-4 py-3.5 text-right text-sm font-bold text-sfc-blue">{player.total_points}</td>
                        <td className="px-4 py-3.5 text-right text-sm text-sfc-black">{player.goals}</td>
                        <td className="px-4 py-3.5 text-center">
                          <button onClick={() => toggleInjury(player.id)}>
                            {player.is_injured
                              ? <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                              : <CheckCircle className="w-5 h-5 text-sfc-blue mx-auto" />
                            }
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setEditingPlayer(player.id)} className="p-1.5 rounded-lg border border-slate-200 hover:border-sfc-blue/30 text-muted-foreground hover:text-sfc-blue transition-colors">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1.5 rounded-lg border border-slate-200 hover:border-red-500/30 text-muted-foreground hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "users" && (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card overflow-x-auto">
                <div className="p-4 border-b border-slate-200">
                  <h2 className="font-bold text-sfc-black">User Management</h2>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-100/20">
                    <tr>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground">User</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground">Email</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground">Role</th>
                      <th className="text-right px-5 py-4 text-xs font-semibold text-muted-foreground">Points</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground">Joined</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="data-table-row">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-sfc-blue/10 border border-sfc-blue/20 flex items-center justify-center text-xs font-bold text-sfc-blue">
                              {user.username[0]}
                            </div>
                            <span className="text-sm text-sfc-black">@{user.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full border",
                            user.level === "Admin"
                              ? "bg-red-500/20 border-red-500/30 text-red-400"
                              : user.level === "Mod"
                                ? "bg-purple-500/20 border-purple-500/30 text-purple-400"
                                : "bg-slate-100 border-slate-200 text-muted-foreground"
                          )}>
                            {user.level}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm text-sfc-black">{user.points.toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-center text-xs text-muted-foreground">{user.joined}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full border",
                            user.status === "active"
                              ? "bg-sfc-blue/20 border-sfc-blue/30 text-sfc-blue"
                              : "bg-red-500/20 border-red-500/30 text-red-400"
                          )}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <select
                              defaultValue={user.level === "Admin" ? "admin" : user.level === "Manager" ? "manager" : user.level === "Mod" ? "moderator" : "user"}
                              onChange={async (e) => {
                                const supabase = createClient();
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                await (supabase as any).from("profiles").update({ role: e.target.value }).eq("username", user.username);
                                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, level: e.target.value === "admin" ? "Admin" : e.target.value === "manager" ? "Mod" : "User" } : u));
                              }}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-sfc-blue/50 text-sfc-black"
                            >
                              <option value="user">User</option>
                              <option value="manager">Manager</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "notifications" && (
            <motion.div key="notif" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="glass-card p-7">
                  <h2 className="font-bold text-sfc-black mb-5 flex items-center gap-2">
                    <Send className="w-4 h-4 text-sfc-blue" /> Broadcast Notification
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
                      <select
                        value={notifForm.type}
                        onChange={(e) => setNotifForm({ ...notifForm, type: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-sfc-black focus:outline-none focus:border-sfc-blue/50 text-sm"
                      >
                        {["system","match","transfer","goal","league","reward"].map(t => (
                          <option key={t} value={t} className="bg-slate-50">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
                      <input
                        type="text"
                        value={notifForm.title}
                        onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })}
                        placeholder="Notification title"
                        className="w-full px-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-sfc-black placeholder:text-muted-foreground focus:outline-none focus:border-sfc-blue/50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message</label>
                      <textarea
                        value={notifForm.body}
                        onChange={(e) => setNotifForm({ ...notifForm, body: e.target.value })}
                        placeholder="Notification body..."
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-sfc-black placeholder:text-muted-foreground focus:outline-none focus:border-sfc-blue/50 text-sm resize-none"
                      />
                    </div>
                    <button
                      onClick={sendNotification}
                      disabled={sending || !notifForm.title || !notifForm.body}
                      className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                    >
                      <Bell className="w-4 h-4" />
                      {sending ? "Sending..." : `Send to All Users (${userCount})`}
                    </button>
                  </div>
                </div>

                <div className="glass-card p-7">
                  <h2 className="font-bold text-sfc-black mb-5 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" /> Recent Notifications
                  </h2>
                  <div className="space-y-3">
                    {[
                      { title: "MD11 Complete!", body: "Match stats updated. Check your score.", type: "match", ago: "2h ago" },
                      { title: "Transfer Window Open", body: "Make your transfers before deadline!", type: "transfer", ago: "1d ago" },
                      { title: "Congratulations!", body: "You earned the 'Prediction King' badge", type: "reward", ago: "3d ago" },
                    ].map((n, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-lg">
                          {n.type === "match" ? <Radio className="w-5 h-5 text-sfc-blue" /> : n.type === "transfer" ? <TrendingUp className="w-5 h-5 text-amber-400" /> : <Trophy className="w-5 h-5 text-yellow-400" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-sfc-black">{n.title}</p>
                          <p className="text-xs text-muted-foreground">{n.body}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{n.ago}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "matches" && (
            <motion.div key="matches" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                  <div>
                    <h2 className="font-bold text-sfc-black">Fixture Management</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Set match status and enter player stats to calculate fantasy points</p>
                  </div>
                  <button onClick={() => setAddFixtureOpen(true)} className="btn-primary text-xs py-2 flex items-center gap-1.5">
                    <Plus className="w-3 h-3" /> Add Fixture
                  </button>
                </div>

                {/* Add fixture form */}
                <AnimatePresence>
                  {addFixtureOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-b border-slate-200 bg-slate-50 overflow-hidden">
                      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Home Team</label>
                          <input value={fixtureForm.home} onChange={e => setFixtureForm(p => ({ ...p, home: e.target.value }))} className="input text-sm py-2" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Away Team *</label>
                          <input value={fixtureForm.away} onChange={e => setFixtureForm(p => ({ ...p, away: e.target.value }))} placeholder="e.g. Dynamos FC" className="input text-sm py-2" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Matchday *</label>
                          <input type="number" value={fixtureForm.matchday} onChange={e => setFixtureForm(p => ({ ...p, matchday: e.target.value }))} placeholder="12" className="input text-sm py-2" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Kickoff Time *</label>
                          <input type="datetime-local" value={fixtureForm.kickoff} onChange={e => setFixtureForm(p => ({ ...p, kickoff: e.target.value }))} className="input text-sm py-2" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Season</label>
                          <input value={fixtureForm.season} onChange={e => setFixtureForm(p => ({ ...p, season: e.target.value }))} className="input text-sm py-2" />
                        </div>
                        <div className="flex items-end gap-2">
                          <button onClick={saveFixture} disabled={savingFixture || !fixtureForm.away} className="btn-primary text-xs py-2 px-4 flex-1 disabled:opacity-60">
                            {savingFixture ? "Saving…" : "Save Fixture"}
                          </button>
                          <button onClick={() => setAddFixtureOpen(false)} className="btn-outline text-xs py-2 px-3">Cancel</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="divide-y divide-slate-100">
                  {dbMatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No matches found</p>
                  ) : dbMatches.map((m) => (
                    <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                      {/* Matchday + date */}
                      <div className="w-24 shrink-0">
                        <p className="text-xs font-bold text-sfc-blue">MD{m.matchday}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(m.kickoff_time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          {" · "}
                          {new Date(m.kickoff_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      {/* Teams + score */}
                      <div className="flex-1 flex items-center justify-center gap-3">
                        <span className={cn("text-sm font-bold text-right w-36 truncate", m.home_team === "Scottland FC" && "text-sfc-blue")}>{m.home_team}</span>
                        <span className="text-sm font-bold text-sfc-black min-w-[48px] text-center">
                          {m.status === "finished" || m.status === "live"
                            ? `${m.home_score ?? 0} – ${m.away_score ?? 0}`
                            : "vs"}
                        </span>
                        <span className={cn("text-sm font-bold w-36 truncate", m.away_team === "Scottland FC" && "text-sfc-blue")}>{m.away_team}</span>
                      </div>

                      {/* Status badge */}
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0",
                        m.status === "live"      ? "bg-red-500/20 border-red-500/30 text-red-500 animate-pulse" :
                        m.status === "finished"  ? "bg-slate-100 border-slate-200 text-muted-foreground" :
                        m.status === "postponed" ? "bg-amber-500/10 border-amber-500/30 text-amber-500" :
                                                   "bg-sfc-blue/10 border-sfc-blue/30 text-sfc-blue"
                      )}>
                        {m.status.toUpperCase()}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {m.status === "scheduled" && (
                          <button
                            onClick={() => updateMatchStatus(m.id, "live")}
                            disabled={statusUpdating === m.id}
                            className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {statusUpdating === m.id ? "…" : "▶ Set Live"}
                          </button>
                        )}
                        {m.status === "live" && (
                          <button
                            onClick={() => openScoring(m)}
                            className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-sfc-blue/10 border border-sfc-blue/30 text-sfc-blue hover:bg-sfc-blue/20 transition-colors flex items-center gap-1"
                          >
                            <Zap className="w-3 h-3" /> Enter Stats
                          </button>
                        )}
                        {m.status === "finished" && (
                          <button
                            onClick={() => openScoring(m)}
                            className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-muted-foreground hover:border-sfc-blue/30 hover:text-sfc-blue transition-colors flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" /> Edit Stats
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === "leagues" && (
            <motion.div key="leagues" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-sfc-blue" />
                  <h2 className="font-bold text-sfc-black">Public League Prizes</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-6">Set prize descriptions for each public league. Prizes are shown to all members on the Leagues page.</p>

                {publicLeagues.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No public leagues yet.</p>
                ) : publicLeagues.map((league) => (
                  <div key={league.id} className="border border-slate-200 rounded-2xl p-5 mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold text-sfc-black">{league.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{league.member_count.toLocaleString()} members</p>
                      </div>
                      {league.prizes && (league.prizes.first || league.prizes.second || league.prizes.third) && (
                        <span className="text-[10px] bg-yellow-100 border border-yellow-300 text-yellow-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <Gift className="w-3 h-3" /> Prizes set
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {[
                        { key: "first",  label: "🥇 1st Place Prize" },
                        { key: "second", label: "🥈 2nd Place Prize" },
                        { key: "third",  label: "🥉 3rd Place Prize" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-3">
                          <label className="text-xs font-medium text-muted-foreground w-32 shrink-0">{label}</label>
                          <input
                            type="text"
                            value={editingPrizes[league.id]?.[key as "first" | "second" | "third"] ?? ""}
                            onChange={(e) => setEditingPrizes(prev => ({
                              ...prev,
                              [league.id]: { ...prev[league.id], [key]: e.target.value },
                            }))}
                            placeholder={`e.g. SFC Season Ticket`}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-sfc-black placeholder:text-muted-foreground focus:outline-none focus:border-sfc-blue/50"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end mt-4">
                      <button
                        onClick={() => savePrizes(league.id)}
                        disabled={savingPrize === league.id}
                        className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingPrize === league.id ? "Saving…" : "Save Prizes"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "flags" && (
            <motion.div key="flags" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card p-7 max-w-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-bold text-sfc-black flex items-center gap-2">
                      <ToggleLeft className="w-4 h-4 text-sfc-blue" /> Feature Flags
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enable or disable platform features without a deployment
                    </p>
                  </div>
                  <button
                    onClick={saveFlags}
                    disabled={flagSaving}
                    className={cn(
                      "text-xs font-semibold px-4 py-2 rounded-xl border transition-all flex items-center gap-1.5 disabled:opacity-60",
                      flagSaved
                        ? "bg-emerald-600/20 border-emerald-600/40 text-emerald-600"
                        : "btn-primary"
                    )}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {flagSaving ? "Saving..." : flagSaved ? "Saved!" : "Save Flags"}
                  </button>
                </div>

                <div className="space-y-3">
                  {FLAG_DEFS.map(({ key, label, desc }) => (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center justify-between gap-4 p-4 rounded-xl border transition-all",
                        flags[key]
                          ? "border-sfc-blue/20 bg-sfc-blue/5"
                          : "border-slate-200 bg-slate-50/50"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-sfc-black">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => setFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className={cn(
                          "relative w-12 h-6 rounded-full border transition-all shrink-0",
                          flags[key] ? "bg-sfc-blue/20 border-sfc-blue/40" : "bg-slate-100 border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-5 h-5 rounded-full transition-all shadow-sm",
                          flags[key] ? "left-6 bg-sfc-blue" : "left-0.5 bg-slate-300"
                        )} />
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground mt-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                  Feature flags are saved locally for this session. In production, wire these to your Supabase
                  config table so changes propagate to all users instantly.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Scoring Modal ── */}
      <AnimatePresence>
        {scoringMatch && (
          <>
            <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingStats && setScoringMatch(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <motion.div key="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
                  <div>
                    <h2 className="font-bold text-sfc-black text-lg">
                      {scoringMatch.home_team} vs {scoringMatch.away_team}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      MD{scoringMatch.matchday} · {scoringMatch.season} · Enter minutes + events for each player
                    </p>
                  </div>
                  <button onClick={() => setScoringMatch(null)} disabled={savingStats}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Player stat table */}
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
                        {(["GK", "DEF", "MID", "FWD"] as const).map(pos => {
                          const posPlayers = playerStatRows.filter(r => r.position === pos);
                          if (posPlayers.length === 0) return null;
                          return (
                            <>
                              <tr key={`pos-${pos}`} className="bg-slate-50/80">
                                <td colSpan={8} className="px-4 py-1.5">
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", getPositionColor(pos))}>{pos}</span>
                                </td>
                              </tr>
                              {posPlayers.map(row => (
                                <tr key={row.player_id} className={cn("hover:bg-slate-50/50 transition-colors", row.minutes > 0 && "bg-sfc-blue/[0.02]")}>
                                  <td className="px-4 py-2.5">
                                    <p className="text-sm font-medium text-sfc-black">{row.name}</p>
                                  </td>
                                  <td className="px-2 py-2">
                                    <input type="number" min={0} max={120} value={row.minutes}
                                      onChange={e => updateStat(row.player_id, "minutes", Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))}
                                      className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-sfc-blue/50 bg-white" />
                                  </td>
                                  {(["goals","assists","yellow_cards","red_cards"] as const).map(field => (
                                    <td key={field} className="px-2 py-2">
                                      <input type="number" min={0} max={field === "yellow_cards" || field === "red_cards" ? 2 : 10}
                                        value={row[field] as number}
                                        onChange={e => updateStat(row.player_id, field, Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-12 text-center border border-slate-200 rounded-lg px-1 py-1 text-sm focus:outline-none focus:border-sfc-blue/50 bg-white mx-auto block" />
                                    </td>
                                  ))}
                                  <td className="px-2 py-2 text-center">
                                    {(pos === "GK" || pos === "DEF" || pos === "MID") ? (
                                      <input type="checkbox" checked={row.clean_sheet}
                                        onChange={e => updateStat(row.player_id, "clean_sheet", e.target.checked)}
                                        className="w-4 h-4 accent-sfc-blue cursor-pointer" />
                                    ) : <span className="text-muted-foreground text-xs">—</span>}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <span className={cn("text-sm font-bold", row.minutes > 0 ? "text-sfc-blue" : "text-slate-300")}>
                                      {row.fantasy_points}
                                    </span>
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

                {/* Footer */}
                <div className="p-5 border-t border-slate-200 flex items-center justify-between gap-4 shrink-0 bg-slate-50/50">
                  <p className="text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Set minutes to 0 to exclude a player. Points auto-calculate via DB trigger when saved.
                  </p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setScoringMatch(null)} disabled={savingStats} className="btn-outline text-sm px-5 py-2.5">
                      Cancel
                    </button>
                    <button onClick={saveAndFinalise} disabled={savingStats || statsLoading}
                      className="btn-primary text-sm px-6 py-2.5 flex items-center gap-2 disabled:opacity-60">
                      {savingStats ? (
                        <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          {calculating ? "Calculating points…" : "Saving stats…"}</>
                      ) : (
                        <><Zap className="w-4 h-4" /> Finalise &amp; Calculate Points</>
                      )}
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