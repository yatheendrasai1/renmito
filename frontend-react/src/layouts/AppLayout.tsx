import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useAuth }       from '@/hooks/useAuth';
import TopStrip          from '@/components/shell/TopStrip';
import LeftNav           from '@/components/shell/LeftNav';
import BottomTabBar      from '@/components/shell/BottomTabBar';
import SpeedDialFAB      from '@/components/shell/SpeedDialFAB';
import Toast             from '@/components/shell/Toast';
import LogFormModal      from '@/components/logger/LogFormModal';
import { topUpNotificationsOnResume } from '@/hooks/useNotifications';
import { useAppStore }   from '@/store/appStore';
import './AppLayout.css';

export default function AppLayout() {
  const { isAuthenticated } = useAuth();
  const { pathname }        = useLocation();
  const isDiary             = pathname === '/diary';
  const logFormOpen         = useAppStore(s => s.logFormOpen);
  const openLogForm         = useAppStore(s => s.openLogForm);
  const closeLogForm        = useAppStore(s => s.closeLogForm);
  const selectedDate        = useAppStore(s => s.selectedDate);

  // Top up notification queue whenever the app comes to foreground
  useEffect(() => {
    topUpNotificationsOnResume();

    function handleVisibility() {
      if (document.visibilityState === 'visible') topUpNotificationsOnResume();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Open log form when user taps a notification
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sub = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      () => openLogForm(),
    );
    return () => { sub.then(h => h.remove()); };
  }, [openLogForm]);

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

      {/* Global log form — opened by FAB or notification tap */}
      {logFormOpen && (
        <LogFormModal
          mode="create"
          date={selectedDate}
          onClose={closeLogForm}
        />
      )}
    </div>
  );
}
