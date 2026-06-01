"use server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient: mkClient } = require("@/lib/supabase/server");
import { revalidatePath } from "next/cache";

export async function saveTeam(
  teamName: string,
  formation: string,
  playerIds: string[],
  captainId: string,
  viceCaptainId: string,
  startingIds: string[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: team, error: teamError } = await supabase
    .from("fantasy_teams")
    .upsert({ user_id: user.id, team_name: teamName, formation }, { onConflict: "user_id" })
    .select()
    .single();

  if (teamError || !team) return { error: teamError?.message ?? "Failed to save team" };

  await supabase.from("fantasy_team_players").delete().eq("fantasy_team_id", team.id);

  const inserts = playerIds.map((pid: string) => ({
    fantasy_team_id: team.id,
    player_id: pid,
    is_captain: pid === captainId,
    is_vice_captain: pid === viceCaptainId,
    is_starting: startingIds.includes(pid),
    bench_order: startingIds.includes(pid) ? null : playerIds.indexOf(pid),
  }));

  const { error: playersError } = await supabase.from("fantasy_team_players").insert(inserts);

  if (playersError) return { error: playersError.message };

  revalidatePath("/my-team");
  return { success: true };
}

export async function getMyTeam() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: team } = await supabase
    .from("fantasy_teams")
    .select(`*, fantasy_team_players(*, players(*))`)
    .eq("user_id", user.id)
    .single();

  return team;
}
