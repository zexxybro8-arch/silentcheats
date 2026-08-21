import { useState, useEffect, FC } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  Sliders, 
  User, 
  LogOut, 
  ChevronDown, 
  Crosshair, 
  Minimize2, 
  Maximize2, 
  Sparkles, 
  Check, 
  Zap, 
  Target
} from 'lucide-react';
import { dbService, UserConfig } from '../services/dbService';

interface DashboardViewProps {
  user: {
    username: string;
    tier: string;
  };
  onLogout: () => void;
}

type TabType = 'features' | 'esp' | 'config' | 'account';

export const DashboardView: FC<DashboardViewProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('features');
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedMode, setSelectedMode] = useState('Stealth Mode (Recommended)');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  // AIM CONTROL State
  const [aimbot, setAimbot] = useState(true);
  const [aimbotRage, setAimbotRage] = useState(false);
  const [aimbotSilent, setAimbotSilent] = useState(true);
  const [silentTarget, setSilentTarget] = useState<'BODY' | 'HEAD'>('HEAD');
  const [aimFov, setAimFov] = useState(65);
  const [headshotRate, setHeadshotRate] = useState(85);

  // SAFE MODE State
  const [safeMode, setSafeMode] = useState(true);

  // ESP Toggles State
  const [espState, setEspState] = useState({
    boxEsp: true,
    skeletonTracking: true,
    healthBar: true,
    distanceDisplay: true,
    snaplines: false,
  });

  // Config Sliders State
  const [configState, setConfigState] = useState({
    smoothFactor: 6.5,
    fovRadius: 75,
    targetBone: 'Head / Neck',
    crosshairOverlay: true,
    streamProof: true,
  });

  // Load config from Firestore on mount
  useEffect(() => {
    let isMounted = true;
    dbService.getUserConfig(user.username).then((savedConfig) => {
      if (savedConfig && isMounted) {
        if (typeof savedConfig.aimbot === 'boolean') setAimbot(savedConfig.aimbot);
        if (typeof savedConfig.aimbotRage === 'boolean') setAimbotRage(savedConfig.aimbotRage);
        if (typeof savedConfig.aimbotSilent === 'boolean') setAimbotSilent(savedConfig.aimbotSilent);
        if (savedConfig.silentTarget) setSilentTarget(savedConfig.silentTarget);
        if (typeof savedConfig.aimFov === 'number') setAimFov(savedConfig.aimFov);
        if (typeof savedConfig.headshotRate === 'number') setHeadshotRate(savedConfig.headshotRate);
        if (typeof savedConfig.safeMode === 'boolean') setSafeMode(savedConfig.safeMode);
        if (savedConfig.espState) setEspState(savedConfig.espState);
        if (savedConfig.configState) setConfigState(savedConfig.configState);
        if (savedConfig.selectedMode) setSelectedMode(savedConfig.selectedMode);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user.username]);

  // Sync back changes to Firestore database
  useEffect(() => {
    const currentConfig: UserConfig = {
      aimbot,
      aimbotRage,
      aimbotSilent,
      silentTarget,
      aimFov,
      headshotRate,
      safeMode,
      espState,
      configState,
      selectedMode,
    };
    const timer = setTimeout(() => {
      dbService.saveUserConfig(user.username, currentConfig);
    }, 500);
    return () => clearTimeout(timer);
  }, [
    user.username,
    aimbot,
    aimbotRage,
    aimbotSilent,
    silentTarget,
    aimFov,
    headshotRate,
    safeMode,
    espState,
    configState,
    selectedMode,
  ]);

  const toggleEsp = (key: keyof typeof espState) => {
    setEspState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const modes = [
    'Stealth Mode (Recommended)',
    'Competitive Safe v3.2',
    'Stream Proof Overlay',
    'Legit Assist Pro',
  ];

  // Minimized Floating HUD Pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50 animate-bounce-subtle">
        <button
          onClick={() => setIsMinimized(false)}
          className="group flex items-center gap-2.5 px-3.5 py-2 rounded-full glass-panel cyber-card-border cyber-glow-purple bg-[#0d061c]/95 text-white hover:border-purple-400 transition-all duration-300 shadow-2xl cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-[#0c051a] border border-purple-400/50 flex items-center justify-center overflow-hidden p-0.5 shadow-[0_0_8px_#a855f7]">
            <img
              src="https://i.ibb.co/LXMBFV36/file-00000000b7fc8211bcf2c107760ddfb3.png"
              alt="Silent Cheats Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div className="text-left pr-1">
            <div className="font-cyber text-[11px] font-bold tracking-wider text-purple-200 group-hover:text-white transition-colors">
              SAFE MENU
            </div>
            <div className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              ACTIVE
            </div>
          </div>
          <Maximize2 className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-200 transition-colors ml-0.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[440px] mx-auto px-3 py-2 sm:py-4 relative z-10">
      
      {/* 1. TOP HEADER (Slim & Compact) */}
      <header className="rounded-xl glass-panel cyber-card-border cyber-glow-purple px-3.5 py-2 mb-2 flex items-center justify-between transition-all">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-7 h-7 rounded-full bg-[#0c051a] border border-purple-400/40 p-0.5 flex items-center justify-center shadow-[0_0_8px_rgba(168,85,247,0.3)] overflow-hidden shrink-0">
            <img
              src="https://i.ibb.co/LXMBFV36/file-00000000b7fc8211bcf2c107760ddfb3.png"
              alt="Silent Cheats"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-cyber text-sm font-bold tracking-wider text-white cyber-text-glow">
              SILENT CHEATS
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_5px_#34d399]" />
              ONLINE
            </span>
          </div>
        </div>

        {/* Right: Account & Exit */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-purple-950/40 border border-purple-500/20">
            <User className="w-3 h-3 text-purple-400" />
            <span className="font-tech font-bold text-[11px] text-purple-200 uppercase">
              {user.username}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/20 text-purple-300 hover:text-white transition-all text-[11px] font-tech font-bold tracking-wider uppercase flex items-center gap-1 cursor-pointer"
            title="Disconnect & Return to Login"
          >
            <LogOut className="w-3 h-3 text-purple-400" />
          </button>
        </div>
      </header>

      {/* 2. STATUS BAR */}
      <div className="rounded-lg glass-input border border-purple-500/20 px-3 py-1.5 mb-2 flex items-center justify-between text-[11px] font-tech font-bold tracking-wider">
        <div className="flex items-center gap-1.5 text-purple-100">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          <span className="uppercase tracking-wide">SAFE MODE</span>
        </div>

        <div className="flex items-center gap-1.5 text-emerald-300 font-mono text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
          <span>ONLINE</span>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="rounded-lg glass-panel cyber-card-border p-1 mb-2 grid grid-cols-4 gap-1">
        {(['features', 'esp', 'config', 'account'] as TabType[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative py-1.5 rounded-md font-tech font-bold text-[11px] sm:text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                isActive
                  ? 'text-white bg-purple-900/40 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
                  : 'text-purple-300/60 hover:text-purple-200 hover:bg-purple-950/30'
              }`}
            >
              {tab === 'features' && <Zap className={`w-3 h-3 ${isActive ? 'text-purple-300' : 'text-purple-400/60'}`} />}
              {tab === 'esp' && <Crosshair className={`w-3 h-3 ${isActive ? 'text-purple-300' : 'text-purple-400/60'}`} />}
              {tab === 'config' && <Sliders className={`w-3 h-3 ${isActive ? 'text-purple-300' : 'text-purple-400/60'}`} />}
              {tab === 'account' && <User className={`w-3 h-3 ${isActive ? 'text-purple-300' : 'text-purple-400/60'}`} />}
              <span>{tab}</span>

              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[1.5px] bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_6px_#c084fc]" />
              )}
            </button>
          );
        })}
      </div>

      {/* 4. MAIN FUNCTION PANEL: SAFE MENU */}
      <div className="rounded-xl glass-panel cyber-card-border cyber-glow-purple p-3 sm:p-4 shadow-xl backdrop-blur-2xl transition-all">
        
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-purple-500/15">
          <div className="flex items-center gap-2">
            <h2 className="font-cyber font-bold text-sm sm:text-base text-white cyber-text-glow tracking-wider uppercase">
              SAFE MENU
            </h2>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
              PROTECTED
            </span>
          </div>

          <span className="text-[10px] font-tech font-semibold text-purple-300/60 uppercase">
            TAB: <span className="text-purple-200 font-bold">{activeTab}</span>
          </span>
        </div>

        {/* TAB 1: FEATURES (AIM CONTROL + SAFE MODE) */}
        {activeTab === 'features' && (
          <div className="space-y-2.5">
            
            {/* AIM CONTROL Header */}
            <div className="flex items-center gap-1.5 pb-0.5 border-b border-purple-500/10">
              <Target className="w-3.5 h-3.5 text-purple-400" />
              <h3 className="font-tech font-bold text-[11px] tracking-widest text-purple-300 uppercase">
                AIM CONTROL
              </h3>
            </div>

            {/* 1. AIMBOT */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                AIMBOT
              </span>
              <ToggleSwitch
                checked={aimbot}
                onChange={() => setAimbot(!aimbot)}
              />
            </div>

            {/* 2. AIMBOT RAGE */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                AIMBOT RAGE
              </span>
              <ToggleSwitch
                checked={aimbotRage}
                onChange={() => setAimbotRage(!aimbotRage)}
              />
            </div>

            {/* 3. AIMBOT SILENT & BODY/HEAD SELECTOR */}
            <div className="px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-all space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                  AIMBOT SILENT
                </span>
                <ToggleSwitch
                  checked={aimbotSilent}
                  onChange={() => setAimbotSilent(!aimbotSilent)}
                />
              </div>

              {/* Segmented Control for BODY and HEAD */}
              {aimbotSilent && (
                <div className="pt-1.5 border-t border-purple-500/15 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-tech font-bold text-purple-300/80 tracking-wider uppercase">
                    TARGET:
                  </span>
                  
                  <div className="flex p-0.5 rounded-lg bg-[#090314] border border-purple-500/30 w-36 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setSilentTarget('BODY')}
                      className={`flex-1 py-1 px-2 rounded-md text-[11px] font-tech font-bold tracking-wider transition-all duration-200 uppercase cursor-pointer ${
                        silentTarget === 'BODY'
                          ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-[0_0_8px_rgba(168,85,247,0.5)] border border-purple-400/40'
                          : 'text-purple-300/60 hover:text-purple-100'
                      }`}
                    >
                      BODY
                    </button>
                    <button
                      type="button"
                      onClick={() => setSilentTarget('HEAD')}
                      className={`flex-1 py-1 px-2 rounded-md text-[11px] font-tech font-bold tracking-wider transition-all duration-200 uppercase cursor-pointer ${
                        silentTarget === 'HEAD'
                          ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-[0_0_8px_rgba(168,85,247,0.5)] border border-purple-400/40'
                          : 'text-purple-300/60 hover:text-purple-100'
                      }`}
                    >
                      HEAD
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. AIM FOV Slider */}
            <div className="px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-tech font-bold text-xs text-white uppercase tracking-wide">
                  AIM FOV
                </span>
                <span className="font-mono text-[11px] font-bold text-purple-200 bg-purple-900/60 px-2 py-0.2 rounded border border-purple-500/30">
                  {aimFov}
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={aimFov}
                  onChange={(e) => setAimFov(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#090314] rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 5. HEADSHOT RATE Slider */}
            <div className="px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-tech font-bold text-xs text-white uppercase tracking-wide">
                  HEADSHOT RATE
                </span>
                <span className="font-mono text-[11px] font-bold text-purple-200 bg-purple-900/60 px-2 py-0.2 rounded border border-purple-500/30">
                  {headshotRate}%
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={headshotRate}
                  onChange={(e) => setHeadshotRate(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#090314] rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* SAFE MODE Section */}
            <div className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center justify-between ${
              safeMode 
                ? 'bg-gradient-to-r from-purple-950/40 via-emerald-950/20 to-purple-950/30 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                : 'bg-purple-950/20 border border-purple-500/20'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                  safeMode
                    ? 'bg-emerald-950/70 border border-emerald-400/50 text-emerald-300 shadow-[0_0_6px_#34d399]'
                    : 'bg-purple-950/60 border border-purple-700 text-purple-400/60'
                }`}>
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-tech font-bold text-xs text-white tracking-wider uppercase">
                    SAFE MODE
                  </span>
                  {safeMode && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-400/50">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      PROTECTED
                    </span>
                  )}
                </div>
              </div>
              
              <ToggleSwitch
                checked={safeMode}
                onChange={() => setSafeMode(!safeMode)}
              />
            </div>

          </div>
        )}

        {/* TAB 2: ESP */}
        {activeTab === 'esp' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                2D Box ESP
              </span>
              <ToggleSwitch
                checked={espState.boxEsp}
                onChange={() => toggleEsp('boxEsp')}
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                Skeleton Tracking
              </span>
              <ToggleSwitch
                checked={espState.skeletonTracking}
                onChange={() => toggleEsp('skeletonTracking')}
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                Health & Shield Bar
              </span>
              <ToggleSwitch
                checked={espState.healthBar}
                onChange={() => toggleEsp('healthBar')}
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                Distance Display
              </span>
              <ToggleSwitch
                checked={espState.distanceDisplay}
                onChange={() => toggleEsp('distanceDisplay')}
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                Snaplines
              </span>
              <ToggleSwitch
                checked={espState.snaplines}
                onChange={() => toggleEsp('snaplines')}
              />
            </div>
          </div>
        )}

        {/* TAB 3: CONFIG */}
        {activeTab === 'config' && (
          <div className="space-y-2.5">
            <div className="px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-tech font-bold text-xs text-white uppercase">Smoothing Factor</span>
                <span className="font-mono text-[11px] text-purple-300 font-semibold">{configState.smoothFactor.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={configState.smoothFactor}
                onChange={(e) => setConfigState({ ...configState, smoothFactor: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-[#090314] rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-tech font-bold text-xs text-white uppercase">Field of View (FOV)</span>
                <span className="font-mono text-[11px] text-purple-300 font-semibold">{configState.fovRadius}°</span>
              </div>
              <input
                type="range"
                min="30"
                max="180"
                step="5"
                value={configState.fovRadius}
                onChange={(e) => setConfigState({ ...configState, fovRadius: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-[#090314] rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 flex items-center justify-between">
              <span className="font-tech font-bold text-xs text-white uppercase">Target Bone</span>
              <select
                value={configState.targetBone}
                onChange={(e) => setConfigState({ ...configState, targetBone: e.target.value })}
                className="px-2.5 py-1 rounded bg-[#090314] border border-purple-500/40 text-purple-200 text-[11px] font-tech font-bold uppercase focus:outline-none focus:border-purple-400"
              >
                <option value="Head / Neck">Head / Neck</option>
                <option value="Chest Center">Chest Center</option>
                <option value="Pelvis / Core">Pelvis / Core</option>
                <option value="Closest Bone">Closest Bone</option>
              </select>
            </div>
          </div>
        )}

        {/* TAB 4: ACCOUNT */}
        {activeTab === 'account' && (
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-500/20 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/15">
                <span className="text-[11px] font-tech font-bold text-purple-300/80 uppercase">USER</span>
                <span className="text-xs font-mono font-bold text-white">{user.username}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/15">
                <span className="text-[11px] font-tech font-bold text-purple-300/80 uppercase">TIER</span>
                <span className="text-[10px] font-mono text-purple-300 bg-purple-900/60 px-2 py-0.2 rounded border border-purple-500/30">VIP UNLIMITED</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/15">
                <span className="text-[11px] font-tech font-bold text-purple-300/80 uppercase">HARDWARE</span>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" /> HWID MATCHED
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-tech font-bold text-purple-300/80 uppercase">PROTOCOL</span>
                <span className="text-[10px] font-mono text-purple-300">KERNEL RING-0</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. CONTROL AREA */}
        <div className="mt-3 pt-2.5 border-t border-purple-500/15 space-y-2.5">
          
          {/* Selected Mode Dropdown */}
          <div className="space-y-1">
            <label className="block text-[10px] font-tech font-bold tracking-wider text-purple-200/90 uppercase">
              Selected Mode
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg glass-input border border-purple-500/30 text-white text-xs font-tech font-bold tracking-wide uppercase hover:border-purple-400/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">{selectedMode}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-purple-400 shrink-0 transition-transform duration-200 ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isModeDropdownOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg glass-panel border border-purple-400/40 bg-[#0e061e] shadow-2xl z-30 overflow-hidden py-1">
                  {modes.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setSelectedMode(mode);
                        setIsModeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[11px] font-tech font-bold uppercase tracking-wider flex items-center justify-between transition-colors cursor-pointer ${
                        selectedMode === mode
                          ? 'bg-purple-900/60 text-purple-100'
                          : 'text-purple-300/70 hover:bg-purple-950/40 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{mode}</span>
                      {selectedMode === mode && <Check className="w-3 h-3 text-purple-300 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: HIDE and CLOSE */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsMinimized(true)}
              className="group relative overflow-hidden rounded-lg py-2 px-3 font-tech font-bold text-xs tracking-widest text-purple-200 bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/30 hover:border-purple-400/60 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(168,85,247,0.1)] cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
              <span>HIDE</span>
            </button>

            <button
              onClick={onLogout}
              className="group relative overflow-hidden rounded-lg py-2 px-3 font-tech font-bold text-xs tracking-widest text-white bg-gradient-to-r from-purple-700 via-violet-700 to-fuchsia-700 hover:from-purple-600 hover:via-violet-600 hover:to-fuchsia-600 border border-purple-400/40 active:scale-[0.98] shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(192,132,252,0.45)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-white group-hover:translate-x-0.5 transition-transform" />
              <span>CLOSE</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};

// Reusable Modern Compact Toggle Switch Component
interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

const ToggleSwitch: FC<ToggleSwitchProps> = ({ checked, onChange, disabled = false }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
        checked
          ? 'bg-purple-600 shadow-[0_0_10px_rgba(168,85,247,0.7)] border border-purple-400/70'
          : 'bg-zinc-800/90 border border-zinc-700'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        } mt-0.2`}
      />
    </button>
  );
};
