import { useState } from 'react';
import { CyberBackground } from './components/CyberBackground';
import { LoginCard } from './components/LoginCard';
import { DashboardView } from './components/DashboardView';
import { AuthUser } from './services/dbService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = sessionStorage.getItem('sc_auth_session') || localStorage.getItem('sc_auth_session');
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

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('sc_auth_session');
      localStorage.removeItem('sc_auth_session');
    } catch {
      // fallback
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center py-6 sm:py-10">
      {/* Dynamic Cyberpunk Ambient Canvas Background */}
      <CyberBackground />

      {/* Main Interactive Views */}
      <main className="w-full flex justify-center items-center">
        {!currentUser ? (
          <LoginCard onLoginSuccess={handleLoginSuccess} />
        ) : (
          <DashboardView user={currentUser} onLogout={handleLogout} />
        )}
      </main>
    </div>
  );
}
