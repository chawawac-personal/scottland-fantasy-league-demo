"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { StatsCard } from "@/components/ui/StatsCard";
import {
  User, Trophy, Star, Zap, Shield,
  Edit, Camera, Award, Flame, Heart, X, Save
} from "lucide-react";
import { cn, getLevelTitle, getXPForNextLevel } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";


const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="glass-card px-3 py-2 text-sm">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-bold text-sfc-blue">{payload[0].value} pts</p>
      </div>
    );
  }
  return null;
};

const EMPTY_PROFILE = { username: "", full_name: "", avatar_url: null as string | null, xp: 0, level: 1, fantasy_points: 0, favorite_player: "", supporter_branch: "", bio: "" };

export default function ProfilePage() {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const xpPercent = Math.min((profile.xp / getXPForNextLevel(profile.level)) * 100, 100);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", bio: "", favorite_player: "", supporter_branch: "" });
  const [saving, setSaving] = useState(false);
  const [pointsHistory, setPointsHistory] = useState<{ md: string; pts: number }[]>([]);
  const [achievements, setAchievements] = useState<{ key: string; name: string; desc: string; icon: string; unlocked: boolean; color: string }[]>([]);
  const [trophies, setTrophies] = useState<{ name: string; desc: string; icon: string; date: string }[]>([]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;

        const [{ data }, { data: achData }, { data: teamData }] = await Promise.all([
          sb.from("profiles").select("*").eq("id", user.id).single(),
          sb.from("achievements").select("*").eq("user_id", user.id),
          sb.from("fantasy_teams")
            .select("id, fantasy_team_players(player_id, is_starting, fantasy_team_id)")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = data as any;
          setProfile({ username: d.username, full_name: d.full_name ?? "", avatar_url: d.avatar_url, xp: d.xp, level: d.level, fantasy_points: d.fantasy_points, favorite_player: d.favorite_player ?? "", supporter_branch: d.supporter_branch ?? "", bio: d.bio ?? "" });
          setEditForm({ full_name: d.full_name ?? "", bio: d.bio ?? "", favorite_player: d.favorite_player ?? "", supporter_branch: d.supporter_branch ?? "" });
        }

        if (achData && achData.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setAchievements((achData as any[]).map((a: any) => ({ key: a.badge_key, name: a.badge_name, desc: a.badge_description, icon: a.badge_icon, unlocked: true, color: "text-sfc-blue" })));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setTrophies((achData as any[]).filter((a: any) => a.badge_key.startsWith("md_") || a.badge_key.startsWith("trophy_")).map((a: any) => ({ name: a.badge_name, desc: a.badge_description, icon: a.badge_icon, date: new Date(a.unlocked_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) })));
        }

        // Points history per matchday via player_match_stats for this team's starters
        if (teamData?.id) {
          const { data: history } = await sb
            .from("player_match_stats")
            .select("fantasy_points, matches(matchday)")
            .in("player_id", (teamData.fantasy_team_players ?? [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((p: any) => p.is_starting).map((p: any) => p.player_id))
            .order("matches(matchday)", { ascending: true });
          if (history && history.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const byMatchday: Record<number, number> = {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (history as any[]).forEach((r: any) => {
              const md: number = r.matches?.matchday ?? 0;
              byMatchday[md] = (byMatchday[md] ?? 0) + (r.fantasy_points ?? 0);
            });
            setPointsHistory(Object.entries(byMatchday).sort(([a],[b]) => Number(a)-Number(b)).map(([md, pts]) => ({ md: `MD${md}`, pts: pts as number })));
          }
        }
      } catch { /* show empty state */ }
    }
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows } = await (supabase as any)
          .from("profiles")
          .update(editForm)
          .eq("id", user.id)
          .select("id");
        if (!rows || rows.length === 0) {
          alert("Save failed — your session may have expired. Please refresh and try again.");
          setSaving(false);
          return;
        }
      }
      setEditOpen(false);
    } catch {
      alert("Save failed — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <TopBar title="My Profile" subtitle="Your Scottland Fantasy journey" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-7">
        {/* Profile Hero */}
        <div className="glass-card p-7">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-2xl border-2 border-sfc-blue/30 bg-slate-100 flex items-center justify-center overflow-hidden shadow-blue-glow">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-sfc-blue/60" />
                )}
              </div>
              <button className="absolute -bottom-2 -right-2 w-7 h-7 rounded-xl bg-sfc-blue border border-sfc-blue/50 flex items-center justify-center shadow-blue-glow">
                <Camera className="w-3 h-3 text-sfc-black" />
              </button>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-sfc-black">{profile.full_name}</h2>
                  <p className="text-sfc-blue font-medium">@{profile.username}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {profile.supporter_branch}</span>
                    <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Fav: {profile.favorite_player}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">{profile.bio}</p>
                </div>
                <button onClick={() => setEditOpen(true)} className="btn-outline text-xs flex items-center gap-1.5 py-2">
                  <Edit className="w-3 h-3" /> Edit Profile
                </button>
              </div>

              {/* Level & XP */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sfc-blue/10 border border-sfc-blue/20 shrink-0">
                    <Shield className="w-5 h-5 text-sfc-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-sfc-black">
                      Level {profile.level} &mdash; {getLevelTitle(profile.level)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Next: {getLevelTitle(profile.level + 1)} (Level {profile.level + 1})
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-sfc-blue">{profile.xp.toLocaleString()} XP earned</span>
                    <span className="text-muted-foreground">Goal: {getXPForNextLevel(profile.level).toLocaleString()} XP</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${xpPercent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-sfc-blue to-sfc-blue-light rounded-full"
                    />
                  </div>
                  <p className="text-right text-xs text-muted-foreground">
                    {Math.round(xpPercent)}% to Level {profile.level + 1}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard title="Total Points" value={profile.fantasy_points.toLocaleString()} icon={Zap} accentColor="green" />
          <StatsCard title="Level" value={`${profile.level}`} icon={Trophy} accentColor="gold" />
          <StatsCard title="XP Earned" value={profile.xp.toLocaleString()} icon={Star} accentColor="blue" />
          <StatsCard title="Achievements" value={`${achievements.length}`} icon={Award} accentColor="green" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Points History Chart */}
          <div className="col-span-1 xl:col-span-2 glass-card p-5">
            <h2 className="section-header mb-1">Points History</h2>
            <p className="section-subtitle mb-4">Your performance across all matchdays</p>
            {pointsHistory.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">No matchday data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={pointsHistory}>
                <defs>
                  <linearGradient id="ptsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="md" tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="pts" stroke="#1D4ED8" strokeWidth={2} fill="url(#ptsGrad)" dot={{ fill: "#1D4ED8", r: 3 }} activeDot={{ r: 5, fill: "#3B82F6" }} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>

          {/* Trophies */}
          <div className="glass-card p-6">
            <h2 className="text-base font-bold text-sfc-black mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" /> Trophy Cabinet
            </h2>
            {trophies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No trophies yet — keep competing!</p>
            ) : (
              <div className="space-y-3">
                {trophies.map((t) => (
                  <div key={t.name} className="flex items-center gap-4 p-4 rounded-xl bg-yellow-50 border border-yellow-200">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-sfc-black">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                      <p className="text-[10px] text-yellow-500 mt-0.5">{t.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Achievements */}
        {achievements.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="section-header mb-4">Achievements &amp; Badges</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {achievements.map((ach) => (
              <motion.div
                key={ach.key}
                whileHover={{ scale: 1.05 }}
                className={cn(
                  "p-5 rounded-xl border text-center transition-all",
                  ach.unlocked
                    ? "border-sfc-blue/20 bg-sfc-blue/5"
                    : "border-slate-200 bg-slate-100/20 opacity-40 grayscale"
                )}
              >
                <div className="text-3xl mb-2">{ach.icon}</div>
                <p className={cn("text-xs font-bold mb-1", ach.unlocked ? ach.color : "text-muted-foreground")}>{ach.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{ach.desc}</p>
                {ach.unlocked && (
                  <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-sfc-blue">
                    <Flame className="w-2.5 h-2.5" /> Unlocked
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {editOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-sfc-black">Edit Profile</h2>
                  <button onClick={() => setEditOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="label">Full Name</label>
                    <input type="text" value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="input" placeholder="Your full name" />
                  </div>
                  <div>
                    <label className="label">Favourite Player</label>
                    <input type="text" value={editForm.favorite_player}
                      onChange={(e) => setEditForm({ ...editForm, favorite_player: e.target.value })}
                      className="input" placeholder="e.g. Khama Billiat" />
                  </div>
                  <div>
                    <label className="label">Supporter Branch</label>
                    <select value={editForm.supporter_branch}
                      onChange={(e) => setEditForm({ ...editForm, supporter_branch: e.target.value })}
                      className="input">
                      {["Harare Central Branch","Bulawayo Branch","Mutare Branch","Gweru Branch","Masvingo Branch","Diaspora Branch","Online Supporter"].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Bio</label>
                    <textarea value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      rows={3} className="input resize-none" placeholder="Tell the community about yourself..." />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setEditOpen(false)} className="btn-outline flex-1 py-2.5">Cancel</button>
                  <button onClick={saveProfile} disabled={saving} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}