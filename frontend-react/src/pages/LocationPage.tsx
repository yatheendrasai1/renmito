import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinate, StoredPoint } from '@/hooks/useLocationTracking';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import './LocationPage.css';

const HYDERABAD: [number, number] = [17.3850, 78.4867];
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.55, 68.1],
  [35.67, 97.4],
];

function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<LeafletMap | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function InitialCenter({ position }: { position: Coordinate | null }) {
  const map = useMap();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (position && !done) {
      map.setView([position.lat, position.lng], map.getZoom());
      setDone(true);
    }
  }, [position, map, done]);
  return null;
}

function BoundsWatcher({
  position,
  onVisibilityChange,
}: {
  position: Coordinate | null;
  onVisibilityChange: (visible: boolean) => void;
}) {
  const check = useCallback(
    (map: ReturnType<typeof useMap>) => {
      if (!position) { onVisibilityChange(true); return; }
      onVisibilityChange(map.getBounds().contains([position.lat, position.lng]));
    },
    [position, onVisibilityChange]
  );
  const map = useMapEvents({
    move() { check(map); },
    zoom() { check(map); },
  });
  useEffect(() => { check(map); }, [position, map, check]);
  return null;
}

// ── Point rendering ───────────────────────────────────────────────────────────

function PointMarker({
  point,
  isBig,
  isSelected,
  onClick,
}: {
  point: StoredPoint;
  isBig: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = isSelected ? '#facc15' : isBig ? '#f97316' : '#6366f1';
  return (
    <CircleMarker
      center={[point.lat, point.lng]}
      radius={isSelected ? 11 : isBig ? 7 : 4}
      pathOptions={{
        color,
        fillColor:   color,
        fillOpacity: isSelected ? 1 : 0.9,
        weight:      isSelected ? 3 : isBig ? 2 : 1,
      }}
      eventHandlers={{ click: onClick }}
    >
      <Tooltip>
        {isSelected && <><strong>Selected</strong><br /></>}
        {isBig && !isSelected && <><strong>Big movement</strong><br /></>}
        {new Date(point.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        <br />
        {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
        {point.distanceFromPrev != null && (
          <><br />{point.distanceFromPrev.toFixed(1)} m from previous</>
        )}
      </Tooltip>
    </CircleMarker>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LocationPage() {
  const { stored, bigMovements, currentPosition, syncing, syncMsg, sync, refresh } =
    useLocationTracking();

  useEffect(() => { refresh(); }, [refresh]);

  const [positionInView, setPositionInView] = useState(true);
  const [selectedTs, setSelectedTs]         = useState<string | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);

  const flyToPoint = useCallback((point: StoredPoint) => {
    setSelectedTs(point.timestamp);
    mapInstanceRef.current?.flyTo([point.lat, point.lng], 19);
  }, []);

  const goToCurrentPosition = useCallback(() => {
    if (mapInstanceRef.current && currentPosition) {
      mapInstanceRef.current.flyTo([currentPosition.lat, currentPosition.lng], mapInstanceRef.current.getZoom());
    }
  }, [currentPosition]);

  const polyline: [number, number][]  = stored.map(c => [c.lat, c.lng]);
  const mapCenter: [number, number]   = currentPosition ? [currentPosition.lat, currentPosition.lng] : HYDERABAD;
  const bigMovementTimestamps         = new Set(bigMovements.map(p => p.timestamp));

  const renderListItem = (c: StoredPoint, i: number, variant: 'big' | 'all') => {
    const isBig      = bigMovementTimestamps.has(c.timestamp);
    const isSelected = selectedTs === c.timestamp;

    return (
      <li
        key={i}
        className={[
          'loc-log-item',
          variant === 'big' ? 'loc-log-item--big' : '',
          variant === 'all' && isBig ? 'loc-log-item--big-subtle' : '',
          isSelected ? 'loc-log-item--selected' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => flyToPoint(c)}
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
        {variant === 'big' ? (
          <span className="loc-big-distance">+{c.distanceFromPrev!.toFixed(1)} m</span>
        ) : c.distanceFromPrev != null ? (
          <span className={`loc-dist-badge${c.distanceFromPrev >= 10 ? ' loc-dist-badge--big' : ''}`}>
            {c.distanceFromPrev.toFixed(1)} m
          </span>
        ) : null}
      </li>
    );
  };

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
        <button className="loc-sync-btn" onClick={sync} disabled={syncing || stored.length === 0}>
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {syncMsg && (
        <div className={`loc-banner ${syncMsg.includes('failed') ? 'loc-banner--error' : 'loc-banner--ok'}`}>
          {syncMsg}
        </div>
      )}

      <div className="loc-map-wrap">
        {!positionInView && currentPosition && (
          <button className="loc-locate-btn" onClick={goToCurrentPosition} title="Go to current location">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
          </button>
        )}

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
          <MapRefCapture mapRef={mapInstanceRef} />
          <InitialCenter position={currentPosition} />
          <BoundsWatcher position={currentPosition} onVisibilityChange={setPositionInView} />

          {polyline.length > 1 && (
            <Polyline
              positions={polyline}
              pathOptions={{ color: '#6366f1', weight: 3, opacity: 0.8 }}
            />
          )}

          {stored.map((c, i) => (
            <PointMarker
              key={i}
              point={c}
              isBig={bigMovementTimestamps.has(c.timestamp)}
              isSelected={selectedTs === c.timestamp}
              onClick={() => setSelectedTs(c.timestamp)}
            />
          ))}

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
            {[...bigMovements].reverse().map((c, i) => renderListItem(c, i, 'big'))}
          </ul>
        </div>
      )}

      {stored.length > 0 && (
        <div className="loc-log-list">
          <h2 className="loc-log-title">All Stored Points</h2>
          <ul className="loc-log-ul">
            {[...stored].reverse().map((c, i) => renderListItem(c, i, 'all'))}
          </ul>
        </div>
      )}
    </div>
  );
}
