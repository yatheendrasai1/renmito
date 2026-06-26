import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import './LocationPage.css';

const HYDERABAD: [number, number] = [17.3850, 78.4867];
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.55, 68.1],
  [35.67, 97.4],
];

export default function LocationPage() {
  const { stored, syncing, syncMsg, sync, refresh } = useLocationTracking();

  useEffect(() => { refresh(); }, [refresh]);

  const polyline: [number, number][] = stored.map(c => [c.lat, c.lng]);
  const latest = stored.length > 0 ? stored[stored.length - 1] : undefined;

  return (
    <div className="loc-page">
      <div className="loc-header">
        <div className="loc-header__info">
          <h1 className="loc-title">Location Tracking</h1>
          <p className="loc-subtitle">
            Auto-logs every 5 min · 8 AM – 10 PM · {stored.length} points stored
          </p>
        </div>
        <button
          className="loc-sync-btn"
          onClick={sync}
          disabled={syncing || stored.length === 0}
        >
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {syncMsg && (
        <div className={`loc-banner ${syncMsg.includes('failed') ? 'loc-banner--error' : 'loc-banner--ok'}`}>
          {syncMsg}
        </div>
      )}

      <div className="loc-map-wrap">
        <MapContainer
          center={latest ? [latest.lat, latest.lng] : HYDERABAD}
          zoom={latest ? 13 : 5}
          maxBounds={INDIA_BOUNDS}
          maxBoundsViscosity={0.8}
          className="loc-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {polyline.length > 1 && (
            <Polyline
              positions={polyline}
              pathOptions={{ color: 'var(--color-primary, #6366f1)', weight: 3, opacity: 0.85 }}
            />
          )}

          {stored.map((c, i) => (
            <CircleMarker
              key={i}
              center={[c.lat, c.lng]}
              radius={i === stored.length - 1 ? 8 : 4}
              pathOptions={{
                color:     i === stored.length - 1 ? '#ef4444' : 'var(--color-primary, #6366f1)',
                fillColor: i === stored.length - 1 ? '#ef4444' : 'var(--color-primary, #6366f1)',
                fillOpacity: 0.9,
                weight: 1,
              }}
            >
              <Tooltip>
                {new Date(c.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                <br />
                {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {stored.length > 0 && (
        <div className="loc-log-list">
          <h2 className="loc-log-title">Stored Points</h2>
          <ul className="loc-log-ul">
            {[...stored].reverse().map((c, i) => (
              <li key={i} className="loc-log-item">
                <span className="loc-log-time">
                  {new Date(c.timestamp).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <span className="loc-log-coords">
                  {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
