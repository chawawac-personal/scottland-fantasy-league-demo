"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, User, Phone, ArrowRight } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

function syntheticEmail(phone: string): string {
  return `${phone.replace(/\D/g, "")}@sfc.internal`;
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", username: "", full_name: "", phone: "" });
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null); setNotice(null);

    if (!form.email && !form.phone) {
      setError("Please provide an email address or phone number.");
      setLoading(false);
      return;
    }

    const authEmail = form.email || syntheticEmail(form.phone);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: form.password,
      options: { data: { username: form.username.slice(0, 30), full_name: form.full_name.slice(0, 100), phone: form.phone.slice(0, 20) } },
    });
    if (error) {
      const msg =
        error.message.toLowerCase().includes("password")
          ? "Password must be at least 6 characters."
          : "Unable to create account. Please try again.";
      setError(msg);
      setLoading(false);
      return;
    }
    if (!data.user?.identities || data.user.identities.length === 0) {
      setNotice("An account with these details already exists.");
      setLoading(false);
      return;
    }
    router.push("/privacy?from=onboarding");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="mb-4">
          <Image src="/logo.png" alt="Scottland FC" width={96} height={96} className="object-contain mx-auto" priority />
        </div>
        <h1 className="font-display text-3xl text-sfc-black tracking-wider">JOIN THE LEAGUE</h1>
        <p className="text-sm text-muted-foreground mt-1">Create your Scottland Fantasy account</p>
      </div>
      {error  && <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
      {notice && (
        <div className="mb-5 p-3.5 rounded-xl bg-sfc-blue/5 border border-sfc-blue/20 text-sfc-black text-sm">
          {notice}{" "}
          <Link href="/login" className="text-sfc-blue font-semibold hover:underline">Sign in instead →</Link>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name</label>
            <div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Tendai Moyo" required className="input pl-10" /></div>
          </div>
          <div>
            <label className="label">Username</label>
            <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span><input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="sfc_manager" required className="input pl-8" /></div>
          </div>
        </div>
        <div>
          <label className="label">Email <span className="text-muted-foreground font-normal">(optional if phone provided)</span></label>
          <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="manager@scottlandfc.zw" className="input pl-10" /></div>
        </div>
        <div>
          <label className="label">Phone Number <span className="text-muted-foreground font-normal">(optional if email provided)</span></label>
          <div className="relative"><Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+263 77 123 4567" className="input pl-10" /></div>
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required minLength={6} className="input pl-10" /></div>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          By creating an account you agree to the{" "}
          <Link href="/privacy" target="_blank" className="text-sfc-blue hover:underline font-medium">Privacy Policy</Link>
          {" "}of OMNI Global.
        </p>
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
          {loading ? "Creating account..." : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-8">Already have an account?{" "}<Link href="/login" className="text-sfc-blue hover:text-sfc-blue-dark font-semibold">Sign in</Link></p>
    </motion.div>
  );
}
