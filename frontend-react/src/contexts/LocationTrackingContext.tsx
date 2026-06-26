import { createContext, useContext, type ReactNode } from 'react';
import { useLocationTracking } from '@/hooks/useLocationTracking';

type LocationTrackingContextValue = ReturnType<typeof useLocationTracking>;

const LocationTrackingContext = createContext<LocationTrackingContextValue | null>(null);

export function LocationTrackingProvider({ children }: { children: ReactNode }) {
  const value = useLocationTracking();
  return (
    <LocationTrackingContext.Provider value={value}>
      {children}
    </LocationTrackingContext.Provider>
  );
}

export function useLocationTrackingContext(): LocationTrackingContextValue {
  const ctx = useContext(LocationTrackingContext);
  if (!ctx) throw new Error('useLocationTrackingContext must be used within LocationTrackingProvider');
  return ctx;
}
