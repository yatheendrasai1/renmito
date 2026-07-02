import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Toaster } from '@/components/ui/sonner';
import { useAuth }       from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import TopStrip          from '@/components/shell/TopStrip';
import LeftNav           from '@/components/shell/LeftNav';
import BottomTabBar      from '@/components/shell/BottomTabBar';
import SyncBand         from '@/components/shell/SyncBand';
import SpeedDialFAB      from '@/components/shell/SpeedDialFAB';
import LogFormModal      from '@/components/logger/LogFormModal';
import RenniChat         from '@/components/chat/RenniChat';
import { topUpNotificationsOnResume } from '@/hooks/useNotifications';
import { useLogTypes }   from '@/hooks/useLogTypes';
import { syncWidgetTiles } from '@/lib/tokenSync';
import { LocationTrackingProvider } from '@/contexts/LocationTrackingContext';
import { useAppStore }   from '@/store/appStore';
import './AppLayout.css';

export default function AppLayout() {
  const { isAuthenticated } = useAuth();
  const { pathname }        = useLocation();
  const isDiary             = pathname === '/diary';
  // Pages that manage their own full-height scroll/safe-area layout instead
  // of the default padded, app-body-scrolled view-area.
  const isFullBleed         = isDiary || pathname === '/location';
  const logFormOpen         = useAppStore(s => s.logFormOpen);
  const openLogForm         = useAppStore(s => s.openLogForm);
  const closeLogForm        = useAppStore(s => s.closeLogForm);
  const selectedDate        = useAppStore(s => s.selectedDate);
  const renniOpen           = useAppStore(s => s.renniOpen);
  const renniInitialMsg     = useAppStore(s => s.renniInitialMsg);
  const closeRenni          = useAppStore(s => s.closeRenni);

  // Load preferences — applies theme class via usePreferences effect
  usePreferences();

  // Keep the home-screen widget's tile list (title → logTypeId) mirrored to
  // native storage whenever log types load or change.
  const { data: logTypes } = useLogTypes();
  useEffect(() => {
    syncWidgetTiles(logTypes);
  }, [logTypes]);

  // Default to dark until prefs resolve
  useEffect(() => {
    if (!document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.add('dark');
    }
  }, []);

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
    <LocationTrackingProvider>
    <div className={`app-shell${isDiary ? ' app-shell--diary' : ''}${isFullBleed ? ' app-shell--fullbleed' : ''}`}>

      <TopStrip />

      {/* Sliding left nav + dim backdrop (renders its own backdrop) */}
      <LeftNav />

      {/* Main scrollable area */}
      <div className="app-body">
        <div className="view-area">
          <Outlet />
        </div>
      </div>

      <SyncBand />
      <BottomTabBar />
      {!isDiary && !logFormOpen && <SpeedDialFAB />}

      {/* Global toast */}
      <Toaster position="bottom-center" />

      {/* Global log form — opened by FAB or notification tap */}
      {logFormOpen && (
        <LogFormModal
          mode="create"
          date={selectedDate}
          onClose={closeLogForm}
        />
      )}

      {/* Global Renni chat — opened from Notes or FAB */}
      {renniOpen && (
        <RenniChat
          initialMessage={renniInitialMsg}
          onClose={closeRenni}
        />
      )}
    </div>
    </LocationTrackingProvider>
  );
}
