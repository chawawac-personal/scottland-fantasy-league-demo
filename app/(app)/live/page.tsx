"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { Radio, Zap, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface MatchEvent {
  time: string;
  type: string;
  player: string;
  team: string;
  pts: string;
  desc: string;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  teamName: string;
  livePoints: number;
  total: number;
  change: string;
}

interface LiveStat {
  player: string;
  pos: string;
  livePoints: number;
  goals: number;
  assists: number;
}

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + increment, value);
      setDisplay(Math.floor(current));
      if (current >= value) clearInterval(timer);
    }, 800 / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}</span>;
}

export default function LivePage() {
  const [liveMatch, setLiveMatch] = useState<{ home: string; away: string; homeScore: number; awayScore: number; matchday: number; matchId: string } | null>(null);
  const [matchTime, setMatchTime] = useState(0);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStat[]>([]);
  const [myLiveScore, setMyLiveScore] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // Live match
        const { data: match } = await sb
          .from("matches")
          .select("*")
          .eq("status", "live")
          .order("kickoff_time", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!match) return;

        setLiveMatch({ home: match.home_team, away: match.away_team, homeScore: match.home_score ?? 0, awayScore: match.away_score ?? 0, matchday: match.matchday, matchId: match.id });

        // Player stats for this match → build event feed
        const { data: stats } = await sb
          .from("player_match_stats")
          .select("*, players(name, position, club)")
          .eq("match_id", match.id)
          .order("fantasy_points", { ascending: false });

        if (stats && stats.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const events: MatchEvent[] = (stats as any[]).flatMap((s: any) => {
            const evts: MatchEvent[] = [];
            const name: string = s.players?.name ?? "Unknown";
            const isSFC = s.players?.club === "Scottland FC";
            for (let g = 0; g < s.goals; g++) evts.push({ time: "—", type: "goal", player: name, team: isSFC ? "SFC" : "OPP", pts: "+4", desc: `GOAL! ${name} scores!` });
            for (let a = 0; a < s.assists; a++) evts.push({ time: "—", type: "assist", player: name, team: isSFC ? "SFC" : "OPP", pts: "+3", desc: `${name} with the assist` });
            if (s.yellow_cards > 0) evts.push({ time: "—", type: "yellow", player: name, team: isSFC ? "SFC" : "OPP", pts: "-1", desc: `${name} receives a yellow card` });
            if (s.red_cards > 0) evts.push({ time: "—", type: "red", player: name, team: isSFC ? "SFC" : "OPP", pts: "-3", desc: `${name} shown a red card!` });
            return evts;
          });
          setMatchEvents(events);

          // Live stats (top 5 by fantasy_points in this match)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setLiveStats((stats as any[]).slice(0, 5).map((s: any) => ({
            player: s.players?.name ?? "Unknown",
            pos: s.players?.position ?? "—",
            livePoints: s.fantasy_points ?? 0,
            goals: s.goals ?? 0,
            assists: s.assists ?? 0,
          })));
        }

        // Live leaderboard from profiles
        const { data: profiles } = await sb
          .from("profiles")
          .select("id, username, fantasy_points")
          .order("fantasy_points", { ascending: false })
          .limit(7);
        if (profiles && profiles.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const board: LeaderboardEntry[] = (profiles as any[]).map((p: any, i: number) => ({
            rank: i + 1,
            username: user && p.id === user.id ? "YourTeam" : p.username,
            teamName: `${p.username}'s XI`,
            livePoints: 0,
            total: p.fantasy_points ?? 0,
            change: "—",
          }));
          setLiveLeaderboard(board);
        }

        // My live score for this matchday
        if (user) {
          const { data: teamData } = await sb
            .from("fantasy_teams")
            .select("weekly_points")
            .eq("user_id", user.id)
            .maybeSingle();
          if (teamData) setMyLiveScore(teamData.weekly_points ?? 0);
        }
      } catch { /* show empty state */ }
    }

    load();

    // Realtime: refresh on match or stat changes
    const channel = supabase.channel("live_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_match_stats" }, load)
      .subscribe();

    // Tick match clock every minute
    const clock = setInterval(() => setMatchTime(t => Math.min(t + 1, 90)), 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(clock);
    };
  }, []);

  const eventTypeStyles: Record<string, { bg: string; text: string; icon: string }> = {
    goal:    { bg: "bg-sfc-blue/20 border-sfc-blue/30",   text: "text-sfc-blue",    icon: "⚽" },
    assist:  { bg: "bg-blue-500/20 border-blue-500/30",   text: "text-blue-400",    icon: "🎯" },
    yellow:  { bg: "bg-amber-500/20 border-amber-500/30", text: "text-amber-400",   icon: "🟨" },
    red:     { bg: "bg-red-500/20 border-red-500/30",     text: "text-red-400",     icon: "🟥" },
    kickoff: { bg: "bg-slate-100/20 border-slate-200",    text: "text-muted-foreground", icon: "🏟️" },
  };

  if (!liveMatch) {
    return (
      <div className="min-h-screen">
        <TopBar title="Live Matchday Center" subtitle="No match currently live" />
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Radio className="w-12 h-12 text-slate-300 mb-4" />
          <h2 className="text-lg font-bold text-sfc-black mb-2">No Live Match Right Now</h2>
          <p className="text-sm text-muted-foreground max-w-md">Check the Dashboard for upcoming fixtures. This page will update automatically when a match goes live.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar
        title="Live Matchday Center"
        subtitle={`Matchday ${liveMatch.matchday} — Now Live`}
        rightContent={<div className="live-badge"><Radio className="w-3 h-3" /> LIVE</div>}
      />

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Live Score Banner */}
        <motion.div
          className="glass-card p-6 mb-5 border-sfc-blue/20 bg-sfc-blue/5"
          animate={{ boxShadow: ["0 0 20px rgba(0,166,81,0.2)", "0 0 40px rgba(0,166,81,0.4)", "0 0 20px rgba(0,166,81,0.2)"] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-sm text-muted-foreground mb-1">Home</p>
              <p className="text-2xl font-bold text-sfc-blue">{liveMatch.home}</p>
            </div>
            <div className="text-center px-8">
              <div className="flex items-center gap-4">
                <span className="text-6xl font-display text-sfc-black">{liveMatch.homeScore}</span>
                <span className="text-3xl text-muted-foreground">&ndash;</span>
                <span className="text-6xl font-display text-sfc-black">{liveMatch.awayScore}</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-bold text-sfc-black">{matchTime}&apos;</span>
              </div>
            </div>
            <div className="text-center flex-1">
              <p className="text-sm text-muted-foreground mb-1">Away</p>
              <p className="text-2xl font-bold text-sfc-black">{liveMatch.away}</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Match Events Feed */}
          <div className="glass-card overflow-x-auto">
            <div className="p-5 border-b border-slate-200 flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-sfc-blue animate-pulse" />
              <h2 className="font-bold text-sfc-black text-sm">Match Events</h2>
            </div>
            <div className="divide-y divide-sfc-black-border max-h-[480px] overflow-y-auto">
              {matchEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No events logged yet</p>
              ) : (
                <AnimatePresence>
                  {matchEvents.map((event, i) => {
                    const style = eventTypeStyles[event.type] ?? eventTypeStyles.kickoff;
                    return (
                      <motion.div key={i} initial={{ opacity: 0, x: -10, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} className="p-3">
                        <div className="flex items-start gap-3">
                          <div className={cn("px-2 py-1 rounded-lg border text-xs font-bold shrink-0", style.bg, style.text)}>{event.time}</div>
                          <div className="flex-1">
                            <p className="text-xs text-sfc-black leading-snug">{style.icon} {event.desc}</p>
                            {event.player && <p className="text-[10px] text-muted-foreground mt-0.5">{event.player}</p>}
                          </div>
                          {event.pts && <span className={cn("text-xs font-bold shrink-0", event.pts.startsWith("+") ? "text-sfc-blue" : "text-red-400")}>{event.pts}</span>}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Live Player Stats */}
          <div className="glass-card overflow-x-auto">
            <div className="p-5 border-b border-slate-200 flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="font-bold text-sfc-black text-sm">Live Points &mdash; Your Team</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-center py-4 border-b border-slate-200">
                <p className="text-xs text-muted-foreground mb-1">Your Live Score</p>
                <p className="text-5xl font-display text-sfc-blue">
                  <AnimatedCounter value={myLiveScore} />
                </p>
              </div>
              <div className="space-y-2">
                {liveStats.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Stats will appear as the match progresses</p>
                ) : liveStats.map((stat) => (
                  <div key={stat.player} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-100/20">
                    <div className="w-8 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-display text-sfc-blue/70 flex-shrink-0">
                      {stat.player.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-sfc-black truncate">{stat.player}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {stat.goals > 0 && <span>⚽ {stat.goals}</span>}
                        {stat.assists > 0 && <span>🎯 {stat.assists}</span>}
                        <span>{stat.pos}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-sfc-blue">+{stat.livePoints}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Leaderboard */}
          <div className="glass-card overflow-x-auto">
            <div className="p-5 border-b border-slate-200 flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-sfc-blue" />
              <h2 className="font-bold text-sfc-black text-sm">Live Leaderboard</h2>
            </div>
            <div className="divide-y divide-sfc-black-border max-h-[480px] overflow-y-auto">
              {liveLeaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Loading rankings…</p>
              ) : liveLeaderboard.map((entry, i) => (
                <motion.div key={entry.rank} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className={cn("flex items-center gap-3 p-4 transition-colors", entry.username === "YourTeam" ? "bg-sfc-blue/10" : "hover:bg-slate-100/20")}
                >
                  <div className={cn("rank-badge text-xs shrink-0", entry.rank === 1 ? "rank-1" : entry.rank === 2 ? "rank-2" : entry.rank === 3 ? "rank-3" : "text-muted-foreground border border-slate-200")}>
                    {entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank - 1] : entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-semibold truncate", entry.username === "YourTeam" ? "text-sfc-blue" : "text-sfc-black")}>
                      {entry.username === "YourTeam" ? "You" : entry.teamName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">@{entry.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-sfc-blue">{entry.total.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">total pts</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="border-t border-slate-200 p-3">
              <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" /> Updates via Supabase Realtime
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
