import { useState, useEffect, useCallback } from 'react';
import { CyberBackground } from './components/CyberBackground';
import { LoginCard } from './components/LoginCard';
import { DashboardView } from './components/DashboardView';
import { AdminPortal } from './components/admin/AdminPortal';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminPasswordChangeCard } from './components/admin/AdminPasswordChangeCard';
import { adminService, AdminSession } from './services/adminService';
import { AuthUser } from './services/dbService';

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
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Restore separate admin session on refresh only if an admin token exists
  useEffect(() => {
    if (isAdminRoute || !adminService.hasStoredToken()) return;
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

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center py-6 sm:py-10">
      {/* Dynamic Cyberpunk Ambient Canvas Background */}
      <CyberBackground />

      {/* Main Interactive Views */}
      <main className="w-full flex justify-center items-center">
        {isAdminRoute ? (
          <AdminPortal />
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
              onLogoClick={() => setShowAdminModal(true)}
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
