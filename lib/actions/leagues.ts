"use server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient: mkClient } = require("@/lib/supabase/server");
import { revalidatePath } from "next/cache";
import { generateInviteCode } from "@/lib/utils";

export async function createLeague(
  name: string,
  description: string,
  prizes?: { first: string; second: string; third: string },
) {
  if (!name?.trim()) return { error: "League name is required" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const inviteCode = generateInviteCode();

  const hasPrizes = prizes && (prizes.first || prizes.second || prizes.third);

  const { data: league, error } = await supabase
    .from("leagues")
    .insert({
      name: name.trim().slice(0, 100),
      description: description?.trim().slice(0, 500) || null,
      owner_id: user.id,
      invite_code: inviteCode,
      type: "private",
      prizes: hasPrizes ? prizes : null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from("league_members").insert({ league_id: league.id, user_id: user.id });
  revalidatePath("/leagues");
  return { league };
}

export async function joinLeague(inviteCode: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: league } = await supabase
    .from("leagues")
    .select()
    .eq("invite_code", inviteCode.toUpperCase())
    .single();

  // Use the same message for both not-found and already-member to prevent
  // invite code enumeration via distinct error responses.
  if (!league) return { error: "Unable to join league. Please check the invite code." };

  const { error } = await supabase
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id });

  if (error) return { error: "Unable to join league. Please check the invite code." };
  revalidatePath("/leagues");
  return { success: true, league };
}

export async function getLeagueStandings(leagueId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Verify the caller is a member of this league before returning any data
  const { data: membership } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return [];

  const { data } = await supabase
    .from("league_members")
    .select(`*, profiles(username, avatar_url, level), fantasy_teams(team_name, weekly_points)`)
    .eq("league_id", leagueId)
    .order("points", { ascending: false });
  return data ?? [];
}
