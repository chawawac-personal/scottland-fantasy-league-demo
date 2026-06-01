"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, AtSign, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function safeRedirect(next: string | null): string {
  if (!next) return "/dashboard";
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ identifier: "", password: "" });
  const router       = useRouter();
  const searchParams = useSearchParams();
  const nextPath     = safeRedirect(searchParams.get("next"));
  const authError    = searchParams.get("error") === "auth_failed"
    ? "Authentication failed. Please try signing in again."
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    const supabase = createClient();

    let email = form.identifier.trim();

    // Resolve username or phone → email via secure RPC
    if (!email.includes("@")) {
      const { data, error: rpcError } = await (supabase as any).rpc("resolve_login_identifier", { identifier: email });
      if (rpcError || !data) {
        setError("No account found. Check your details and try again.");
        setLoading(false);
        return;
      }
      email = data as string;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: form.password });
    if (signInError) {
      setError("Invalid credentials. Please try again.");
      setLoading(false);
      return;
    }
    router.push(nextPath);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sfc-blue to-sfc-blue-dark shadow-blue-glow mb-4">
          <Star className="w-7 h-7 text-white" />
        </div>
        <h1 className="font-display text-3xl text-sfc-black tracking-wider">WELCOME BACK</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in to Scottland Fantasy League</p>
      </div>
      {(error ?? authError) && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {error ?? authError}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Email, phone, or username</label>
          <div className="relative">
            <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              placeholder="email, +263 77…, or @username"
              required
              autoComplete="username"
              className="input pl-10"
            />
          </div>
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required className="input pl-10 pr-10" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
          {loading ? "Signing in..." : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-8">No account?{" "}<Link href="/register" className="text-sfc-blue hover:text-sfc-blue-dark font-semibold">Create one free</Link></p>
    </motion.div>
  );
}
