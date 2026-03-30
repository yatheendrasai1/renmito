export interface ActivityType {
  type: string;
  label: string;
  color: string;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  // ── Chips (quick-select) ──────────────────────────────
  { type: 'work',          label: 'Work Log',      color: '#4A90E2' },
  { type: 'breakfast',     label: 'Breakfast',     color: '#F5A623' },
  { type: 'lunch',         label: 'Lunch',         color: '#E07B00' },
  { type: 'dinner',        label: 'Dinner',        color: '#D04000' },
  { type: 'transit',       label: 'Transit',       color: '#BD10E0' },
  // ── Dropdown ─────────────────────────────────────────
  { type: 'sleep',         label: 'Sleep',         color: '#7B68EE' },
  { type: 'exercise',      label: 'Exercise',      color: '#7ED321' },
  { type: 'entertainment', label: 'Entertainment', color: '#50E3C2' },
  // ── Legacy — kept for backward compatibility ──────────
  { type: 'wake',          label: 'Wake Up',       color: '#50E3C2' },
  { type: 'break',         label: 'Break',         color: '#F8E71C' },
  { type: 'personal',      label: 'Personal',      color: '#D0021B' },
  { type: 'other',         label: 'Other',         color: '#9B9B9B' },
];

export function getActivityColor(type: string): string {
  const activity = ACTIVITY_TYPES.find(a => a.type === type);
  return activity ? activity.color : '#9B9B9B';
}

export function getActivityLabel(type: string): string {
  const activity = ACTIVITY_TYPES.find(a => a.type === type);
  return activity ? activity.label : 'Other';
}
