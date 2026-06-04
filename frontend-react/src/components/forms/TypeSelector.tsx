import type { LogType } from '@/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import './TypeSelector.css';

interface Props {
  logTypes:   LogType[];
  domain:     'work' | 'personal';
  selectedId: string;
  onDomain:   (d: 'work' | 'personal') => void;
  onSelect:   (id: string) => void;
}

export default function TypeSelector({ logTypes, domain, selectedId, onDomain, onSelect }: Props) {
  const filtered = (Array.isArray(logTypes) ? logTypes : []).filter(lt => lt.domain === domain && lt.isActive);

  return (
    <div className="type-sel">
      {/* Domain tabs */}
      <Tabs value={domain} onValueChange={v => onDomain(v as 'work' | 'personal')}>
        <TabsList className="type-sel-tabs">
          <TabsTrigger value="work">Work</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Type grid */}
      <div className="type-sel-grid">
        {filtered.map(lt => (
          <button
            key={lt._id}
            className={`type-sel-chip${selectedId === lt._id ? ' type-sel-chip--active' : ''}`}
            style={{
              '--chip-color': lt.color,
              background: selectedId === lt._id ? lt.color + '28' : undefined,
              borderColor: selectedId === lt._id ? lt.color : undefined,
              color:       selectedId === lt._id ? lt.color : undefined,
            } as React.CSSProperties}
            onClick={() => onSelect(lt._id)}
          >
            {lt.name}
          </button>
        ))}
        {filtered.length === 0 && (
          <span className="type-sel-empty">No types in this domain</span>
        )}
      </div>
    </div>
  );
}
