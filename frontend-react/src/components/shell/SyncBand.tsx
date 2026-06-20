import { useIsFetching } from '@tanstack/react-query';
import './SyncBand.css';

export default function SyncBand() {
  const fetching = useIsFetching();
  // Only show when there's cached data already on screen (not a cold first load)
  const hasCachedData = !!localStorage.getItem('renmito-cache-preferences');
  const visible = fetching > 0 && hasCachedData;

  return (
    <div className={`sync-band${visible ? ' sync-band--visible' : ''}`} aria-live="polite">
      <span className="sync-band__dot" />
      <span className="sync-band__dot" />
      <span className="sync-band__dot" />
      <span className="sync-band__text">Fetching latest data…</span>
    </div>
  );
}
