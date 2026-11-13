import { useState, useEffect, FC, FormEvent, ChangeEvent } from 'react';
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
  Target,
  Eye,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Headphones
} from 'lucide-react';
import { dbService, AuthUser } from '../services/dbService';

interface DashboardViewProps {
  user: AuthUser;
  onLogout: () => void;
  onPassVerified?: () => void;
  onUserSync?: (patch: Partial<AuthUser>) => void;
}

type TabType = 'features' | 'esp' | 'config' | 'account';

export const DashboardView: FC<DashboardViewProps> = ({
  user,
  onLogout,
  onPassVerified,
  onUserSync,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('features');
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedMode, setSelectedMode] = useState('Stealth Mode (Recommended)');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Pass verification modal state
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);

  const requiresPassVerification =
    user.passVerificationRequired !== undefined
      ? user.passVerificationRequired
      : user.username === 'USER-81455' || user.passVerified === false;
  const isPassVerified = user.passVerified === true;
  const isSpecialUser = requiresPassVerification;
  const isSpecialAccount = requiresPassVerification && !isPassVerified;

  // Sync pass verification & account active status via backend + real-time Firestore listener
  useEffect(() => {
    let active = true;

    dbService.getPassStatus(user.username).then((res) => {
      if (!active) return;
      if (!res.exists) {
        onLogout();
        return;
      }
      const statusData = res.data;
      if (!statusData) return;

      if (statusData.status === 'INACTIVE') {
        onLogout();
        return;
      }

      if (
        statusData.passVerified !== user.passVerified ||
        statusData.passVerificationRequired !== user.passVerificationRequired ||
        statusData.tier !== user.tier ||
        statusData.status !== user.status
      ) {
        onUserSync?.({
          passVerified: statusData.passVerified,
          passVerificationRequired: statusData.passVerificationRequired,
          status: statusData.status,
          tier: statusData.tier,
        });
      }
    });

    const unsubscribe = dbService.subscribeToUserStatus(
      user.username,
      (liveStatus) => {
        if (!active) return;
        if (liveStatus.status === 'INACTIVE') {
          onLogout();
          return;
        }
        onUserSync?.({
          passVerified: liveStatus.passVerified,
          passVerificationRequired: liveStatus.passVerificationRequired,
          status: liveStatus.status,
          tier: liveStatus.tier,
        });
      },
      () => {
        if (active) {
          onLogout();
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    user.username,
    user.passVerified,
    user.passVerificationRequired,
    user.tier,
    user.status,
    onLogout,
    onUserSync,
  ]);

  const openVerifyModal = () => {
    setVerifyError(null);
    if (!isPassVerified) {
      setVerifySuccess(null);
    }
    setShowVerifyModal(true);
  };

  const closeVerifyModal = () => {
    if (isVerifying) return;
    setShowVerifyModal(false);
  };

  const handleVerificationCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    setVerificationCode(sanitized);
    if (verifyError) setVerifyError(null);
  };

  const handleVerifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;

    const cleanCode = verificationCode.trim().toUpperCase();
    if (!cleanCode) {
      setVerifyError('Please enter your verification code first.');
      return;
    }

    if (!/^[A-Z0-9]{4,32}$/.test(cleanCode)) {
      setVerifyError('Please enter a valid alphanumeric verification code (4–32 characters).');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);
    setVerifySuccess(null);

    await new Promise((res) => setTimeout(res, 250));
    const result = await dbService.verifyPassCode(user.username, cleanCode);

    if (!result.success) {
      setVerifyError(result.message);
      setIsVerifying(false);
      return;
    }

    setVerifySuccess(result.message);
    setVerificationCode('');
    setIsVerifying(false);
    onPassVerified?.();
  };

  // ALL FEATURES OFF BY DEFAULT ON EVERY FRESH LOGIN
  const [aimbot, setAimbot] = useState(false);
  const [aimbotRage, setAimbotRage] = useState(false);
  const [aimbotSilent, setAimbotSilent] = useState(false);
  const [silentTarget, setSilentTarget] = useState<'BODY' | 'HEAD'>('HEAD');
  const [aimFov, setAimFov] = useState(65);
  const [headshotRate, setHeadshotRate] = useState(85);

  // SAFE MODE State (OFF by default)
  const [safeMode, setSafeMode] = useState(false);

  // ESP Toggles State (ALL OFF by default)
  const [espState, setEspState] = useState({
    boxEsp: false,
    skeletonTracking: false,
    healthBar: false,
    distanceDisplay: false,
    snaplines: false,
  });

  // Config Sliders & Toggles State (ALL toggles OFF by default)
  const [configState, setConfigState] = useState({
    smoothFactor: 6.5,
    fovRadius: 75,
    targetBone: 'Head / Neck',
    crosshairOverlay: false,
    streamProof: false,
  });

  const toggleEsp = (key: keyof typeof espState) => {
    setEspState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleConfig = (key: 'crosshairOverlay' | 'streamProof') => {
    setConfigState((prev) => ({ ...prev, [key]: !prev[key] }));
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

      {/* 2. STATUS BAR & VERIFY YOUR PASS SIDE OPTION */}
      <div className="rounded-lg glass-input border border-purple-500/20 px-3 py-1.5 mb-2 flex items-center justify-between text-[11px] font-tech font-bold tracking-wider">
        <div className="flex items-center gap-1.5 text-purple-100">
          <ShieldCheck className={`w-3.5 h-3.5 ${safeMode ? 'text-emerald-300' : 'text-purple-400'}`} />
          <span className="uppercase tracking-wide">SAFE MODE</span>
        </div>

        <div className={`flex items-center gap-1.5 font-mono text-[10px] ${safeMode ? 'text-emerald-300' : 'text-purple-300/70'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${safeMode ? 'bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse' : 'bg-purple-400/50'}`} />
          <span>{safeMode ? 'PROTECTED' : 'STANDBY'}</span>
        </div>
      </div>

      {/* VERIFY YOUR PASS Side Option (Visible ONLY for USER-81455) */}
      {isSpecialAccount && (
        <div className="mb-2">
          <button
            type="button"
            onClick={openVerifyModal}
            className="w-full group relative overflow-hidden rounded-lg px-3 py-2 bg-gradient-to-r from-purple-950/90 via-amber-950/40 to-purple-950/90 border border-amber-400/50 hover:border-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.25)] flex items-center justify-between text-left transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                <KeyRound className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <span className="font-tech font-bold text-xs text-amber-200 tracking-wider uppercase block group-hover:text-amber-100">
                  VERIFY YOUR PASS
                </span>
                <span className="font-mono text-[9px] text-amber-300/80">
                  PASS UNVERIFIED • CLICK TO VERIFY
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="px-2.5 py-0.5 rounded bg-amber-400 text-black font-tech font-bold text-[10px] uppercase tracking-wider group-hover:bg-amber-300 transition-colors shadow-sm">
                VERIFY
              </span>
            </div>
          </button>
        </div>
      )}

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
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors gap-2">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                AIMBOT
              </span>
              <div className="flex items-center gap-2">
                <InjectedBadge active={aimbot} />
                <ToggleSwitch
                  checked={aimbot}
                  onChange={() => setAimbot(!aimbot)}
                />
              </div>
            </div>

            {/* 2. AIMBOT RAGE */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors gap-2">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                AIMBOT RAGE
              </span>
              <div className="flex items-center gap-2">
                <InjectedBadge active={aimbotRage} />
                <ToggleSwitch
                  checked={aimbotRage}
                  onChange={() => setAimbotRage(!aimbotRage)}
                />
              </div>
            </div>

            {/* 3. AIMBOT SILENT & BODY/HEAD SELECTOR */}
            <div className="px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-all space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                  AIMBOT SILENT
                </span>
                <div className="flex items-center gap-2">
                  <InjectedBadge active={aimbotSilent} />
                  <ToggleSwitch
                    checked={aimbotSilent}
                    onChange={() => setAimbotSilent(!aimbotSilent)}
                  />
                </div>
              </div>

              {/* Segmented Control for BODY and HEAD (visible only when SILENT is active) */}
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
            <div className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center justify-between gap-2 ${
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
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <InjectedBadge active={safeMode} />
                <ToggleSwitch
                  checked={safeMode}
                  onChange={() => setSafeMode(!safeMode)}
                />
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: ESP */}
        {activeTab === 'esp' && (
          <div className="space-y-2">
            {/* 1. 2D Box ESP */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors gap-2">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                2D Box ESP
              </span>
              <div className="flex items-center gap-2">
                <InjectedBadge active={espState.boxEsp} />
                <ToggleSwitch
                  checked={espState.boxEsp}
                  onChange={() => toggleEsp('boxEsp')}
                />
              </div>
            </div>

            {/* 2. Skeleton Tracking */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors gap-2">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                Skeleton Tracking
              </span>
              <div className="flex items-center gap-2">
                <InjectedBadge active={espState.skeletonTracking} />
                <ToggleSwitch
                  checked={espState.skeletonTracking}
                  onChange={() => toggleEsp('skeletonTracking')}
                />
              </div>
            </div>

            {/* 3. Health & Shield Bar */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors gap-2">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                Health & Shield Bar
              </span>
              <div className="flex items-center gap-2">
                <InjectedBadge active={espState.healthBar} />
                <ToggleSwitch
                  checked={espState.healthBar}
                  onChange={() => toggleEsp('healthBar')}
                />
              </div>
            </div>

            {/* 4. Distance Display */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors gap-2">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                Distance Display
              </span>
              <div className="flex items-center gap-2">
                <InjectedBadge active={espState.distanceDisplay} />
                <ToggleSwitch
                  checked={espState.distanceDisplay}
                  onChange={() => toggleEsp('distanceDisplay')}
                />
              </div>
            </div>

            {/* 5. Snaplines */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors gap-2">
              <span className="font-tech font-bold text-xs sm:text-sm text-white tracking-wide uppercase">
                Snaplines
              </span>
              <div className="flex items-center gap-2">
                <InjectedBadge active={espState.snaplines} />
                <ToggleSwitch
                  checked={espState.snaplines}
                  onChange={() => toggleEsp('snaplines')}
                />
              </div>
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

            {/* Optional Config Toggles with Injected Indicators */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors gap-2">
              <div className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-tech font-bold text-xs text-white tracking-wide uppercase">
                  Crosshair Overlay
                </span>
              </div>
              <div className="flex items-center gap-2">
                <InjectedBadge active={configState.crosshairOverlay} />
                <ToggleSwitch
                  checked={configState.crosshairOverlay}
                  onChange={() => toggleConfig('crosshairOverlay')}
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 hover:border-purple-400/40 transition-colors gap-2">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-tech font-bold text-xs text-white tracking-wide uppercase">
                  Stream Proof
                </span>
              </div>
              <div className="flex items-center gap-2">
                <InjectedBadge active={configState.streamProof} />
                <ToggleSwitch
                  checked={configState.streamProof}
                  onChange={() => toggleConfig('streamProof')}
                />
              </div>
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
                <span className="text-[10px] font-mono text-purple-300 bg-purple-900/60 px-2 py-0.2 rounded border border-purple-500/30 uppercase">{user.tier || 'VIP UNLIMITED'}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/15">
                <span className="text-[11px] font-tech font-bold text-purple-300/80 uppercase">HARDWARE</span>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" /> HWID MATCHED
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/15">
                <span className="text-[11px] font-tech font-bold text-purple-300/80 uppercase">PROTOCOL</span>
                <span className="text-[10px] font-mono text-purple-300">KERNEL RING-0</span>
              </div>

              {/* Special Pass Verification Row (Shown for USER-81455) */}
              {(isSpecialAccount || isSpecialUser) && (
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[11px] font-tech font-bold text-amber-300/90 uppercase">PASS STATUS</span>
                  {isPassVerified ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/70 border border-emerald-400/50 text-emerald-300 font-tech font-bold text-[10px] uppercase tracking-wider shadow-[0_0_10px_rgba(52,211,153,0.25)]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>PASS VERIFIED</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={openVerifyModal}
                      className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-tech font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_8px_rgba(245,158,11,0.25)] cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>VERIFY YOUR PASS</span>
                    </button>
                  )}
                </div>
              )}
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

      {/* VERIFY YOUR PASS MODAL */}
      {showVerifyModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-pass-title"
        >
          <div className="relative w-full max-w-[420px] max-h-[92vh] overflow-y-auto rounded-2xl glass-panel cyber-card-border cyber-glow-purple p-5 sm:p-6 border border-purple-500/40 shadow-2xl bg-[#0e061e]/95 my-auto">
            
            {/* Decorative Top Accent Lines */}
            <div className="absolute top-0 left-8 w-12 h-[1px] bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />
            <div className="absolute top-0 right-8 w-12 h-[1px] bg-gradient-to-r from-transparent via-fuchsia-400/60 to-transparent" />
            <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-28 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_10px_#f59e0b]" />

            {/* Close Icon Button */}
            <button
              type="button"
              onClick={closeVerifyModal}
              disabled={isVerifying}
              aria-label="Close verification modal"
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-purple-950/60 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Original Circular Logo & Animations */}
            <div className="flex justify-center mb-4">
              <div className="relative group">
                <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-purple-600/40 via-violet-500/30 to-fuchsia-600/40 blur-md animate-pulse-subtle" />
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#0c051a]/95 border border-purple-400/50 shadow-[0_0_22px_rgba(168,85,247,0.45)] flex items-center justify-center overflow-hidden animate-float">
                  <img
                    src="https://i.ibb.co/LXMBFV36/file-00000000b7fc8211bcf2c107760ddfb3.png"
                    alt="SILENT CHEATS Logo"
                    className="w-full h-full object-cover rounded-full select-none pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {/* Title & Account Info */}
            <div className="text-center mb-4">
              <h3
                id="verify-pass-title"
                className="font-cyber text-base sm:text-lg font-bold tracking-wider text-white cyber-text-glow uppercase"
              >
                VERIFY YOUR PASS
              </h3>
              <div className="mt-1.5 flex items-center justify-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] text-purple-300/80 uppercase">
                  ACCOUNT: <span className="text-purple-100 font-bold">{user.username}</span>
                </span>
                <span className="text-purple-500/50">•</span>
                <span className="font-mono text-[11px] font-bold text-amber-300">
                  FEE: ₹200
                </span>
              </div>
            </div>

            {/* 1. Professional Hinglish Message */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-[#090316]/90 border border-amber-400/35 shadow-[inset_0_0_16px_rgba(168,85,247,0.12)] mb-4">
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-purple-500/20">
                <Headphones className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="font-tech font-bold text-[11px] tracking-widest text-amber-300 uppercase">
                  ADMIN SUPPORT VERIFICATION NOTICE
                </span>
              </div>
              <p className="font-tech font-semibold text-xs sm:text-[13px] text-purple-100 leading-relaxed tracking-wide text-left">
                AAPKE DEVICE PAR YEH SILENT CHEATS PANEL FILHAAL SUPPORT NAHI KAR RAHA HAI. VERIFICATION PROCESS COMPLETE KARNE KE LIYE KRIPYA ADMIN SUPPORT SE CONTACT KARKE ₹200 PAY KARIYE. USKE BAAD ADMIN SE APNA VALID VERIFICATION CODE PRAAPT KARKE, NEECHE DIYE GAYE BOX MEIN CODE ENTER KAREIN AUR VERIFICATION COMPLETE KAREIN.
              </p>

              {/* Transparent Process Summary */}
              <div className="mt-3 pt-2.5 border-t border-purple-500/15 grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px] font-tech font-semibold text-purple-300/85 uppercase">
                <div className="flex items-center gap-1.5 bg-purple-950/40 rounded-lg px-2 py-1 border border-purple-500/20">
                  <span className="font-mono text-amber-300 font-bold">01</span>
                  <span>Contact Admin & Pay ₹200</span>
                </div>
                <div className="flex items-center gap-1.5 bg-purple-950/40 rounded-lg px-2 py-1 border border-purple-500/20">
                  <span className="font-mono text-amber-300 font-bold">02</span>
                  <span>Get Single-Use Code</span>
                </div>
                <div className="flex items-center gap-1.5 bg-purple-950/40 rounded-lg px-2 py-1 border border-purple-500/20">
                  <span className="font-mono text-amber-300 font-bold">03</span>
                  <span>Enter & Verify Now</span>
                </div>
              </div>
            </div>

            {/* Success Feedback */}
            {verifySuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-400/50 shadow-[0_0_16px_rgba(16,185,129,0.2)] flex items-start gap-2.5 text-emerald-200 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-tech font-semibold leading-snug">{verifySuccess}</div>
              </div>
            )}

            {/* Error Feedback */}
            {verifyError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-500/40 shadow-[0_0_14px_rgba(239,68,68,0.18)] flex items-start gap-2.5 text-red-200 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-tech font-semibold leading-snug">{verifyError}</div>
              </div>
            )}

            {/* 2. Verification Code Input & 3. Verify Button */}
            {!verifySuccess && !isPassVerified ? (
              <form onSubmit={handleVerifySubmit} className="space-y-3" noValidate>
                <div className="space-y-1.5">
                  <label
                    htmlFor="verification-code-input"
                    className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase"
                  >
                    VERIFICATION CODE
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <KeyRound className="w-4 h-4 text-purple-400/80 group-focus-within:text-fuchsia-300 transition-colors" />
                    </div>
                    <input
                      id="verification-code-input"
                      type="text"
                      value={verificationCode}
                      onChange={handleVerificationCodeChange}
                      disabled={isVerifying}
                      placeholder="ENTER VERIFICATION CODE"
                      maxLength={32}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#070212]/90 border border-purple-400/60 text-white placeholder-purple-300/40 font-mono text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_16px_rgba(168,85,247,0.3)] focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25 focus:shadow-[0_0_24px_rgba(217,70,239,0.5)] transition-all duration-200 disabled:opacity-50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="relative w-full group overflow-hidden rounded-xl py-3 px-4 font-cyber font-bold text-xs sm:text-sm tracking-widest text-white bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 border border-purple-300/50 shadow-[0_0_20px_rgba(168,85,247,0.45)] hover:shadow-[0_0_28px_rgba(217,70,239,0.65)] active:scale-[0.985] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer uppercase"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 pointer-events-none" />
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-purple-100" />
                      <span>VERIFYING CODE...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-white" />
                      <span>VERIFY NOW</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={closeVerifyModal}
                  disabled={isVerifying}
                  className="w-full rounded-xl py-2.5 px-4 font-tech font-bold text-xs tracking-widest text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 transition-all cursor-pointer uppercase disabled:opacity-50"
                >
                  CLOSE
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={closeVerifyModal}
                className="w-full rounded-xl py-3 px-4 font-cyber font-bold text-xs tracking-widest text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 border border-emerald-400/50 shadow-[0_0_18px_rgba(16,185,129,0.4)] active:scale-[0.985] transition-all cursor-pointer uppercase"
              >
                DONE / CONTINUE
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

// Reusable Modern Compact Injected Status Badge
interface InjectedBadgeProps {
  active: boolean;
}

const InjectedBadge: FC<InjectedBadgeProps> = ({ active }) => {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/50 text-emerald-300 font-mono text-[10px] font-bold tracking-wider shadow-[0_0_8px_rgba(52,211,153,0.35)] transition-all duration-200 shrink-0">
      <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
      <span>INJECTED</span>
    </span>
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

