import { useState } from 'react';
import { CyberBackground } from './components/CyberBackground';
import { LoginCard } from './components/LoginCard';
import { DashboardView } from './components/DashboardView';

interface AuthUser {
  username: string;
  tier: string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
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
