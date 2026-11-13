import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { CyberBackground } from './components/CyberBackground';
import { LoginCard } from './components/LoginCard';
import { DashboardView } from './components/DashboardView';
import { AdminPortal } from './components/admin/AdminPortal';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminPasswordChangeCard } from './components/admin/AdminPasswordChangeCard';
import { adminService, AdminSession } from './services/adminService';
import { dbService, AuthUser } from './services/dbService';

export default function App() {
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved =
        sessionStorage.getItem('sc_auth_session') || localStorage.getItem('sc_auth_session');
      if (saved) {
        return JSON.parse(saved) as AuthUser;
      }
    } catch {
      // fallback
    }
    return null;
  });

  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [isRestoringAdmin, setIsRestoringAdmin] = useState<boolean>(
    () => !isAdminRoute && adminService.hasStoredToken()
  );
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Restore persistent admin session across page refreshes and browser reopens
  useEffect(() => {
    if (isAdminRoute) return;
    let active = true;

    adminService
      .checkSession()
      .then((verifiedAdmin) => {
        if (active && verifiedAdmin) {
          setAdminSession(verifiedAdmin);
        }
      })
      .catch(() => {
        // ignore invalid/expired token
      })
      .finally(() => {
        if (active) {
          setIsRestoringAdmin(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isAdminRoute]);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('sc_auth_session', JSON.stringify(user));
      localStorage.setItem('sc_auth_session', JSON.stringify(user));
    } catch {
      // fallback
    }
  };

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('sc_auth_session');
      localStorage.removeItem('sc_auth_session');
    } catch {
      // fallback
    }
  }, []);

  const handleUserSync = useCallback((patch: Partial<AuthUser>) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const updatedUser: AuthUser = { ...prev, ...patch };
      try {
        sessionStorage.setItem('sc_auth_session', JSON.stringify(updatedUser));
        localStorage.setItem('sc_auth_session', JSON.stringify(updatedUser));
      } catch {
        // fallback
      }
      return updatedUser;
    });
  }, []);

  // Ensure restored user session stays synced with global database on app load
  useEffect(() => {
    if (isAdminRoute || !currentUser) return;
    let active = true;
    dbService.getPassStatus(currentUser.username).then((res) => {
      if (!active) return;
      if (!res.exists || res.data?.status === 'INACTIVE') {
        handleLogout();
        return;
      }
      if (res.data) {
        handleUserSync({
          tier: res.data.tier,
          status: res.data.status,
          passVerificationRequired: res.data.passVerificationRequired,
          passVerified: res.data.passVerified,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [isAdminRoute, currentUser?.username, handleLogout, handleUserSync]);

  const handlePassVerified = useCallback(() => {
    handleUserSync({ passVerified: true });
  }, [handleUserSync]);

  const handleAdminLoginSuccess = (admin: AdminSession) => {
    setShowAdminModal(false);
    setAdminSession(admin);
  };

  const handleAdminLogout = async () => {
    await adminService.logout();
    setAdminSession(null);
  };

  const handleLogoClick = async () => {
    if (adminSession) return;
    if (adminService.hasStoredToken()) {
      const verified = await adminService.checkSession();
      if (verified) {
        setAdminSession(verified);
        return;
      }
    }
    setShowAdminModal(true);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center py-6 sm:py-10">
      {/* Dynamic Cyberpunk Ambient Canvas Background */}
      <CyberBackground />

      {/* Main Interactive Views */}
      <main className="w-full flex justify-center items-center">
        {isAdminRoute ? (
          <AdminPortal />
        ) : isRestoringAdmin ? (
          <div className="flex flex-col items-center justify-center gap-3 text-purple-300 py-12">
            <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
            <span className="font-mono text-xs uppercase tracking-widest">
              RESTORING ADMIN SESSION...
            </span>
          </div>
        ) : adminSession ? (
          adminSession.mustChangePassword ? (
            <AdminPasswordChangeCard
              admin={adminSession}
              onPasswordChanged={setAdminSession}
              onCancelLogout={handleAdminLogout}
            />
          ) : (
            <AdminDashboard admin={adminSession} onLogout={handleAdminLogout} />
          )
        ) : !currentUser ? (
          <>
            <LoginCard
              onLoginSuccess={handleLoginSuccess}
              onLogoClick={handleLogoClick}
            />
            <AdminLoginModal
              isOpen={showAdminModal}
              onClose={() => setShowAdminModal(false)}
              onLoginSuccess={handleAdminLoginSuccess}
            />
          </>
        ) : (
          <DashboardView
            user={currentUser}
            onLogout={handleLogout}
            onPassVerified={handlePassVerified}
            onUserSync={handleUserSync}
          />
        )}
      </main>
    </div>
  );
}
