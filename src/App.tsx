/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CyberBackground } from './components/CyberBackground';
import { LoginCard } from './components/LoginCard';
import { DashboardView } from './components/DashboardView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ username: string; tier: string } | null>(null);

  const handleLoginSuccess = (userData: { username: string; tier: string }) => {
    setCurrentUser(userData);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center overflow-x-hidden selection:bg-purple-600 selection:text-white py-6 sm:py-10">
      {/* Refined Ambient Cybernetic Background */}
      <CyberBackground />

      {/* Main Login View Container */}
      <main className="relative z-10 w-full flex items-center justify-center">
        {!currentUser ? (
          <LoginCard onLoginSuccess={handleLoginSuccess} />
        ) : (
          <DashboardView user={currentUser} onLogout={handleLogout} />
        )}
      </main>
    </div>
  );
}
