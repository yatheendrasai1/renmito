import { NavLink } from 'react-router-dom';
import './BottomTabBar.css';

const TABS = [
  {
    to: '/lifestyle',
    label: 'Lifestyle',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    to: '/logger',
    label: 'Logger',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    to: '/journeys',
    label: 'Journeys',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
] as const;

export default function BottomTabBar() {
  return (
    <nav className="bottom-tab-bar">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `bottom-tab${isActive ? ' bottom-tab--active' : ''}`
          }
        >
          {tab.icon}
          <span className="bottom-tab-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
