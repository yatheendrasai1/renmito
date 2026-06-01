import { useAppStore } from '@/store/appStore';
import './TopStrip.css';

export default function TopStrip() {
  const toggleNav = useAppStore(s => s.toggleNav);

  return (
    <div className="top-strip">
      <button
        className="top-strip-menu"
        onClick={toggleNav}
        title="Menu"
        aria-label="Open menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <span className="top-strip-title">Renmito</span>
    </div>
  );
}
