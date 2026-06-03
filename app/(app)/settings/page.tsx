"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Bell, Shield, Palette, Save, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_SETTINGS = {
  notifications: {
    matchReminders:    true,
    transferDeadlines: true,
    goalAlerts:        true,
    leagueInvites:     true,
    rewardUnlocks:     true,
    weeklyDigest:      true,
  },
  display: {
    compactMode:      false,
    showAnimations:   true,
    showPlayerImages: true,
    showFormGuide:    true,
  },
};

type Settings = typeof DEFAULT_SETTINGS;

const NOTIF_LABELS: Record<string, { label: string; desc: string }> = {
  matchReminders:    { label: "Match Reminders",         desc: "Get notified 1 hour before kickoff" },
  transferDeadlines: { label: "Transfer Deadline Alerts", desc: "Alerts when transfer window closes" },
  goalAlerts:        { label: "Live Goal Alerts",         desc: "Instant alerts for your players' goals" },
  leagueInvites:     { label: "League Invitations",       desc: "Notify when someone invites you" },
  rewardUnlocks:     { label: "Achievement Unlocks",      desc: "Celebrate when you earn a badge" },
  weeklyDigest:      { label: "Weekly Digest",            desc: "Summary of your performance each week" },
};

const DISPLAY_LABELS: Record<string, { label: string; desc: string }> = {
  compactMode:      { label: "Compact Mode",      desc: "Tighter spacing to see more at once" },
  showAnimations:   { label: "Show Animations",   desc: "Smooth transitions and motion effects" },
  showPlayerImages: { label: "Player Images",     desc: "Show player photo cards on the pitch" },
  showFormGuide:    { label: "Form Colour Guide", desc: "Colour-code form ratings in the market" },
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "relative w-11 h-6 rounded-full border transition-all shrink-0",
        value ? "bg-sfc-blue/20 border-sfc-blue/40" : "bg-slate-100 border-slate-200"
      )}
    >
      <div className={cn(
        "absolute top-0.5 w-5 h-5 rounded-full transition-all shadow-sm",
        value ? "left-5 bg-sfc-blue" : "left-0.5 bg-slate-300"
      )} />
    </button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pwSent, setPwSent]     = useState(false);

  // Load settings from Supabase on mount
  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("user_settings")
          .select("notifications, display")
          .eq("user_id", user.id)
          .single();

        if (data) {
          setSettings({
            notifications: { ...DEFAULT_SETTINGS.notifications, ...(data.notifications ?? {}) },
            display:       { ...DEFAULT_SETTINGS.display,       ...(data.display ?? {}) },
          });
        }
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  function updateNotification(key: string, value: boolean) {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
  }

  function updateDisplay(key: string, value: boolean) {
    setSettings(prev => ({
      ...prev,
      display: { ...prev.display, [key]: value },
    }));
  }

  async function changePassword() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setPwSent(true);
      setTimeout(() => setPwSent(false), 4000);
    } catch { /* silently fail */ }
  }

  async function downloadData() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [{ data: profile }, { data: team }, { data: notifs }] = await Promise.all([
        sb.from("profiles").select("*").eq("id", user.id).single(),
        sb.from("fantasy_teams").select("*, fantasy_team_players(*)").eq("user_id", user.id).single(),
        sb.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      const blob = new Blob([JSON.stringify({ profile, team, notifications: notifs }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sfl-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silently fail */ }
  }

  async function deleteAccount() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch { setDeleting(false); }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("user_settings")
        .upsert({
          user_id:       user.id,
          notifications: settings.notifications,
          display:       settings.display,
          updated_at:    new Date().toISOString(),
        }, { onConflict: "user_id" });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* silently fail */ }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar title="Settings" subtitle="Configure your experience" />
        <div className="p-8 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-sfc-blue border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Settings" subtitle="Configure your experience" />

      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl space-y-6">

        {/* Notification Preferences */}
        <div className="glass-card p-7">
          <h2 className="font-bold text-sfc-black mb-5 flex items-center gap-2">
            <Bell className="w-4 h-4 text-sfc-blue" /> Notification Preferences
          </h2>
          <div className="space-y-4">
            {Object.entries(settings.notifications).map(([key, value]) => {
              const meta = NOTIF_LABELS[key];
              return (
                <div key={key} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-sfc-black">{meta?.label ?? key}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta?.desc}</p>
                  </div>
                  <Toggle value={value} onChange={v => updateNotification(key, v)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Display Preferences */}
        <div className="glass-card p-7">
          <h2 className="font-bold text-sfc-black mb-5 flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-400" /> Display Preferences
          </h2>
          <div className="space-y-4">
            {Object.entries(settings.display).map(([key, value]) => {
              const meta = DISPLAY_LABELS[key];
              return (
                <div key={key} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-sfc-black">{meta?.label ?? key}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta?.desc}</p>
                  </div>
                  <Toggle value={value} onChange={v => updateDisplay(key, v)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Security */}
        <div className="glass-card p-7">
          <h2 className="font-bold text-sfc-black mb-5 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" /> Account Security
          </h2>
          <div className="space-y-3">
            <button onClick={changePassword} className="btn-outline w-full text-sm py-2.5">
              {pwSent ? "✓ Reset link sent to your email" : "Change Password"}
            </button>
            <button onClick={downloadData} className="btn-outline w-full text-sm py-2.5 text-muted-foreground">
              Download My Data
            </button>
            {!deleteConfirm ? (
              <button onClick={deleteAccount} className="w-full text-sm py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                Delete Account
              </button>
            ) : (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 space-y-3">
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  This will sign you out. Your data stays in the DB — contact an admin to fully remove it.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteConfirm(false)} className="btn-outline text-sm py-2 px-4 flex-1">Cancel</button>
                  <button onClick={deleteAccount} disabled={deleting} className="flex-1 text-sm py-2 px-4 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">
                    {deleting ? "Signing out…" : "Yes, sign me out"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className={cn(
            "btn-primary flex items-center gap-2 py-2.5 px-6 transition-all disabled:opacity-60",
            saved && "bg-emerald-600 border-emerald-600"
          )}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : saved ? "Settings Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
