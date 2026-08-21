import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, Activity, Radio, Zap } from 'lucide-react';

interface DashboardViewProps {
  user: {
    username: string;
    tier: string;
  };
  onLogout: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ user, onLogout }) => {
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [ping, setPing] = useState(16);

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);

    const pingTimer = setInterval(() => {
      setPing(Math.floor(14 + Math.random() * 8));
    }, 3500);

    return () => {
      clearInterval(timer);
      clearInterval(pingTimer);
    };
  }, []);

  const formatSessionTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const modules = [
    { name: 'Apex Core V5', game: 'Apex Legends', status: 'UNDETECTED', build: 'v5.12.0', features: 'ESP + Aimbot + Radar' },
    { name: 'Phantom Strike', game: 'Counter-Strike 2', status: 'UNDETECTED', build: 'v2.8.4', features: 'Glow + Visuals + RCS' },
    { name: 'Shadow Protocol', game: 'Call of Duty: Warzone', status: 'UNDETECTED', build: 'v4.0.1', features: 'Stream Proof + Silent Aim' },
    { name: 'Vanguard Veil', game: 'Valorant Kernel bypass', status: 'PROTECTED', build: 'v1.9.9', features: 'Chams + Recoil Smoothing' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 relative z-10">
      {/* Top Bar for Session */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 p-4 rounded-2xl glass-panel cyber-card-border cyber-glow-purple">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-400/40 flex items-center justify-center text-purple-300">
            <ShieldCheck className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_#34d399]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-cyber font-bold text-white text-base tracking-wider">
                {user.username}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-tech font-bold tracking-wider bg-purple-900/60 text-purple-200 border border-purple-500/40">
                {user.tier}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs font-mono text-purple-300/70">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                HWID VALIDATED
              </span>
              <span>•</span>
              <span>SESSION: {formatSessionTime(sessionSeconds)}</span>
              <span>•</span>
              <span className="text-purple-400">PING: {ping}ms</span>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-tech font-bold text-xs tracking-wider uppercase bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-200 hover:text-white transition-all shadow-sm"
        >
          <LogOut className="w-4 h-4 text-purple-400" />
          <span>LOGOUT</span>
        </button>
      </div>

      {/* Main Client Hub Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: Client Status Summary */}
        <div className="space-y-4">
          <div className="rounded-2xl glass-panel cyber-card-border p-5">
            <h2 className="font-tech font-bold text-sm tracking-wider text-purple-200 uppercase mb-4 flex items-center justify-between">
              <span>SYSTEM METRICS</span>
              <Activity className="w-4 h-4 text-purple-400" />
            </h2>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1.5 border-b border-purple-500/10">
                <span className="text-zinc-400">Driver Status</span>
                <span className="text-emerald-400 font-bold">KERNEL ACTIVE</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-purple-500/10">
                <span className="text-zinc-400">Spoofer State</span>
                <span className="text-purple-300">AUTO-RANDOMIZED</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-purple-500/10">
                <span className="text-zinc-400">Hook Engine</span>
                <span className="text-purple-300">VMT / HOOKLESS</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-400">Server Node</span>
                <span className="text-purple-300">FRA-02-VIP</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl glass-panel cyber-card-border p-5">
            <h2 className="font-tech font-bold text-sm tracking-wider text-purple-200 uppercase mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4 text-purple-400" />
              <span>LIVE BROADCAST</span>
            </h2>
            <p className="text-xs text-purple-300/80 leading-relaxed font-sans">
              All client binaries synchronized with newest cloud patches. Zero detected instances reported across all active game nodes.
            </p>
          </div>
        </div>

        {/* Right Side: Available Modules */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl glass-panel cyber-card-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-tech font-bold text-base tracking-wider text-purple-100 uppercase flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <span>ACTIVE CLIENT PACKAGES</span>
              </h2>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-500/30">
                ALL SYSTEMS OPERATIONAL
              </span>
            </div>

            <div className="space-y-3">
              {modules.map((m, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 hover:border-purple-400/40 hover:bg-purple-950/30 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-cyber font-bold text-sm text-white">{m.name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-500/30">
                        {m.build}
                      </span>
                    </div>
                    <p className="text-xs text-purple-300/70 font-sans">
                      {m.game} • <span className="text-zinc-400">{m.features}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="px-2 py-1 text-[11px] font-mono font-semibold rounded bg-emerald-950/50 text-emerald-300 border border-emerald-500/30">
                      {m.status}
                    </span>
                    <button
                      className="px-3.5 py-1.5 rounded-lg text-xs font-tech font-bold tracking-wider uppercase bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.3)] transition-all"
                    >
                      INJECT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
