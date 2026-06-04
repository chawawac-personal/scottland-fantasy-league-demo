"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Trophy, Zap, Users, ChevronRight, Shield } from "lucide-react";

const features = [
  { icon: Trophy, title: "Fantasy Leagues", desc: "Build your perfect squad and compete with fans across Zimbabwe" },
  { icon: Zap, title: "Live Matchday", desc: "Real-time points, live match events, and dynamic leaderboards" },
  { icon: Users, title: "Fan Community", desc: "Vote in fan polls and have your say" },
  { icon: Trophy, title: "Gamification", desc: "Earn XP, unlock badges, and climb the levels from Rookie to Legend" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 pitch-bg opacity-20" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[min(800px,100vw)] h-[min(800px,100vw)] bg-sfc-blue/4 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 lg:px-10 py-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Scottland FC" width={44} height={44} className="object-contain" priority />
          <div>
            <p className="font-display text-xl text-sfc-black tracking-wider">SCOTTLAND</p>
            <p className="text-[10px] text-sfc-blue font-medium tracking-widest">FANTASY LEAGUE</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-sfc-black transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-16 sm:pt-24 lg:pt-28 pb-16 sm:pb-24 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sfc-blue/10 border border-sfc-blue/20 text-sfc-blue text-sm font-medium mb-8">
            <Shield className="w-4 h-4" />
            Made for Scottland FC Supporters
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display tracking-wider text-sfc-black mb-4">
            SCOTTLAND
            <br />
            <span className="text-gradient-blue">FANTASY LEAGUE</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
            Build your dream squad from Scottland FC&apos;s finest. Compete with fans across Zimbabwe.
            Live points, real stats, pure passion.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/register" className="btn-primary flex items-center gap-2 text-base px-8 py-3">
              Build Your Team <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn-outline flex items-center gap-2 text-base">
              Sign In
            </Link>
          </div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-24 grid grid-cols-2 sm:grid-cols-4 gap-5 max-w-3xl mx-auto"
        >
          {[
            { value: "15", label: "Active Managers" },
            { value: "18", label: "Scottland FC Players" },
            { value: "15", label: "Matchdays Played" },
            { value: "Zimbabwe", label: "#1 Fan League" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-6 text-center">
              <p className="text-2xl font-display text-sfc-blue tracking-wider">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 py-16 sm:py-20 lg:py-24">
        <h2 className="text-4xl font-display text-center text-sfc-black tracking-wider mb-12">
          THE FULL EXPERIENCE
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-7"
            >
              <div className="w-12 h-12 rounded-xl bg-sfc-blue/10 border border-sfc-blue/20 flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-sfc-blue" />
              </div>
              <h3 className="font-bold text-sfc-black mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; 2026 Scottland Fantasy League &mdash; For Scottland FC Supporters in Zimbabwe
          {" · "}
          <a href="/privacy" className="hover:text-sfc-blue transition-colors">Privacy Policy</a>
        </p>
      </footer>
    </div>
  );
}