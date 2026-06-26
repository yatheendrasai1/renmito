import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LocationPointPicker.css';

// Fix default Leaflet marker icons broken by Vite bundling
const markerIcon = L.icon({
  iconUrl:        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});

interface Props {
  onSave: (name: string, lat: number, lng: number) => Promise<unknown>;
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
          const m = e.target as L.Marker;
          const ll = m.getLatLng();
          onChange([ll.lat, ll.lng]);
        },
      }}
    />
  );
}

export default function LocationPointPicker({ onSave, onClose }: Props) {
  const [pos, setPos]       = useState<[number, number] | null>(null);
  const [name, setName]     = useState('');
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
          setPos([17.3850, 78.4867]); // fallback: Hyderabad
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const handleSave = async () => {
    if (!name.trim()) { setError('Enter a location name.'); return; }
    if (!pos)         { setError('Waiting for position…'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(name.trim(), pos[0], pos[1]);
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
            placeholder="Location name (e.g. Home, Office)"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
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
