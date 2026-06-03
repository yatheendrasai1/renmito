import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth }       from '@/hooks/useAuth';
import TopStrip          from '@/components/shell/TopStrip';
import LeftNav           from '@/components/shell/LeftNav';
import BottomTabBar      from '@/components/shell/BottomTabBar';
import SpeedDialFAB      from '@/components/shell/SpeedDialFAB';
import Toast             from '@/components/shell/Toast';
import { topUpNotificationsOnResume } from '@/hooks/useNotifications';
import './AppLayout.css';

export default function AppLayout() {
  const { isAuthenticated } = useAuth();
  const { pathname }        = useLocation();
  const isDiary             = pathname === '/diary';

  // Top up notification queue whenever the app comes to foreground
  useEffect(() => {
    topUpNotificationsOnResume();

    function handleVisibility() {
      if (document.visibilityState === 'visible') topUpNotificationsOnResume();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={`app-shell${isDiary ? ' app-shell--diary' : ''}`}>

      <TopStrip />

      {/* Sliding left nav + dim backdrop (renders its own backdrop) */}
      <LeftNav />

      {/* Main scrollable area */}
      <div className="app-body">
        <div className="view-area">
          <Outlet />
        </div>
      </div>

      <BottomTabBar />
      {!isDiary && <SpeedDialFAB />}

      {/* Global toast */}
      <Toast />
    </div>
  );
}
