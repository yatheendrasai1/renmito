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

function MapFollower({ position }: { position: Coordinate | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], map.getZoom());
  }, [position, map]);
  return null;
}

export default function LocationPage() {
  const { stored, bigMovements, currentPosition, syncing, syncMsg, sync, refresh } =
    useLocationTracking();

  useEffect(() => { refresh(); }, [refresh]);

  const polyline: [number, number][] = stored.map(c => [c.lat, c.lng]);
  const mapCenter: [number, number]  = currentPosition
    ? [currentPosition.lat, currentPosition.lng]
    : HYDERABAD;

  const bigMovementTimestamps = new Set(bigMovements.map(p => p.timestamp));

  return (
    <div className="loc-page">
      <div className="loc-header">
        <div className="loc-header__info">
          <h1 className="loc-title">Location Tracking</h1>
          <p className="loc-subtitle">
            {currentPosition ? `Live · ${stored.length} points stored` : 'Waiting for GPS fix…'}
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
          zoom={19}
          maxZoom={19}
          maxBounds={INDIA_BOUNDS}
          maxBoundsViscosity={0.8}
          className="loc-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <MapFollower position={currentPosition} />

          {polyline.length > 1 && (
            <Polyline
              positions={polyline}
              pathOptions={{ color: '#6366f1', weight: 3, opacity: 0.8 }}
            />
          )}

          {stored.map((c, i) => {
            const isBig = bigMovementTimestamps.has(c.timestamp);
            return (
              <CircleMarker
                key={i}
                center={[c.lat, c.lng]}
                radius={isBig ? 7 : 4}
                pathOptions={{
                  color:       isBig ? '#f97316' : '#6366f1',
                  fillColor:   isBig ? '#f97316' : '#6366f1',
                  fillOpacity: 0.9,
                  weight:      isBig ? 2 : 1,
                }}
              >
                <Tooltip>
                  {isBig && <><strong>Big movement</strong><br /></>}
                  {new Date(c.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  <br />
                  {c.lat.toFixed(6)}, {c.lng.toFixed(6)}
                  {c.distanceFromPrev !== null && (
                    <><br />{c.distanceFromPrev.toFixed(1)} m from previous</>
                  )}
                </Tooltip>
              </CircleMarker>
            );
          })}

          {currentPosition && (
            <CircleMarker
              center={[currentPosition.lat, currentPosition.lng]}
              radius={10}
              pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2 }}
            >
              <Tooltip>You are here</Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      {bigMovements.length > 0 && (
        <div className="loc-log-list loc-log-list--big">
          <h2 className="loc-log-title">
            <span className="loc-big-dot" /> Big Movements
            <span className="loc-big-count">{bigMovements.length}</span>
          </h2>
          <ul className="loc-log-ul">
            {[...bigMovements].reverse().map((c, i) => (
              <li key={i} className="loc-log-item loc-log-item--big">
                <div className="loc-log-left">
                  <span className="loc-log-time">
                    {new Date(c.timestamp).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className="loc-log-coords">
                    {c.lat.toFixed(6)}, {c.lng.toFixed(6)}
                  </span>
                </div>
                <span className="loc-big-distance">
                  +{c.distanceFromPrev!.toFixed(1)} m
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stored.length > 0 && (
        <div className="loc-log-list">
          <h2 className="loc-log-title">All Stored Points</h2>
          <ul className="loc-log-ul">
            {[...stored].reverse().map((c, i) => (
              <li
                key={i}
                className={`loc-log-item${bigMovementTimestamps.has(c.timestamp) ? ' loc-log-item--big-subtle' : ''}`}
              >
                <div className="loc-log-left">
                  <span className="loc-log-time">
                    {new Date(c.timestamp).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className="loc-log-coords">
                    {c.lat.toFixed(6)}, {c.lng.toFixed(6)}
                  </span>
                </div>
                {c.distanceFromPrev !== null && (
                  <span className={`loc-dist-badge${c.distanceFromPrev >= 10 ? ' loc-dist-badge--big' : ''}`}>
                    {c.distanceFromPrev.toFixed(1)} m
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
