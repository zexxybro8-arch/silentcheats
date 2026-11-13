import { useState, useCallback } from 'react';
import { CyberBackground } from './components/CyberBackground';
import { LoginCard } from './components/LoginCard';
import { DashboardView } from './components/DashboardView';
import { AdminPortal } from './components/admin/AdminPortal';
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

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center py-6 sm:py-10">
      {/* Dynamic Cyberpunk Ambient Canvas Background */}
      <CyberBackground />

      {/* Main Interactive Views */}
      <main className="w-full flex justify-center items-center">
        {isAdminRoute ? (
          <AdminPortal />
        ) : !currentUser ? (
          <LoginCard onLoginSuccess={handleLoginSuccess} />
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
