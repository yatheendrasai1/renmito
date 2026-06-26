import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LocationPointPicker.css';

const markerIcon = L.icon({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});

// Preset radius options covering common use cases
const RADIUS_PRESETS = [
  { label: 'Room',      value: 5,   hint: '~5 m' },
  { label: 'Building',  value: 20,  hint: '~20 m' },
  { label: 'Campus',    value: 75,  hint: '~75 m' },
  { label: 'Home',      value: 150, hint: '~150 m' },
  { label: 'Area',      value: 300, hint: '~300 m' },
];

interface Props {
  onSave: (name: string, lat: number, lng: number, radius: number) => Promise<unknown>;
  onClose: () => void;
}

function DraggableMarker({
  position,
  onChange,
}: {
  position: [number, number];
  onChange: (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e) { onChange([e.latlng.lat, e.latlng.lng]); },
  });

  return (
    <Marker
      position={position}
      icon={markerIcon}
      draggable
      eventHandlers={{
        dragend(e) {
          const ll = (e.target as L.Marker).getLatLng();
          onChange([ll.lat, ll.lng]);
        },
      }}
    />
  );
}

export default function LocationPointPicker({ onSave, onClose }: Props) {
  const [pos, setPos]       = useState<[number, number] | null>(null);
  const [name, setName]     = useState('');
  const [radius, setRadius] = useState(20);
  const [custom, setCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const gotGps              = useRef(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!gotGps.current) {
          gotGps.current = true;
          setPos([coords.latitude, coords.longitude]);
        }
      },
      () => {
        if (!gotGps.current) {
          gotGps.current = true;
          setPos([17.3850, 78.4867]);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const handleSave = async () => {
    if (!name.trim()) { setError('Enter a location name.'); return; }
    if (!pos)         { setError('Waiting for position…');  return; }
    if (radius < 1 || radius > 500) { setError('Radius must be 1 – 500 m.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(name.trim(), pos[0], pos[1], radius);
      onClose();
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lpp-overlay">
      <div className="lpp-sheet">
        <div className="lpp-header">
          <span className="lpp-title">Add Location Point</span>
          <button className="lpp-close" onClick={onClose}>✕</button>
        </div>

        <div className="lpp-map-wrap">
          {pos ? (
            <MapContainer center={pos} zoom={18} maxZoom={19} className="lpp-map">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              <DraggableMarker position={pos} onChange={setPos} />
              {/* Radius preview circle */}
              <Circle
                center={pos}
                radius={radius}
                pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.15, weight: 1.5 }}
              />
            </MapContainer>
          ) : (
            <div className="lpp-map-loading">Getting your location…</div>
          )}
        </div>

        {pos && (
          <p className="lpp-coords">
            {pos[0].toFixed(6)}, {pos[1].toFixed(6)}
          </p>
        )}

        <div className="lpp-form">
          <input
            className="lpp-input"
            placeholder="Location name (e.g. Meeting Room 11, Home)"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />

          {/* Radius picker */}
          <div className="lpp-radius-label">
            Detection radius
            <span className="lpp-radius-val">{radius} m</span>
          </div>
          <div className="lpp-presets">
            {RADIUS_PRESETS.map(p => (
              <button
                key={p.value}
                className={`lpp-preset${radius === p.value && !custom ? ' lpp-preset--active' : ''}`}
                onClick={() => { setRadius(p.value); setCustom(false); }}
              >
                <span className="lpp-preset-label">{p.label}</span>
                <span className="lpp-preset-hint">{p.hint}</span>
              </button>
            ))}
          </div>
          <div className="lpp-slider-row">
            <span className="lpp-slider-edge">1 m</span>
            <input
              type="range"
              className="lpp-slider"
              min={1} max={500} step={1}
              value={radius}
              onChange={e => { setRadius(Number(e.target.value)); setCustom(true); }}
            />
            <span className="lpp-slider-edge">500 m</span>
          </div>

          {error && <p className="lpp-error">{error}</p>}

          <div className="lpp-actions">
            <button className="lpp-btn lpp-btn--cancel" onClick={onClose}>Cancel</button>
            <button className="lpp-btn lpp-btn--save" onClick={handleSave} disabled={saving || !pos}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
