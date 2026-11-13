import { useState, useEffect, FC } from 'react';
import { Loader2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { AdminLoginCard } from './AdminLoginCard';
import { AdminDashboard } from './AdminDashboard';

export const AdminPortal: FC = () => {
  const [admin, setAdmin] = useState<{ username: string; role: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    adminService
      .checkSession()
      .then((verifiedAdmin) => {
        if (mounted) {
          setAdmin(verifiedAdmin);
        }
      })
      .finally(() => {
        if (mounted) {
          setCheckingSession(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await adminService.logout();
    setAdmin(null);
  };

  if (checkingSession) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-purple-300 py-12">
        <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
        <span className="font-mono text-xs uppercase tracking-widest">
          VERIFYING ADMIN CLEARANCE...
        </span>
      </div>
    );
  }

  if (!admin) {
    return <AdminLoginCard onLoginSuccess={setAdmin} />;
  }

  return <AdminDashboard admin={admin} onLogout={handleLogout} />;
};
