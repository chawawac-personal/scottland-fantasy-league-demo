"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import {
  Trophy, Plus, Link2, Users, Crown, Globe, Lock,
  TrendingUp, TrendingDown, Minus, Copy, Check, Search,
  Gift, AlertCircle, CheckCircle2, X,
} from "lucide-react";
import { cn, generateInviteCode } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";


interface League {
  id: string;
  name: string;
  type: string;
  members: number;
  myRank: number;
  myPoints: number;
  leader: string;
  inviteCode: string | null;
  isOwner: boolean;
  prizes?: { first: string; second: string; third: string };
}


export default function LeaguesPage() {
  const [activeTab, setActiveTab] = useState<"global" | "my-leagues" | "create" | "join">("global");
  const [period, setPeriod] = useState<"overall" | "weekly" | "monthly">("overall");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    prizes: { first: "", second: "", third: "" },
  });
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdLeague, setCreatedLeague] = useState<{ name: string; invite_code: string } | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinResult, setJoinResult] = useState<{ success?: string; error?: string } | null>(null);
  const [localLeagues, setLocalLeagues] = useState<League[]>([]);
  const [globalBoard, setGlobalBoard] = useState<{ rank: number; username: string; team: string; total: number; weekly: number; monthly: number; prev: number }[]>([]);
  const [weeklyTop, setWeeklyTop] = useState<{ rank: number; username: string; points: number }[]>([]);
  const [viewingLeague, setViewingLeague] = useState<League | null>(null);
  const [leagueMembers, setLeagueMembers] = useState<{ rank: number; username: string; points: number; weekly: number }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    async function loadAll() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // My leagues
      try {
        if (user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any)
            .from("league_members")
            .select("rank, points, leagues(id, name, type, invite_code, owner_id, description, max_members, prizes)")
            .eq("user_id", user.id);
          if (data && data.length > 0) {
            const leagueIds = (data as any[]).map((m: any) => m.leagues.id);

            // Fetch actual member counts and leaders in one query
            const { data: allMembers } = await (supabase as any)
              .from("league_members")
              .select("league_id, points, profiles(username)")
              .in("league_id", leagueIds)
              .order("points", { ascending: false });

            const memberCountMap: Record<string, number> = {};
            const leaderMap: Record<string, string> = {};
            if (allMembers) {
              (allMembers as any[]).forEach((lm: any) => {
                memberCountMap[lm.league_id] = (memberCountMap[lm.league_id] ?? 0) + 1;
                if (!leaderMap[lm.league_id]) leaderMap[lm.league_id] = lm.profiles?.username ?? "—";
              });
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setLocalLeagues((data as any[]).map((m: any) => ({
              id: m.leagues.id,
              name: m.leagues.name,
              type: m.leagues.type,
              members: memberCountMap[m.leagues.id] ?? 0,
              myRank: m.rank ?? 0,
              myPoints: m.points ?? 0,
              leader: leaderMap[m.leagues.id] ?? "—",
              inviteCode: m.leagues.invite_code ?? null,
              isOwner: m.leagues.owner_id === user.id,
              prizes: m.leagues.prizes ?? undefined,
            })));
          }
        }
      } catch { /* keep mock */ }

      // Global leaderboard + weekly top 3
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [{ data: profiles }, { data: teamsData }] = await Promise.all([
          (supabase as any).from("profiles").select("id, username, fantasy_points").order("fantasy_points", { ascending: false }).limit(50),
          (supabase as any).from("fantasy_teams").select("user_id, weekly_points"),
        ]);
        if (profiles && profiles.length > 0) {
          // Build user_id → weekly_points map from the separate teams query
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const weeklyMap: Record<string, number> = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (teamsData ?? []).forEach((t: any) => { weeklyMap[t.user_id] = t.weekly_points ?? 0; });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const board = (profiles as any[]).map((p: any, i: number) => ({
            rank: i + 1,
            username: user && p.id === user.id ? "YourTeam" : p.username,
            team: user && p.id === user.id ? "Your Team" : `${p.username}'s XI`,
            total: p.fantasy_points,
            weekly: weeklyMap[p.id] ?? 0,
            monthly: weeklyMap[p.id] ?? 0,
            prev: i + 1,
          }));
          setGlobalBoard(board);

          // Weekly top 3 from fantasy_teams.weekly_points
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: weeklyData } = await (supabase as any)
            .from("fantasy_teams")
            .select("user_id, weekly_points, profiles(username)")
            .order("weekly_points", { ascending: false })
            .limit(3);
          if (weeklyData && weeklyData.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setWeeklyTop((weeklyData as any[]).map((w: any, i: number) => ({
              rank: i + 1,
              username: w.profiles?.username ?? "Manager",
              points: w.weekly_points ?? 0,
            })));
          }
        }
      } catch { /* show empty */ }
    }
    loadAll();
  }, []);

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function handleCreateLeague() {
    if (!createForm.name.trim()) return;
    setCreating(true);
    const inviteCode = generateInviteCode();

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const prizeText = [
          createForm.prizes.first && `1st: ${createForm.prizes.first}`,
          createForm.prizes.second && `2nd: ${createForm.prizes.second}`,
          createForm.prizes.third && `3rd: ${createForm.prizes.third}`,
        ].filter(Boolean).join(" | ");

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { data: league, error } = await sb
          .from("leagues")
          .insert({
            name: createForm.name.trim(),
            description: [createForm.description, prizeText].filter(Boolean).join("\n") || null,
            type: "private",
            invite_code: inviteCode,
            owner_id: user.id,
          })
          .select()
          .single();

        if (!error && league) {
          await sb.from("league_members").insert({ league_id: league.id, user_id: user.id });
          const { data: myProfile } = await sb.from("profiles").select("fantasy_points").eq("id", user.id).single();
          setLocalLeagues((prev) => [...prev, {
            id: league.id,
            name: league.name,
            type: "private",
            members: 1,
            myRank: 1,
            myPoints: myProfile?.fantasy_points ?? 0,
            leader: "YourTeam",
            inviteCode,
            isOwner: true,
            prizes: createForm.prizes,
          }]);
        }
      }
    } catch { /* still show success with generated code */ }

    setCreatedLeague({ name: createForm.name, invite_code: inviteCode });
    setCreating(false);
    setCreateForm({ name: "", description: "", prizes: { first: "", second: "", third: "" } });
  }

  async function handleJoinLeague() {
    if (joinCode.length < 4) return;
    setJoining(true);
    setJoinResult(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setJoinResult({ error: "You must be signed in to join a league." }); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: league, error } = await sb
        .from("leagues")
        .select("id, name")
        .eq("invite_code", joinCode.toUpperCase())
        .single();

      if (error || !league) {
        setJoinResult({ error: "Invalid invite code. Please check and try again." });
        return;
      }

      const { error: memberError } = await sb
        .from("league_members")
        .insert({ league_id: league.id, user_id: user.id });

      if (memberError?.code === "23505") {
        setJoinResult({ error: "You're already a member of this league." });
      } else if (memberError) {
        setJoinResult({ error: "Failed to join league. Please try again." });
      } else {
        setJoinResult({ success: `You've joined "${league.name}"!` });
        setJoinCode("");
      }
    } catch {
      setJoinResult({ error: "Something went wrong. Please try again." });
    } finally {
      setJoining(false);
    }
  }

  async function openLeague(league: League) {
    setViewingLeague(league);
    setLeagueMembers([]);
    setMembersLoading(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("league_members")
        .select("rank, points, weekly_points, profiles(username)")
        .eq("league_id", league.id)
        .order("points", { ascending: false });
      if (data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setLeagueMembers((data as any[]).map((m: any, i: number) => ({
          rank: m.rank ?? i + 1,
          username: m.profiles?.username ?? "Manager",
          points: m.points ?? 0,
          weekly: m.weekly_points ?? 0,
        })));
      }
    } catch { /* show empty */ }
    finally { setMembersLoading(false); }
  }

  function RankChange({ curr, prev }: { curr: number; prev: number }) {
    const diff = prev - curr;
    if (diff > 0) return <span className="text-sfc-blue text-xs flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />{diff}</span>;
    if (diff < 0) return <span className="text-red-400 text-xs flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{Math.abs(diff)}</span>;
    return <span className="text-muted-foreground text-xs"><Minus className="w-3 h-3" /></span>;
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Leagues" subtitle="Compete with fans across Zimbabwe" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-7">
        {/* Weekly top 3 */}
        {weeklyTop.length > 0 && <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {weeklyTop.map((w) => (
            <div
              key={w.rank}
              className={cn("glass-card p-5 flex items-center gap-3", w.rank === 1 && "border-yellow-500/20 bg-yellow-500/5")}
            >
              <div className={cn("text-2xl", w.rank === 1 ? "rank-1" : w.rank === 2 ? "rank-2" : "rank-3")}>
                {["🥇", "🥈", "🥉"][w.rank - 1]}
              </div>
              <div>
                <p className="font-bold text-sfc-black text-sm">{w.username}</p>
                <p className="text-xs text-muted-foreground">This week&apos;s top manager #{w.rank}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-display text-sfc-blue">{w.points}</p>
                <p className="text-[10px] text-muted-foreground">pts</p>
              </div>
            </div>
          ))}
        </div>}

        {/* Tab navigation */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "global",     label: "Global Rankings", icon: Globe },
            { id: "my-leagues", label: "My Leagues",      icon: Trophy },
            { id: "create",     label: "Create League",   icon: Plus },
            { id: "join",       label: "Join League",     icon: Link2 },
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
          {/* ── Global Rankings ── */}
          {activeTab === "global" && (
            <motion.div key="global" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {(() => {
                const sortedBoard = [...globalBoard]
                  .sort((a, b) => period === "weekly" ? b.weekly - a.weekly : period === "monthly" ? b.monthly - a.monthly : b.total - a.total)
                  .map((e, i) => ({ ...e, rank: i + 1 }));
                return (
              <div className="glass-card overflow-x-auto">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                  <h2 className="font-bold text-sfc-black">Zimbabwe Leaderboard</h2>
                  <div className="flex gap-1">
                    {(["overall", "weekly", "monthly"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-semibold capitalize border transition-all",
                          period === p
                            ? "bg-sfc-blue/20 border-sfc-blue/40 text-sfc-blue"
                            : "border-slate-200 text-muted-foreground hover:text-sfc-black"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-100/20">
                    <tr>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground">Rank</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground">Manager</th>
                      <th className="hidden md:table-cell text-left px-5 py-4 text-xs font-semibold text-muted-foreground">Team</th>
                      <th className="text-right px-5 py-4 text-xs font-semibold text-muted-foreground">Total Pts</th>
                      <th className="hidden sm:table-cell text-right px-5 py-4 text-xs font-semibold text-muted-foreground">Weekly</th>
                      <th className="hidden md:table-cell text-right px-5 py-4 text-xs font-semibold text-muted-foreground">Monthly</th>
                      <th className="hidden sm:table-cell text-right px-5 py-4 text-xs font-semibold text-muted-foreground">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBoard.map((entry, i) => (
                      <motion.tr
                        key={entry.rank}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={cn("data-table-row", entry.username === "YourTeam" && "bg-sfc-blue/5")}
                      >
                        <td className="px-5 py-4">
                          <div className={cn(
                            "rank-badge text-xs",
                            entry.rank === 1 ? "rank-1" : entry.rank === 2 ? "rank-2" : entry.rank === 3 ? "rank-3" : "text-muted-foreground border border-slate-200"
                          )}>
                            {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-sfc-blue font-bold">
                              {entry.username[0]}
                            </div>
                            <span className={cn("text-sm font-medium", entry.username === "YourTeam" ? "text-sfc-blue" : "text-sfc-black")}>
                              {entry.username === "YourTeam" ? "You" : entry.username}
                            </span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3.5 text-sm text-muted-foreground">{entry.team}</td>
                        <td className="px-4 py-3.5 text-right text-sm font-bold text-sfc-blue">
                          {period === "overall" ? entry.total.toLocaleString() : period === "weekly" ? entry.weekly : entry.monthly}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3.5 text-right text-sm text-sfc-black">{entry.weekly}</td>
                        <td className="hidden md:table-cell px-4 py-3.5 text-right text-sm text-sfc-black">{entry.monthly}</td>
                        <td className="hidden sm:table-cell px-4 py-3.5 text-right">
                          <RankChange curr={entry.rank} prev={entry.prev} />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
                ); })()}
            </motion.div>
          )}

          {/* ── My Leagues ── */}
          {activeTab === "my-leagues" && (
            <motion.div key="my" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {localLeagues.map((league) => (
                <div key={league.id} className="glass-card-hover p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-xl border", league.type === "public" ? "bg-blue-500/10 border-blue-500/20" : "bg-sfc-blue/10 border-sfc-blue/20")}>
                        {league.type === "public"
                          ? <Globe className="w-5 h-5 text-blue-400" />
                          : <Lock className="w-5 h-5 text-sfc-blue" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-sfc-black">{league.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>{league.members.toLocaleString()} members</span>
                          {league.isOwner && <span className="text-sfc-blue font-medium">You are owner</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {league.inviteCode && (
                        <button
                          onClick={() => copyCode(league.inviteCode!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-muted-foreground hover:border-sfc-blue/30 hover:text-sfc-blue transition-all"
                        >
                          {copiedCode === league.inviteCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {league.inviteCode}
                        </button>
                      )}
                      <button onClick={() => openLeague(league)} className="btn-outline text-xs py-1.5 px-3">View League</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <p className="text-xl font-display text-sfc-blue">#{league.myRank}</p>
                      <p className="text-xs text-muted-foreground">My Rank</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <p className="text-xl font-display text-sfc-black">{league.myPoints.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">My Points</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <p className="text-sm font-bold text-amber-400 flex items-center justify-center gap-1">
                        <Crown className="w-3 h-3" />{league.leader}
                      </p>
                      <p className="text-xs text-muted-foreground">Leader</p>
                    </div>
                  </div>

                  {/* Prizes */}
                  {league.prizes && (league.prizes.first || league.prizes.second || league.prizes.third) && (
                    <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 flex items-start gap-2">
                      <Gift className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-yellow-700">Prizes</p>
                        {league.prizes.first  && <p className="text-yellow-600">🥇 1st — {league.prizes.first}</p>}
                        {league.prizes.second && <p className="text-yellow-600">🥈 2nd — {league.prizes.second}</p>}
                        {league.prizes.third  && <p className="text-yellow-600">🥉 3rd — {league.prizes.third}</p>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {/* ── Create League ── */}
          {activeTab === "create" && (
            <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <AnimatePresence mode="wait">
                {createdLeague ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-8 max-w-lg text-center"
                  >
                    <div className="text-5xl mb-4">🎉</div>
                    <h2 className="font-bold text-sfc-black text-xl mb-2">League Created!</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                      Share the invite code with your friends to get them in.
                    </p>
                    <div className="p-4 rounded-xl bg-sfc-blue/5 border border-sfc-blue/20 mb-4">
                      <p className="text-xs text-muted-foreground mb-1">{createdLeague.name}</p>
                      <p className="text-3xl font-display text-sfc-blue tracking-widest">{createdLeague.invite_code}</p>
                    </div>
                    <button
                      onClick={() => copyCode(createdLeague.invite_code)}
                      className="btn-primary w-full py-3 mb-3 flex items-center justify-center gap-2"
                    >
                      {copiedCode === createdLeague.invite_code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedCode === createdLeague.invite_code ? "Copied!" : "Copy Invite Code"}
                    </button>
                    <button
                      onClick={() => { setCreatedLeague(null); setActiveTab("my-leagues"); }}
                      className="btn-outline w-full py-3 text-sm"
                    >
                      Go to My Leagues
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="form" className="glass-card p-6 max-w-lg">
                    <h2 className="font-bold text-sfc-black text-lg mb-5">Create Private League</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">League Name *</label>
                        <input
                          type="text"
                          value={createForm.name}
                          onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                          placeholder="e.g. Harare Bragging Rights"
                          className="w-full px-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-sfc-black placeholder:text-muted-foreground focus:outline-none focus:border-sfc-blue/50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
                        <textarea
                          value={createForm.description}
                          onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                          placeholder="Tell members what this league is about..."
                          rows={2}
                          className="w-full px-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-sfc-black placeholder:text-muted-foreground focus:outline-none focus:border-sfc-blue/50 text-sm resize-none"
                        />
                      </div>

                      {/* Prizes */}
                      <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200 space-y-3">
                        <p className="text-xs font-semibold text-yellow-700 flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5" /> Prizes (optional)
                        </p>
                        {[
                          { key: "first",  label: "🥇 1st Place" },
                          { key: "second", label: "🥈 2nd Place" },
                          { key: "third",  label: "🥉 3rd Place" },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-xs text-yellow-700 w-20 shrink-0">{label}</span>
                            <input
                              type="text"
                              value={createForm.prizes[key as keyof typeof createForm.prizes]}
                              onChange={(e) => setCreateForm({
                                ...createForm,
                                prizes: { ...createForm.prizes, [key]: e.target.value },
                              })}
                              placeholder="e.g. $50 airtime"
                              className="flex-1 px-3 py-2 bg-white border border-yellow-200 rounded-lg text-xs text-sfc-black placeholder:text-muted-foreground focus:outline-none focus:border-yellow-400"
                            />
                          </div>
                        ))}
                      </div>

                      <button
                        disabled={creating || !createForm.name.trim()}
                        onClick={handleCreateLeague}
                        className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <Plus className="w-4 h-4" />
                        {creating ? "Creating..." : "Create League"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── Join League ── */}
          {activeTab === "join" && (
            <motion.div key="join" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card p-6 max-w-lg">
                <h2 className="font-bold text-sfc-black text-lg mb-2">Join a League</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Enter the invite code shared by your league manager
                </p>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinResult(null); }}
                      placeholder="Enter invite code (e.g. ABC123)"
                      maxLength={8}
                      className="w-full pl-10 pr-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-sfc-black placeholder:text-muted-foreground focus:outline-none focus:border-sfc-blue/50 text-sm font-mono tracking-widest"
                    />
                  </div>

                  {joinResult?.error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {joinResult.error}
                    </div>
                  )}
                  {joinResult?.success && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-sfc-blue/10 border border-sfc-blue/20 text-sfc-blue text-xs">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      {joinResult.success}
                    </div>
                  )}

                  <button
                    onClick={handleJoinLeague}
                    disabled={joinCode.length < 4 || joining}
                    className="btn-primary w-full py-3 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {joining ? "Joining..." : "Join League"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── League detail modal ── */}
      <AnimatePresence>
        {viewingLeague && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setViewingLeague(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-full sm:max-w-3xl max-h-[88vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
                  <div>
                    <h2 className="font-bold text-sfc-black text-lg">{viewingLeague.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      {viewingLeague.type === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {viewingLeague.members.toLocaleString()} members
                      {viewingLeague.inviteCode && <span className="ml-1 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{viewingLeague.inviteCode}</span>}
                    </p>
                  </div>
                  <button onClick={() => setViewingLeague(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Leaderboard */}
                <div className="overflow-y-auto flex-1">
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading members…</div>
                  ) : leagueMembers.length === 0 ? (
                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">No members found</div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Rank</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Manager</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground">Total Pts</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground">Weekly</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leagueMembers.map((m, i) => (
                          <tr key={m.username} className={cn("transition-colors hover:bg-slate-50", m.username === viewingLeague.leader && "bg-amber-50/50")}>
                            <td className="px-5 py-3.5">
                              <div className={cn("rank-badge text-xs", i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "text-muted-foreground border border-slate-200")}>
                                {i < 3 ? ["🥇","🥈","🥉"][i] : m.rank}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-sfc-blue/10 border border-sfc-blue/20 flex items-center justify-center text-xs font-bold text-sfc-blue">
                                  {m.username[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-sfc-black">@{m.username}</span>
                                {i === 0 && <Crown className="w-3 h-3 text-amber-400" />}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right text-sm font-bold text-sfc-blue">{m.points.toLocaleString()}</td>
                            <td className="px-5 py-3.5 text-right text-sm text-sfc-black">{m.weekly}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
