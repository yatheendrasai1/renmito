import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinate } from '@/hooks/useLocationTracking';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import './LocationPage.css';

const HYDERABAD: [number, number] = [17.3850, 78.4867];
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.55, 68.1],
  [35.67, 97.4],
];

// Keeps the map centered on the live position as it updates
function MapFollower({ position }: { position: Coordinate | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], map.getZoom());
  }, [position, map]);
  return null;
}

export default function LocationPage() {
  const { stored, currentPosition, syncing, syncMsg, sync, refresh } = useLocationTracking();

  useEffect(() => { refresh(); }, [refresh]);

  const polyline: [number, number][] = stored.map(c => [c.lat, c.lng]);
  const mapCenter: [number, number] = currentPosition
    ? [currentPosition.lat, currentPosition.lng]
    : HYDERABAD;

  return (
    <div className="loc-page">
      <div className="loc-header">
        <div className="loc-header__info">
          <h1 className="loc-title">Location Tracking</h1>
          <p className="loc-subtitle">
            {currentPosition
              ? `Live · ${stored.length} points stored`
              : 'Waiting for GPS fix…'}
            {' · 8 AM – 10 PM'}
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
          center={mapCenter}
          zoom={15}
          maxBounds={INDIA_BOUNDS}
          maxBoundsViscosity={0.8}
          className="loc-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapFollower position={currentPosition} />

          {/* Route polyline through stored points */}
          {polyline.length > 1 && (
            <Polyline
              positions={polyline}
              pathOptions={{ color: '#6366f1', weight: 3, opacity: 0.8 }}
            />
          )}

          {/* Stored log dots */}
          {stored.map((c, i) => (
            <CircleMarker
              key={i}
              center={[c.lat, c.lng]}
              radius={4}
              pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.85, weight: 1 }}
            >
              <Tooltip>
                {new Date(c.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                <br />
                {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Live position — blue pulsing dot */}
          {currentPosition && (
            <CircleMarker
              center={[currentPosition.lat, currentPosition.lng]}
              radius={10}
              pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2 }}
            >
              <Tooltip permanent={false}>You are here</Tooltip>
            </CircleMarker>
          )}
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
