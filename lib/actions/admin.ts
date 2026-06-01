"use server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient: mkClient } = require("@/lib/supabase/server");
import { revalidatePath } from "next/cache";

interface PlayerStat {
  player_id: string;
  minutes: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheet: boolean;
}

async function requireAdmin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, supabase: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: { role: string } | null };

  if (profile?.role !== "admin") return { error: "Not authorized" as const, supabase: null };

  return { error: null, supabase };
}

export async function saveFlagsAction(flags: Record<string, boolean>) {
  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  await supabase
    .from("app_config")
    .update({ value: flags, updated_at: new Date().toISOString() })
    .eq("key", "feature_flags");

  return { success: true };
}

export async function updateMatchStatusAction(matchId: string, status: string) {
  const VALID_STATUSES = ["scheduled", "live", "finished", "postponed"];
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status" };

  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  await supabase.from("matches").update({ status }).eq("id", matchId);
  return { success: true };
}

export async function saveFixtureAction(form: {
  home: string;
  away: string;
  matchday: string;
  kickoff: string;
  season: string;
}) {
  if (!form.away?.trim() || !form.matchday || !form.kickoff) return { error: "Missing required fields", data: null };

  const matchday = parseInt(form.matchday);
  if (isNaN(matchday) || matchday < 1 || matchday > 500) return { error: "Invalid matchday", data: null };

  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error", data: null };

  const { data, error: dbError } = await supabase.from("matches").insert({
    home_team: form.home.trim().slice(0, 100),
    away_team: form.away.trim().slice(0, 100),
    matchday,
    kickoff_time: form.kickoff,
    season: form.season.trim().slice(0, 20),
    status: "scheduled",
  }).select().single();

  if (dbError) return { error: dbError.message, data: null };
  revalidatePath("/admin");
  return { error: null, data };
}

export async function saveMatchStatsAction(
  matchId: string,
  playerStats: PlayerStat[],
  matchday: number,
  season: string,
  homeTeam: string,
) {
  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const played = playerStats.filter(r => r.minutes > 0);

  if (played.length > 0) {
    await supabase.from("player_match_stats").upsert(
      played.map(r => ({
        player_id: r.player_id,
        match_id: matchId,
        goals: Math.max(0, Math.min(20, Math.floor(r.goals))),
        assists: Math.max(0, Math.min(20, Math.floor(r.assists))),
        yellow_cards: Math.max(0, Math.min(2, Math.floor(r.yellow_cards))),
        red_cards: Math.max(0, Math.min(1, Math.floor(r.red_cards))),
        clean_sheet: Boolean(r.clean_sheet),
        minutes_played: Math.max(0, Math.min(120, Math.floor(r.minutes))),
      })),
      { onConflict: "player_id,match_id" }
    );
  }

  const homeGoals = played.filter(() => homeTeam.includes("Scottland")).reduce((s, r) => s + r.goals, 0);
  const awayGoals = played.filter(() => !homeTeam.includes("Scottland")).reduce((s, r) => s + r.goals, 0);

  await supabase.from("matches").update({
    status: "finished",
    home_score: homeGoals,
    away_score: awayGoals,
  }).eq("id", matchId);

  await supabase.rpc("recalculate_matchday_team_points", { p_matchday: matchday, p_season: season });

  return { success: true };
}

export async function savePrizesAction(leagueId: string, prizes: { first: string; second: string; third: string }) {
  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const sanitized = {
    first: prizes.first.slice(0, 200),
    second: prizes.second.slice(0, 200),
    third: prizes.third.slice(0, 200),
  };

  await supabase
    .from("leagues")
    .update({ prizes: sanitized.first || sanitized.second || sanitized.third ? sanitized : null })
    .eq("id", leagueId);

  return { success: true };
}

export async function updateUserRoleAction(userId: string, role: string) {
  const VALID_ROLES = ["user", "manager", "moderator", "admin"];
  if (!VALID_ROLES.includes(role)) return { error: "Invalid role" };

  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  await supabase.from("profiles").update({ role }).eq("id", userId);
  return { success: true };
}
