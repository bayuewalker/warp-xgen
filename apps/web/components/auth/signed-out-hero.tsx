"use client";

import { Terminal, Shield, Zap, Code2, Cloud, GitBranch, ArrowRight, Activity, TerminalSquare } from "lucide-react";
import { SignInButton } from "@/components/auth/sign-in-button";
import { GitHubLink } from "@/components/landing/github-link";

export function SignedOutHero() {
  return (
    <div className="warp-dark-theme text-white">
      <div className="warp-grid-bg" />
      <div className="warp-scanline" />

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-4 border-b border-[rgba(0,240,255,0.1)] bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <TerminalSquare className="w-6 h-6 text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
          <span className="warp-mono font-bold text-lg tracking-wider text-[#e0e0e0]">
            WARP<span className="text-[#00f0ff]">-</span>XGEN
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SignInButton size="sm" callbackUrl="/sessions" />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-24 px-6 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 z-[-1] opacity-40">
          <img
            src="/images/warp-hero-bg.png"
            alt="Warp Speed Code"
            className="w-full h-full object-cover object-top"
            style={{ maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)" }}
          />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] warp-mono text-xs mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f0ff] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f0ff]" />
          </span>
          v2.0 SYSTEM ONLINE
        </div>

        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 leading-tight warp-mono">
          Ship code at <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#39ff14] warp-text-glow">
            warp speed.
          </span>
        </h1>

        <p className="max-w-2xl text-gray-400 text-lg md:text-xl mb-10 leading-relaxed font-light">
          Deploy AI coding agents that write, test, and ship features autonomously.
          The ultimate command center for modern engineering teams.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <SignInButton size="lg" callbackUrl="/sessions" className="warp-glow-btn-primary px-8 py-4 rounded-sm warp-mono text-sm" />
          <GitHubLink size="lg" variant="outline">
            <Terminal className="w-4 h-4 mr-2" /> View Source
          </GitHubLink>
        </div>
      </section>

      {/* Stats Row */}
      <section className="relative z-10 border-y border-[rgba(0,240,255,0.1)] bg-black/40 backdrop-blur-sm py-6">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-[rgba(0,240,255,0.1)]">
          <div className="flex flex-col items-center py-2">
            <Activity className="w-5 h-5 text-[#39ff14] mb-2 drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]" />
            <span className="warp-mono text-2xl font-bold text-white mb-1">∞</span>
            <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">Runs infinitely</span>
          </div>
          <div className="flex flex-col items-center py-2">
            <Zap className="w-5 h-5 text-[#00f0ff] mb-2 drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]" />
            <span className="warp-mono text-2xl font-bold text-white mb-1">0ms</span>
            <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">Zero setup</span>
          </div>
          <div className="flex flex-col items-center py-2">
            <GitBranch className="w-5 h-5 text-[#00f0ff] mb-2 drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]" />
            <span className="warp-mono text-2xl font-bold text-white mb-1">ANY</span>
            <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">Any repository</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 warp-mono text-[#00f0ff]">&gt; SYSTEM_CAPABILITIES</h2>
          <div className="w-24 h-1 bg-gradient-to-r from-[#00f0ff] to-transparent mx-auto" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="warp-card p-8 rounded-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f0ff] rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity" />
            <Cloud className="w-10 h-10 text-[#00f0ff] mb-6" />
            <h3 className="text-xl font-bold mb-3 warp-mono">Cloud Sandbox</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Instant, secure, isolated environments tailored for AI execution. Never worry about local dependencies again.
            </p>
            <span className="warp-mono text-[#00f0ff] text-xs flex items-center gap-1">
              EXPLORE SANDBOXES <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          <div className="warp-card p-8 rounded-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#39ff14] rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity" />
            <Shield className="w-10 h-10 text-[#39ff14] mb-6" />
            <h3 className="text-xl font-bold mb-3 warp-mono">Durable Workflows</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Long-running processes that survive disconnects, timeouts, and system restarts. Resilient by default.
            </p>
            <span className="warp-mono text-[#39ff14] text-xs flex items-center gap-1">
              VIEW ARCHITECTURE <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          <div className="warp-card p-8 rounded-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f0ff] rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity" />
            <Code2 className="w-10 h-10 text-[#00f0ff] mb-6" />
            <h3 className="text-xl font-bold mb-3 warp-mono">AI Coding Agent</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Context-aware intelligence that understands your entire codebase, submits PRs, and handles code review.
            </p>
            <span className="warp-mono text-[#00f0ff] text-xs flex items-center gap-1">
              MEET THE AGENT <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </section>

      {/* Terminal Mockup */}
      <section className="relative z-10 py-12 px-6 max-w-5xl mx-auto mb-24">
        <div className="rounded-lg border border-[rgba(0,240,255,0.2)] bg-[#050505] shadow-[0_0_30px_rgba(0,240,255,0.05)] overflow-hidden">
          <div className="flex items-center px-4 py-2 border-b border-[rgba(0,240,255,0.1)] bg-[#0a0a0a]">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <div className="mx-auto warp-mono text-xs text-gray-500">root@warp-xgen:~</div>
          </div>
          <div className="p-6 warp-mono text-sm text-gray-300 leading-relaxed font-mono">
            <div className="flex items-center text-[#00f0ff]">
              <span className="mr-2">❯</span>
              <span>warp init --repo nextjs-dashboard</span>
            </div>
            <div className="text-gray-500 mt-1 mb-4">Initializing AI workflow in nextjs-dashboard...</div>
            <div className="flex items-center text-[#00f0ff]">
              <span className="mr-2">❯</span>
              <span>warp agent spawn --task &quot;implement stripe checkout&quot;</span>
            </div>
            <div className="text-gray-500 mt-1">Analyzing codebase...</div>
            <div className="text-[#39ff14] mt-1">[OK] Found Stripe SDK</div>
            <div className="text-[#39ff14] mt-1">[OK] Identified checkout route</div>
            <div className="text-gray-500 mt-1 animate-pulse">Writing implementation...</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[rgba(0,240,255,0.1)] bg-black/80 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <TerminalSquare className="w-5 h-5 text-gray-500" />
            <span className="warp-mono font-bold text-sm tracking-wider text-gray-400">WARP-XGEN</span>
          </div>
          <div className="text-xs text-gray-600 warp-mono flex flex-col md:flex-row gap-4 md:gap-8 text-center">
            <span>© {new Date().getFullYear()} Warp Systems Inc.</span>
            <div className="flex gap-4 justify-center">
              <a href="#" className="hover:text-[#00f0ff] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#00f0ff] transition-colors">Terms</a>
              <GitHubLink size="sm" variant="ghost">GitHub</GitHubLink>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
