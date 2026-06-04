import { useState, useEffect, useRef, useCallback } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Chart,
  LineController, LineElement, PointElement,
  LinearScale, CategoryScale, Filler, Tooltip,
} from 'chart.js';
import { useLogTypes } from '@/hooks/useLogTypes';
import {
  useJourneys, useCreateJourney, useUpdateJourney, useDeleteJourney,
  useJourneyEntries, useAddJourneyEntry, useUpdateJourneyEntry,
  useDeleteJourneyEntry, useResyncJourney,
} from '@/hooks/useJourneys';
import type {
  Journey, JourneyEntry, JourneySpan, ValueType, ValueMetric,
} from '@/types';
import './JourneysPage.css';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

// ── Constants ─────────────────────────────────────────────────────────────────

const VALUE_METRIC_OPTIONS: { value: ValueMetric; icon: string; label: string; hint: string }[] = [
  { value: 'duration',   icon: '⏱', label: 'Duration',   hint: 'mins per log' },
  { value: 'count',      icon: '🔢', label: 'Count',      hint: '1 per log' },
  { value: 'start-time', icon: '▶',  label: 'Start Time', hint: 'time of day' },
  { value: 'end-time',   icon: '⏹',  label: 'End Time',   hint: 'time of day' },
];

const STATUS_OPTIONS = [
  { value: 'active',    label: 'Active' },
  { value: 'paused',    label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

const JOURNEY_SUGGESTIONS = [
  'Sleep hours', 'Mood score', 'Water intake', 'Steps', 'Weight',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(iso: string): Date {
  if (!iso) return new Date(NaN);
  // Already a full ISO datetime — parse as-is; date-only strings get noon local to avoid timezone rollover
  return iso.includes('T') ? new Date(iso) : new Date(iso + 'T12:00:00');
}

function fmtDateShort(iso: string): string {
  if (!iso) return '';
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

function fmtDateLong(iso: string): string {
  if (!iso) return '';
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function fmtTimestamp(ts: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
}

function minsToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function valueMetricLabel(vm: ValueMetric): string {
  switch (vm) {
    case 'duration':   return 'Duration (mins)';
    case 'count':      return 'Count';
    case 'start-time': return 'Start Time';
    case 'end-time':   return 'End Time';
  }
}

function isNumericJourney(j: Journey): boolean {
  if (j.trackerType === 'point-log') return j.config.valueType === 'numeric';
  if (j.trackerType === 'derived' && j.derivedFrom) {
    return ['duration', 'count', 'start-time', 'end-time'].includes(j.derivedFrom.valueMetric);
  }
  return false;
}

// ── Sparkline sub-component ───────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 56, H = 20, pad = 1;
  const mn = Math.min(...values), mx = Math.max(...values);
  const range = mx - mn || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - mn) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="jrn-sparkline" viewBox="0 0 56 22" width="56" height="22" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--accent-bright)" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

type ChartPoint = { label: string; value: number; ts: Date };

function buildChartPoints(j: Journey, entries: JourneyEntry[], dayGroups: DayGroup[]): ChartPoint[] {
  if (!isNumericJourney(j) || entries.length === 0) return [];
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  if (j.trackerType === 'point-log') {
    return entries
      .filter(e => e.numericValue !== null)
      .map(e => ({ label: fmt.format(new Date(e.timestamp)), value: e.numericValue!, ts: new Date(e.timestamp) }))
      .sort((a, b) => a.ts.getTime() - b.ts.getTime());
  }
  return dayGroups
    .map(g => {
      const ts = new Date(g.date + 'T12:00:00');
      const value = consolidatedNumeric(j, g.entries) ?? 0;
      return { label: fmt.format(ts), value, ts };
    })
    .filter(p => !isNaN(p.ts.getTime()))
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

function filterByRange(pts: ChartPoint[], range: '7D' | '30D' | 'All'): ChartPoint[] {
  const now = new Date();
  if (range === '7D') {
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return pts.filter(p => p.ts >= cutoff);
  }
  if (range === '30D') {
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return pts.filter(p => p.ts >= cutoff);
  }
  return pts;
}

function consolidatedNumeric(j: Journey, entries: JourneyEntry[]): number | null {
  const vm = j.derivedFrom?.valueMetric;
  const nums = entries.map(e => e.numericValue ?? 0);
  switch (vm) {
    case 'duration':   return nums.reduce((a, b) => a + b, 0);
    case 'count':      return nums.reduce((a, b) => a + b, 0);
    case 'start-time': return Math.min(...nums);
    case 'end-time':   return Math.max(...nums);
    default:           return null;
  }
}

function consolidatedValue(j: Journey, entries: JourneyEntry[]): string {
  const vm = j.derivedFrom?.valueMetric;
  const nums = entries.map(e => e.numericValue ?? 0);
  switch (vm) {
    case 'duration':   return fmtDuration(nums.reduce((a, b) => a + b, 0));
    case 'count':      return `${nums.reduce((a, b) => a + b, 0)}`;
    case 'start-time': return minsToTimeStr(Math.min(...nums));
    case 'end-time':   return minsToTimeStr(Math.max(...nums));
    default:           return `${nums.reduce((a, b) => a + b, 0)}`;
  }
}

function formatPointValue(j: Journey, v: number): string {
  if (j.trackerType === 'derived' && j.derivedFrom) {
    const vm = j.derivedFrom.valueMetric;
    if (vm === 'duration') return fmtDuration(v);
    if (vm === 'start-time' || vm === 'end-time') return minsToTimeStr(v);
    return String(Math.round(v));
  }
  const n = parseFloat(v.toFixed(2));
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatDiffValue(j: Journey, v: number): string {
  if (j.trackerType === 'derived' && j.derivedFrom) {
    const vm = j.derivedFrom.valueMetric;
    if (vm === 'duration') return fmtDuration(v);
    return `${Math.round(v)}m`;
  }
  const n = parseFloat(v.toFixed(2));
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function computeMetrics(j: Journey, allPts: ChartPoint[], entries: JourneyEntry[]) {
  if (allPts.length === 0) return { currentValue: null, avgValue: null, changeFromStart: null, sevenDayTrend: null, minValue: null, maxValue: null };

  const increaseIsPositive = j.config?.increaseIsPositive ?? true;
  const sentimentFor = (diff: number): 'good' | 'bad' | 'neutral' => {
    if (Math.abs(diff) < 0.001) return 'neutral';
    return (diff > 0) === increaseIsPositive ? 'good' : 'bad';
  };

  const currentValue = formatPointValue(j, allPts[allPts.length - 1].value);

  // avg
  let avgValue: string | null = null;
  if (j.trackerType === 'derived' && j.derivedFrom) {
    const vm = j.derivedFrom.valueMetric;
    const nums = entries.map(e => e.numericValue ?? 0);
    if (vm === 'duration') {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      avgValue = fmtDuration(avg);
    } else if (vm === 'start-time' || vm === 'end-time') {
      const avg = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
      avgValue = minsToTimeStr(avg);
    }
  } else if (j.trackerType === 'point-log' && j.config.valueType === 'numeric') {
    const byDate = new Map<string, number[]>();
    for (const e of entries) {
      if (e.numericValue === null) continue;
      const d = new Date(e.timestamp).toLocaleDateString('en-CA');
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(e.numericValue);
    }
    const dailyAvgs = Array.from(byDate.values()).map(vals => vals.reduce((a, b) => a + b, 0) / vals.length);
    if (dailyAvgs.length > 0) {
      const avg = dailyAvgs.reduce((a, b) => a + b, 0) / dailyAvgs.length;
      avgValue = Number.isInteger(avg) ? `${avg}` : avg.toFixed(2);
    }
  }

  // changeFromStart
  let changeFromStart: { text: string; sentiment: 'good' | 'bad' | 'neutral' } | null = null;
  if (allPts.length >= 2) {
    const diff = allPts[allPts.length - 1].value - allPts[0].value;
    if (Math.abs(diff) < 0.001) {
      changeFromStart = { text: '—', sentiment: 'neutral' };
    } else {
      const fmt2 = formatDiffValue(j, Math.abs(diff));
      changeFromStart = { text: diff > 0 ? `↑ +${fmt2}` : `↓ −${fmt2}`, sentiment: sentimentFor(diff) };
    }
  }

  // 7D trend
  let sevenDayTrend: { text: string; sentiment: 'good' | 'bad' | 'neutral' } | null = null;
  if (allPts.length >= 7) {
    const last7 = allPts.slice(-7);
    const prev7 = allPts.slice(Math.max(0, allPts.length - 14), allPts.length - 7);
    if (prev7.length > 0) {
      const avg7 = last7.reduce((s, p) => s + p.value, 0) / last7.length;
      const avgP = prev7.reduce((s, p) => s + p.value, 0) / prev7.length;
      const diff = avg7 - avgP;
      if (Math.abs(diff) < 0.001) {
        sevenDayTrend = { text: '—', sentiment: 'neutral' };
      } else {
        const fmt2 = formatDiffValue(j, Math.abs(diff));
        sevenDayTrend = { text: diff > 0 ? `↑ +${fmt2}` : `↓ −${fmt2}`, sentiment: sentimentFor(diff) };
      }
    }
  }

  const minValue = formatPointValue(j, Math.min(...allPts.map(p => p.value)));
  const maxValue = formatPointValue(j, Math.max(...allPts.map(p => p.value)));

  return { currentValue, avgValue, changeFromStart, sevenDayTrend, minValue, maxValue };
}

// ── Day group types ───────────────────────────────────────────────────────────

interface DayGroup {
  date: string;
  displayDate: string;
  entries: JourneyEntry[];
  count: number;
  consolidated: string;
  expanded: boolean;
}

interface PointLogGroup {
  date: string;
  displayDate: string;
  entries: JourneyEntry[];
}

function buildDerivedDayGroups(j: Journey, entries: JourneyEntry[], expandedDays: Record<string, boolean>): DayGroup[] {
  const byDate = new Map<string, JourneyEntry[]>();
  for (const e of entries) {
    const d = new Date(e.timestamp).toLocaleDateString('en-CA');
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(e);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayEntries]) => ({
      date,
      displayDate: fmtDateLong(date),
      entries: dayEntries,
      count: dayEntries.length,
      consolidated: consolidatedValue(j, dayEntries),
      expanded: !!expandedDays[date],
    }));
}

function buildPointLogDayGroups(entries: JourneyEntry[]): PointLogGroup[] {
  const byDate = new Map<string, JourneyEntry[]>();
  for (const e of entries) {
    const d = new Date(e.timestamp).toLocaleDateString('en-CA');
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(e);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayEntries]) => ({
      date,
      displayDate: fmtDateLong(date),
      entries: [...dayEntries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    }));
}

// ── Form blanks ───────────────────────────────────────────────────────────────

function blankCreateForm() {
  return {
    name:               '',
    startDate:          todayISO(),
    span:               'indefinite' as JourneySpan,
    endDate:            '',
    trackerType:        'point-log' as 'point-log' | 'derived',
    config:             { metricName: '', valueType: 'numeric' as ValueType, allowedValues: [] as string[], increaseIsPositive: true },
    derivedLogTypeId:   '',
    derivedValueMetric: 'duration' as ValueMetric,
  };
}

function blankEditForm(j: Journey) {
  return {
    name:               j.name,
    status:             j.status,
    span:               j.span,
    endDate:            j.endDate ?? '',
    config:             { metricName: j.config.metricName, valueType: j.config.valueType, increaseIsPositive: j.config.increaseIsPositive ?? true },
    derivedLogTypeId:   j.derivedFrom?.logTypeId ?? '',
    derivedValueMetric: j.derivedFrom?.valueMetric ?? ('duration' as ValueMetric),
  };
}

// ── ConfirmSheet sub-component ────────────────────────────────────────────────

function ConfirmSheet({
  title, body, danger, onCancel, onConfirm, confirmLabel,
}: {
  title: string; body: string; danger?: boolean;
  onCancel: () => void; onConfirm: () => void; confirmLabel: string;
}) {
  return (
    <Sheet open={true} onOpenChange={v => { if (!v) onCancel(); }}>
      <SheetContent side="bottom" className="jrn-sheet" showCloseButton={false}>
        <div className="jrn-sheet-handle" />
        <p className="jrn-sheet-title">{title}</p>
        <p className="jrn-sheet-body" dangerouslySetInnerHTML={{ __html: body }} />
        <div className="jrn-sheet-actions">
          <button className="jrn-pill-btn jrn-pill-btn--ghost jrn-pill-btn--full" onClick={onCancel}>Cancel</button>
          <button className={`jrn-pill-btn jrn-pill-btn--full ${danger ? 'jrn-pill-btn--danger' : 'jrn-pill-btn--primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── EditEntrySheet sub-component ──────────────────────────────────────────────

function EditEntrySheet({
  journey, entry, onClose, onSave, saving, error,
}: {
  journey: Journey;
  entry: JourneyEntry;
  onClose: () => void;
  onSave: (patch: { timestamp: string; numericValue?: number; categoricalValue?: string }) => void;
  saving: boolean;
  error: string;
}) {
  const ts = new Date(entry.timestamp);
  const [date, setDate] = useState(ts.toLocaleDateString('en-CA'));
  const [time, setTime] = useState(`${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`);
  const [numVal, setNumVal] = useState<string>(entry.numericValue !== null ? String(entry.numericValue) : '');
  const [catVal, setCatVal] = useState(entry.categoricalValue ?? '');

  function handleSave() {
    const [hh, mm] = time.split(':');
    const timestamp = new Date(`${date}T${hh}:${mm}:00`).toISOString();
    const vt = journey.config.valueType;
    onSave({
      timestamp,
      ...(vt === 'numeric'     ? { numericValue: parseFloat(numVal) }  : {}),
      ...(vt === 'categorical' ? { categoricalValue: catVal }          : {}),
    });
  }

  return (
    <Sheet open={true} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="jrn-sheet jrn-sheet--tall" showCloseButton={false}>
        <div className="jrn-sheet-handle" />
        <p className="jrn-sheet-title">Edit Entry</p>
        <div className="jrn-entry-fields" style={{ padding: '0 20px 4px' }}>
          <div className="jrn-field">
            <label className="jrn-label">Date</label>
            <input className="jrn-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="jrn-field">
            <label className="jrn-label">Time</label>
            <input className="jrn-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
          {journey.config.valueType === 'numeric' && (
            <div className="jrn-field">
              <label className="jrn-label">{journey.config.metricName || 'Value'}</label>
              <input className="jrn-input" type="number" step="any" value={numVal}
                     onChange={e => setNumVal(e.target.value)} />
            </div>
          )}
          {journey.config.valueType === 'categorical' && (
            <div className="jrn-field">
              <label className="jrn-label">{journey.config.metricName || 'Value'}</label>
              <select className="jrn-input" value={catVal} onChange={e => setCatVal(e.target.value)}>
                {journey.config.allowedValues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
        </div>
        {error && <div className="jrn-error-banner" style={{ margin: '0 20px 8px' }}>{error}</div>}
        <div className="jrn-sheet-actions">
          <button className="jrn-pill-btn jrn-pill-btn--ghost jrn-pill-btn--full" onClick={onClose}>Cancel</button>
          <button className="jrn-pill-btn jrn-pill-btn--primary jrn-pill-btn--full" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── TrendChart sub-component ──────────────────────────────────────────────────

function TrendChart({ j, pts }: { j: Journey; pts: ChartPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  const buildChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || pts.length < 2) return;
    chartRef.current?.destroy();

    const isDuration  = j.trackerType === 'derived' && j.derivedFrom?.valueMetric === 'duration';
    const isTimeOfDay = j.trackerType === 'derived' &&
      (j.derivedFrom?.valueMetric === 'start-time' || j.derivedFrom?.valueMetric === 'end-time');

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: pts.map(p => p.label),
        datasets: [{
          data: pts.map(p => p.value),
          borderColor: '#e94f37',
          backgroundColor: 'rgba(233,79,55,0.10)',
          fill: true,
          tension: 0.35,
          pointRadius: pts.length > 40 ? 2 : pts.length > 20 ? 3 : 4,
          pointBackgroundColor: '#e94f37',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.y as number;
                if (isDuration) return fmtDuration(v);
                if (isTimeOfDay) return minsToTimeStr(v);
                const unit = j.config?.metricName ?? '';
                return unit ? `${v} ${unit}` : `${v}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(128,128,128,0.08)' },
            ticks: { maxTicksLimit: 6, font: { size: 10 }, color: '#999' },
          },
          y: {
            grid: { color: 'rgba(128,128,128,0.08)' },
            ticks: {
              font: { size: 10 },
              color: '#999',
              callback: (v) => {
                const n = v as number;
                if (isDuration) { const h = Math.floor(n / 60); const m = Math.round(n % 60); return h > 0 ? `${h}h` : `${m}m`; }
                if (isTimeOfDay) { const h2 = Math.floor(n / 60); const ampm = h2 >= 12 ? 'PM' : 'AM'; return `${h2 % 12 || 12}${ampm}`; }
                return v;
              },
            },
          },
        },
      },
    });
  }, [j, pts]);

  useEffect(() => {
    buildChart();
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [buildChart]);

  return (
    <div className="jrn-chart-wrapper">
      <canvas ref={canvasRef} style={{ touchAction: 'pan-y' }} />
    </div>
  );
}

// ── CreateJourneyModal sub-component ──────────────────────────────────────────

function CreateJourneyModal({
  logTypes, onClose, onCreated, initialName = '',
}: {
  logTypes: ReturnType<typeof useLogTypes>['data'];
  onClose: () => void;
  onCreated: (j: Journey) => void;
  initialName?: string;
}) {
  const [form, setForm] = useState(() => ({ ...blankCreateForm(), name: initialName }));
  const [newAllowedValue, setNewAllowedValue] = useState('');
  const [createError, setCreateError] = useState('');
  const createJourney = useCreateJourney();

  const allTypes      = logTypes ?? [];
  const workTypes     = allTypes.filter(lt => lt.domain === 'work');
  const personalTypes = allTypes.filter(lt => lt.domain === 'personal');
  const familyTypes   = allTypes.filter(lt => lt.domain === 'family');

  function addAllowedValue() {
    const v = newAllowedValue.trim();
    if (v && !form.config.allowedValues.includes(v)) {
      setForm(f => ({ ...f, config: { ...f.config, allowedValues: [...f.config.allowedValues, v] } }));
    }
    setNewAllowedValue('');
  }

  function removeAllowedValue(i: number) {
    setForm(f => ({ ...f, config: { ...f.config, allowedValues: f.config.allowedValues.filter((_, idx) => idx !== i) } }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    if (!form.name.trim())  { setCreateError('Journey name is required.'); return; }
    if (!form.startDate)    { setCreateError('Start date is required.'); return; }
    if (form.span === 'definite' && !form.endDate) { setCreateError('End date is required.'); return; }
    if (form.trackerType === 'derived' && !form.derivedLogTypeId) { setCreateError('Please select a log type.'); return; }

    const lt = allTypes.find(t => t._id === form.derivedLogTypeId);
    const payload: Parameters<typeof createJourney.mutate>[0] = {
      name:        form.name.trim(),
      startDate:   form.startDate,
      span:        form.span,
      trackerType: form.trackerType,
      ...(form.span === 'definite' ? { endDate: form.endDate } : {}),
      ...(form.trackerType === 'derived'
        ? { derivedFrom: { logTypeId: form.derivedLogTypeId, logTypeName: lt?.name ?? '', valueMetric: form.derivedValueMetric }, config: { increaseIsPositive: form.config.increaseIsPositive } }
        : { config: form.config }),
    };
    createJourney.mutate(payload, {
      onSuccess: (created) => { onCreated(created); },
      onError: (err: unknown) => { setCreateError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create journey.'); },
    });
  }

  return (
    <Dialog open={true} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="jrn-modal" showCloseButton={false}>
        <div className="jrn-modal-hdr">
          <h2 className="jrn-form-title" style={{ margin: 0 }}>New Journey</h2>
          <button className="jrn-modal-x" type="button" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="jrn-modal-form">
          <div className="jrn-field">
            <label className="jrn-label">Journey Name <span className="jrn-req">*</span></label>
            <input className="jrn-input" type="text" value={form.name} placeholder="e.g. Weight Tracker, Daily Mood"
                   onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoComplete="off" />
          </div>

          <div className="jrn-field">
            <label className="jrn-label">Start Date <span className="jrn-req">*</span></label>
            <input className="jrn-input" type="date" value={form.startDate}
                   onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>

          <div className="jrn-field">
            <label className="jrn-label">Journey Span <span className="jrn-req">*</span></label>
            <div className="jrn-seg">
              {(['indefinite', 'definite'] as JourneySpan[]).map(s => (
                <button key={s} type="button" className={`jrn-seg-opt${form.span === s ? ' jrn-seg-opt--active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, span: s }))}>
                  {s === 'indefinite' ? 'Indefinite' : 'Fixed End Date'}
                </button>
              ))}
            </div>
          </div>

          {form.span === 'definite' && (
            <div className="jrn-field">
              <label className="jrn-label">End Date <span className="jrn-req">*</span></label>
              <input className="jrn-input" type="date" value={form.endDate}
                     onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          )}

          <div className="jrn-field">
            <label className="jrn-label">Tracker Type <span className="jrn-req">*</span></label>
            <div className="jrn-tracker-grid">
              {(['point-log', 'derived'] as const).map(tt => (
                <button key={tt} type="button"
                        className={`jrn-tracker-tile${form.trackerType === tt ? ' jrn-tracker-tile--active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, trackerType: tt }))}>
                  <span className="jrn-tracker-icon">{tt === 'point-log' ? '📍' : '🔗'}</span>
                  <span className="jrn-tracker-name">{tt === 'point-log' ? 'Point Log' : 'Derived'}</span>
                  <span className="jrn-tracker-badge">v1</span>
                </button>
              ))}
              <button type="button" className="jrn-tracker-tile jrn-tracker-tile--soon" disabled>
                <span className="jrn-tracker-icon">⏱</span>
                <span className="jrn-tracker-name">Time Period</span>
                <span className="jrn-tracker-badge jrn-tracker-badge--soon">soon</span>
              </button>
              <button type="button" className="jrn-tracker-tile jrn-tracker-tile--soon" disabled>
                <span className="jrn-tracker-icon">📝</span>
                <span className="jrn-tracker-name">Journal</span>
                <span className="jrn-tracker-badge jrn-tracker-badge--soon">soon</span>
              </button>
            </div>
          </div>

          {form.trackerType === 'point-log' && (
            <div className="jrn-config-block">
              <p className="jrn-config-label">Point Log Setup</p>
              <div className="jrn-field">
                <label className="jrn-label">Metric Name</label>
                <input className="jrn-input" type="text" placeholder="Weight, Mood, Steps, Score…"
                       value={form.config.metricName}
                       onChange={e => setForm(f => ({ ...f, config: { ...f.config, metricName: e.target.value } }))} />
              </div>
              <div className="jrn-field">
                <label className="jrn-label">Value Type <span className="jrn-req">*</span></label>
                <div className="jrn-seg">
                  {(['numeric', 'categorical'] as ValueType[]).map(vt => (
                    <button key={vt} type="button"
                            className={`jrn-seg-opt${form.config.valueType === vt ? ' jrn-seg-opt--active' : ''}`}
                            onClick={() => setForm(f => ({ ...f, config: { ...f.config, valueType: vt } }))}>
                      {vt === 'numeric' ? 'Numeric' : 'Categorical'}
                    </button>
                  ))}
                </div>
              </div>
              {form.config.valueType === 'numeric' && (
                <div className="jrn-field">
                  <label className="jrn-label">Goal Direction</label>
                  <div className="jrn-seg">
                    <button type="button" className={`jrn-seg-opt${form.config.increaseIsPositive ? ' jrn-seg-opt--active' : ''}`}
                            onClick={() => setForm(f => ({ ...f, config: { ...f.config, increaseIsPositive: true } }))}>↑ Higher is better</button>
                    <button type="button" className={`jrn-seg-opt${!form.config.increaseIsPositive ? ' jrn-seg-opt--active' : ''}`}
                            onClick={() => setForm(f => ({ ...f, config: { ...f.config, increaseIsPositive: false } }))}>↓ Lower is better</button>
                  </div>
                </div>
              )}
              {form.config.valueType === 'categorical' && (
                <div className="jrn-field">
                  <label className="jrn-label">Allowed Values</label>
                  {form.config.allowedValues.length > 0 && (
                    <div className="jrn-tags">
                      {form.config.allowedValues.map((v, i) => (
                        <span key={i} className="jrn-tag">
                          {v}
                          <button type="button" className="jrn-tag-remove" onClick={() => removeAllowedValue(i)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="jrn-tag-input-row">
                    <input className="jrn-input" type="text" placeholder="e.g. Happy, Neutral, Sad"
                           value={newAllowedValue}
                           onChange={e => setNewAllowedValue(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAllowedValue(); } }} />
                    <button type="button" className="jrn-pill-btn jrn-pill-btn--ghost jrn-pill-btn--sm" onClick={addAllowedValue}>Add</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {form.trackerType === 'derived' && (
            <div className="jrn-config-block">
              <p className="jrn-config-label">Derived Setup</p>
              <div className="jrn-field">
                <label className="jrn-label">Log Type to track <span className="jrn-req">*</span></label>
                <select className="jrn-input" value={form.derivedLogTypeId}
                        onChange={e => setForm(f => ({ ...f, derivedLogTypeId: e.target.value }))}>
                  <option value="" disabled>Select a log type…</option>
                  {workTypes.length > 0 && <optgroup label="Work">{workTypes.map(lt => <option key={lt._id} value={lt._id}>{lt.name}</option>)}</optgroup>}
                  {personalTypes.length > 0 && <optgroup label="Personal">{personalTypes.map(lt => <option key={lt._id} value={lt._id}>{lt.name}</option>)}</optgroup>}
                  {familyTypes.length > 0 && <optgroup label="Family">{familyTypes.map(lt => <option key={lt._id} value={lt._id}>{lt.name}</option>)}</optgroup>}
                </select>
              </div>
              <div className="jrn-field">
                <label className="jrn-label">Value to track</label>
                <div className="jrn-metric-grid">
                  {VALUE_METRIC_OPTIONS.map(m => (
                    <button key={m.value} type="button"
                            className={`jrn-metric-opt${form.derivedValueMetric === m.value ? ' jrn-metric-opt--active' : ''}`}
                            onClick={() => setForm(f => ({ ...f, derivedValueMetric: m.value }))}>
                      <span className="jrn-metric-icon">{m.icon}</span>
                      <span className="jrn-metric-label">{m.label}</span>
                      <span className="jrn-metric-hint">{m.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="jrn-field">
                <label className="jrn-label">Goal Direction</label>
                <div className="jrn-seg">
                  <button type="button" className={`jrn-seg-opt${form.config.increaseIsPositive ? ' jrn-seg-opt--active' : ''}`}
                          onClick={() => setForm(f => ({ ...f, config: { ...f.config, increaseIsPositive: true } }))}>↑ Higher is better</button>
                  <button type="button" className={`jrn-seg-opt${!form.config.increaseIsPositive ? ' jrn-seg-opt--active' : ''}`}
                          onClick={() => setForm(f => ({ ...f, config: { ...f.config, increaseIsPositive: false } }))}>↓ Lower is better</button>
                </div>
              </div>
            </div>
          )}

          {createError && <div className="jrn-error-banner">{createError}</div>}

          <div className="jrn-form-actions">
            <button type="button" className="jrn-pill-btn jrn-pill-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="jrn-pill-btn jrn-pill-btn--primary" disabled={createJourney.isPending}>
              {createJourney.isPending ? 'Creating…' : 'Create Journey'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main JourneysPage ─────────────────────────────────────────────────────────

export default function JourneysPage() {
  const [view, setView]               = useState<'list' | 'detail'>('list');
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [editingJourney, setEditingJourney]   = useState(false);
  const [editForm, setEditForm]       = useState<ReturnType<typeof blankEditForm> | null>(null);
  const [editError, setEditError]     = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [presetName, setPresetName]   = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [addingEntry, setAddingEntry] = useState(false);
  const [entryDate, setEntryDate]     = useState('');
  const [entryTime, setEntryTime]     = useState('');
  const [entryNumVal, setEntryNumVal] = useState('');
  const [entryCatVal, setEntryCatVal] = useState('');
  const [entryError, setEntryError]   = useState('');
  const [editingEntry, setEditingEntry] = useState<JourneyEntry | null>(null);
  const [editEntryError, setEditEntryError] = useState('');
  const [chartRange, setChartRange]   = useState<'7D' | '30D' | 'All'>('30D');

  const { data: journeys, isLoading: journeysLoading } = useJourneys();
  const { data: logTypes }                              = useLogTypes();
  const { data: entries, isLoading: entriesLoading }   = useJourneyEntries(selectedJourney?.id ?? null);

  const updateJourney    = useUpdateJourney();
  const deleteJourney    = useDeleteJourney();
  const addEntry         = useAddJourneyEntry(selectedJourney?.id ?? '');
  const updateEntry      = useUpdateJourneyEntry(selectedJourney?.id ?? '');
  const deleteEntry      = useDeleteJourneyEntry(selectedJourney?.id ?? '');
  const resyncJourney    = useResyncJourney(selectedJourney?.id ?? '');

  const allLogTypes      = logTypes ?? [];
  const journeyList      = journeys ?? [];
  const entryList        = entries ?? [];

  // Keep selectedJourney in sync with updated journeys list
  useEffect(() => {
    if (!selectedJourney || !journeys) return;
    const updated = journeys.find(j => j.id === selectedJourney.id);
    if (updated && updated !== selectedJourney) setSelectedJourney(updated);
  }, [journeys, selectedJourney]);

  // ── Derived data ────────────────────────────────────────────

  const dayGroups      = selectedJourney?.trackerType === 'derived'
    ? buildDerivedDayGroups(selectedJourney, entryList, expandedDays)
    : [];
  const pointLogGroups = selectedJourney?.trackerType !== 'derived'
    ? buildPointLogDayGroups(entryList)
    : [];
  const allChartPoints = selectedJourney ? buildChartPoints(selectedJourney, entryList, dayGroups) : [];
  const filteredPts    = filterByRange(allChartPoints, chartRange);
  const metrics        = selectedJourney && isNumericJourney(selectedJourney) && entryList.length > 0
    ? computeMetrics(selectedJourney, allChartPoints, entryList)
    : null;

  // ── Handlers ─────────────────────────────────────────────────

  function openDetail(j: Journey) {
    setSelectedJourney(j);
    setView('detail');
    setAddingEntry(false);
    setEntryError('');
    setExpandedDays({});
    setEditingJourney(false);
    setShowDeleteConfirm(false);
    setChartRange('30D');
  }

  function backToList() {
    setView('list');
    setSelectedJourney(null);
    setEditingJourney(false);
    setShowDeleteConfirm(false);
  }

  function openCreate(name = '') {
    setPresetName(name);
    setShowCreateModal(true);
  }

  function handleCreated(j: Journey) {
    setShowCreateModal(false);
    openDetail(j);
    if (j.trackerType === 'derived') {
      setTimeout(() => resyncJourney.mutate(), 400);
    }
  }

  function openEditJourney() {
    if (!selectedJourney) return;
    setEditForm(blankEditForm(selectedJourney));
    setEditError('');
    setEditingJourney(true);
  }

  function cancelEditJourney() {
    setEditingJourney(false);
    setEditError('');
  }

  function saveEditJourney() {
    if (!selectedJourney || !editForm) return;
    setEditError('');
    if (!editForm.name.trim()) { setEditError('Name is required.'); return; }
    const isDerived = selectedJourney.trackerType === 'derived';
    const lt = allLogTypes.find(t => t._id === editForm.derivedLogTypeId);
    const patch: Record<string, unknown> = {
      name:    editForm.name.trim(),
      status:  editForm.status,
      span:    editForm.span,
      endDate: editForm.span === 'definite' ? editForm.endDate : null,
    };
    if (!isDerived) {
      patch.config = editForm.config;
    } else {
      patch.config = { increaseIsPositive: editForm.config.increaseIsPositive };
      if (editForm.derivedLogTypeId) {
        patch.derivedFrom = {
          logTypeId:   editForm.derivedLogTypeId,
          logTypeName: lt?.name ?? selectedJourney.derivedFrom?.logTypeName ?? '',
          valueMetric: editForm.derivedValueMetric,
        };
      }
    }
    const metricChanged = isDerived && (
      (patch.derivedFrom as { logTypeId?: string })?.logTypeId   !== selectedJourney.derivedFrom?.logTypeId ||
      (patch.derivedFrom as { valueMetric?: string })?.valueMetric !== selectedJourney.derivedFrom?.valueMetric
    );
    updateJourney.mutate({ id: selectedJourney.id, patch }, {
      onSuccess: (updated) => {
        setSelectedJourney(updated);
        setEditingJourney(false);
        if (metricChanged) resyncJourney.mutate();
      },
      onError: (err: unknown) => {
        setEditError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save.');
      },
    });
  }

  function handleDeleteJourney() {
    if (!selectedJourney) return;
    deleteJourney.mutate(selectedJourney.id, {
      onSuccess: () => { setShowDeleteConfirm(false); backToList(); },
    });
  }

  function openAddEntry() {
    const now = new Date();
    setEntryDate(now.toLocaleDateString('en-CA'));
    setEntryTime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    setEntryNumVal('');
    setEntryCatVal('');
    setEntryError('');
    setAddingEntry(true);
  }

  function submitEntry() {
    if (!selectedJourney) return;
    setEntryError('');
    const vt = selectedJourney.config.valueType;
    if (!entryDate) { setEntryError('Date is required.'); return; }
    if (vt === 'numeric' && entryNumVal === '') { setEntryError('Value is required.'); return; }
    if (vt === 'categorical' && !entryCatVal)   { setEntryError('Please select a value.'); return; }
    const [hh, mm] = entryTime.split(':');
    const payload = {
      timestamp:   new Date(`${entryDate}T${hh}:${mm}:00`).toISOString(),
      valueType:   vt,
      ...(vt === 'numeric'     ? { numericValue: parseFloat(entryNumVal) } : {}),
      ...(vt === 'categorical' ? { categoricalValue: entryCatVal }         : {}),
    };
    addEntry.mutate(payload, {
      onSuccess: () => { setAddingEntry(false); setEntryError(''); },
      onError:   (err: unknown) => { setEntryError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save entry.'); },
    });
  }

  function handleDeleteEntry(entry: JourneyEntry) {
    deleteEntry.mutate(entry.id);
  }

  function handleSaveEditEntry(patch: { timestamp: string; numericValue?: number; categoricalValue?: string }) {
    if (!editingEntry) return;
    updateEntry.mutate({ entryId: editingEntry.id, patch }, {
      onSuccess: () => { setEditingEntry(null); setEditEntryError(''); },
      onError:   (err: unknown) => { setEditEntryError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update.'); },
    });
  }

  // ── Render list view ─────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="jrn-root">
        <div className="jrn-page-header">
          <div>
            <h2 className="jrn-page-title">Journey Logs</h2>
            <p className="jrn-page-sub">Track anything that matters over time</p>
          </div>
          <button className="jrn-pill-btn jrn-pill-btn--primary" onClick={() => openCreate()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        </div>

        {journeysLoading && (
          <div className="jrn-loading"><span className="jrn-loading-dot" />Loading journeys…</div>
        )}

        {!journeysLoading && journeyList.length === 0 && (
          <div className="jrn-empty">
            <div className="jrn-empty-orb">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <p className="jrn-empty-title">Start your first journey</p>
            <p className="jrn-empty-sub">Track weight, mood, steps — anything with a date and a value.</p>
            <button className="jrn-pill-btn jrn-pill-btn--primary" onClick={() => openCreate()}>Create Journey</button>
          </div>
        )}

        {journeyList.length > 0 && (
          <div className="jrn-card-list">
            {journeyList.map(j => (
              <div key={j.id} className="jrn-journey-card" onClick={() => openDetail(j)}>
                <div className="jrn-journey-card-body">
                  <div className="jrn-journey-card-top">
                    <span className="jrn-journey-name">{j.name}</span>
                    <span className={`jrn-status-pill jrn-status--${j.status}`}>{j.status}</span>
                  </div>
                  <div className="jrn-journey-card-chips">
                    <span className="jrn-chip">{j.config.metricName || j.derivedFrom?.logTypeName || 'Metric'}</span>
                    <span className="jrn-chip jrn-chip--dim">
                      {fmtDateShort(j.startDate)}
                      {j.span === 'indefinite' && ' · ongoing'}
                      {j.span === 'definite' && j.endDate && ` → ${fmtDateShort(j.endDate)}`}
                    </span>
                  </div>
                  {j.lastEntry ? (
                    <div className="jrn-card-summary">
                      <span className="jrn-card-last">
                        Last: <strong>{j.lastEntry.valueType === 'numeric' ? j.lastEntry.value : j.lastEntry.catValue}</strong>
                        <span className="jrn-card-last-date"> · {fmtDateShort(j.lastEntry.timestamp)}</span>
                      </span>
                      <Sparkline values={j.recentValues} />
                    </div>
                  ) : (
                    <span className="jrn-card-no-entries">No entries yet</span>
                  )}
                </div>
                <svg className="jrn-journey-card-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))}
          </div>
        )}

        {!journeysLoading && (
          <div className="jrn-suggest-bar">
            <span className="jrn-suggest-label">Track something new</span>
            <div className="jrn-suggest-chips">
              {JOURNEY_SUGGESTIONS.map(s => (
                <button key={s} className="jrn-suggest-chip" onClick={() => openCreate(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {showCreateModal && (
          <CreateJourneyModal
            logTypes={logTypes}
            initialName={presetName}
            onClose={() => setShowCreateModal(false)}
            onCreated={handleCreated}
          />
        )}
      </div>
    );
  }

  // ── Render detail view ───────────────────────────────────────

  const j = selectedJourney!;

  return (
    <div className="jrn-root">
      <div className="jrn-nav-row">
        <button className="jrn-back-btn" onClick={backToList}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Journeys
        </button>
      </div>

      {/* ── Hero card: view mode ─────────────────────────────── */}
      {!editingJourney && (
        <div className="jrn-hero-card">
          <div className="jrn-hero-top">
            <h2 className="jrn-hero-name">{j.name}</h2>
            <div className="jrn-hero-top-right">
              <span className={`jrn-status-pill jrn-status--${j.status}`}>{j.status}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="jrn-more-btn" aria-label="More options">⋯</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={openEditJourney}>Edit journey</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setShowDeleteConfirm(true)}>Delete journey</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="jrn-hero-chips">
            {j.trackerType !== 'derived' && <span className="jrn-chip">{j.config.metricName || 'Metric'}</span>}
            {j.trackerType === 'derived' && j.derivedFrom && <span className="jrn-chip">{j.derivedFrom.logTypeName || 'Logger'}</span>}
            {j.trackerType !== 'derived' && <span className="jrn-chip jrn-chip--dim">{j.config.valueType}</span>}
            {j.trackerType === 'derived' && j.derivedFrom && <span className="jrn-chip jrn-chip--dim">{valueMetricLabel(j.derivedFrom.valueMetric)}</span>}
            <span className="jrn-chip jrn-chip--dim">
              {fmtDateShort(j.startDate)}
              {j.span === 'indefinite' && ' · ongoing'}
              {j.span === 'definite' && j.endDate && ` → ${fmtDateShort(j.endDate)}`}
            </span>
          </div>
          {j.trackerType === 'derived' && j.derivedFrom && (
            <div className="jrn-derived-banner">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Auto-synced from <strong>&nbsp;{j.derivedFrom.logTypeName || 'Logger'}</strong>&nbsp;· tracks {valueMetricLabel(j.derivedFrom.valueMetric)}
            </div>
          )}
          <div className="jrn-hero-footer">
            <button className="jrn-hero-edit-btn" onClick={openEditJourney}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          </div>
        </div>
      )}

      {/* ── Hero card: edit mode ─────────────────────────────── */}
      {editingJourney && editForm && (
        <div className="jrn-hero-card jrn-hero-card--edit">
          <p className="jrn-edit-heading">Edit Journey</p>

          <div className="jrn-field">
            <label className="jrn-label">Name</label>
            <input className="jrn-input" type="text" value={editForm.name} autoComplete="off"
                   onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)} />
          </div>

          <div className="jrn-field">
            <label className="jrn-label">Status</label>
            <div className="jrn-seg">
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} type="button"
                        className={`jrn-seg-opt${editForm.status === s.value ? ' jrn-seg-opt--active' : ''}`}
                        onClick={() => setEditForm(f => f ? { ...f, status: s.value as import('@/types').JourneyStatus } : f)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="jrn-field">
            <label className="jrn-label">Span</label>
            <div className="jrn-seg">
              <button type="button" className={`jrn-seg-opt${editForm.span === 'indefinite' ? ' jrn-seg-opt--active' : ''}`}
                      onClick={() => setEditForm(f => f ? { ...f, span: 'indefinite' } : f)}>Indefinite</button>
              <button type="button" className={`jrn-seg-opt${editForm.span === 'definite' ? ' jrn-seg-opt--active' : ''}`}
                      onClick={() => setEditForm(f => f ? { ...f, span: 'definite' } : f)}>Fixed End</button>
            </div>
          </div>

          {editForm.span === 'definite' && (
            <div className="jrn-field">
              <label className="jrn-label">End Date</label>
              <input className="jrn-input" type="date" value={editForm.endDate}
                     onChange={e => setEditForm(f => f ? { ...f, endDate: e.target.value } : f)} />
            </div>
          )}

          {j.trackerType === 'point-log' && (
            <>
              <div className="jrn-field">
                <label className="jrn-label">Metric Name</label>
                <input className="jrn-input" type="text" value={editForm.config.metricName} autoComplete="off"
                       onChange={e => setEditForm(f => f ? { ...f, config: { ...f.config, metricName: e.target.value } } : f)} />
              </div>
              <div className="jrn-field">
                <label className="jrn-label">Value Type</label>
                <div className="jrn-seg">
                  {(['numeric', 'categorical'] as ValueType[]).map(vt => (
                    <button key={vt} type="button"
                            className={`jrn-seg-opt${editForm.config.valueType === vt ? ' jrn-seg-opt--active' : ''}`}
                            onClick={() => setEditForm(f => f ? { ...f, config: { ...f.config, valueType: vt } } : f)}>
                      {vt === 'numeric' ? 'Numeric' : 'Categorical'}
                    </button>
                  ))}
                </div>
              </div>
              {editForm.config.valueType === 'numeric' && (
                <div className="jrn-field">
                  <label className="jrn-label">Goal Direction</label>
                  <div className="jrn-seg">
                    <button type="button" className={`jrn-seg-opt${editForm.config.increaseIsPositive ? ' jrn-seg-opt--active' : ''}`}
                            onClick={() => setEditForm(f => f ? { ...f, config: { ...f.config, increaseIsPositive: true } } : f)}>↑ Higher is better</button>
                    <button type="button" className={`jrn-seg-opt${!editForm.config.increaseIsPositive ? ' jrn-seg-opt--active' : ''}`}
                            onClick={() => setEditForm(f => f ? { ...f, config: { ...f.config, increaseIsPositive: false } } : f)}>↓ Lower is better</button>
                  </div>
                </div>
              )}
            </>
          )}

          {j.trackerType === 'derived' && (
            <>
              <div className="jrn-field">
                <label className="jrn-label">Log Type to track</label>
                <select className="jrn-input" value={editForm.derivedLogTypeId}
                        onChange={e => setEditForm(f => f ? { ...f, derivedLogTypeId: e.target.value } : f)}>
                  <option value="" disabled>Select a log type…</option>
                  {allLogTypes.filter(lt => lt.domain === 'work').length > 0 && (
                    <optgroup label="Work">{allLogTypes.filter(lt => lt.domain === 'work').map(lt => <option key={lt._id} value={lt._id}>{lt.name}</option>)}</optgroup>
                  )}
                  {allLogTypes.filter(lt => lt.domain === 'personal').length > 0 && (
                    <optgroup label="Personal">{allLogTypes.filter(lt => lt.domain === 'personal').map(lt => <option key={lt._id} value={lt._id}>{lt.name}</option>)}</optgroup>
                  )}
                  {allLogTypes.filter(lt => lt.domain === 'family').length > 0 && (
                    <optgroup label="Family">{allLogTypes.filter(lt => lt.domain === 'family').map(lt => <option key={lt._id} value={lt._id}>{lt.name}</option>)}</optgroup>
                  )}
                </select>
              </div>
              <div className="jrn-field">
                <label className="jrn-label">Value to track</label>
                <div className="jrn-metric-grid">
                  {VALUE_METRIC_OPTIONS.map(m => (
                    <button key={m.value} type="button"
                            className={`jrn-metric-opt${editForm.derivedValueMetric === m.value ? ' jrn-metric-opt--active' : ''}`}
                            onClick={() => setEditForm(f => f ? { ...f, derivedValueMetric: m.value } : f)}>
                      <span className="jrn-metric-icon">{m.icon}</span>
                      <span className="jrn-metric-label">{m.label}</span>
                      <span className="jrn-metric-hint">{m.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="jrn-field">
                <label className="jrn-label">Goal Direction</label>
                <div className="jrn-seg">
                  <button type="button" className={`jrn-seg-opt${editForm.config.increaseIsPositive ? ' jrn-seg-opt--active' : ''}`}
                          onClick={() => setEditForm(f => f ? { ...f, config: { ...f.config, increaseIsPositive: true } } : f)}>↑ Higher is better</button>
                  <button type="button" className={`jrn-seg-opt${!editForm.config.increaseIsPositive ? ' jrn-seg-opt--active' : ''}`}
                          onClick={() => setEditForm(f => f ? { ...f, config: { ...f.config, increaseIsPositive: false } } : f)}>↓ Lower is better</button>
                </div>
              </div>
            </>
          )}

          {editError && <div className="jrn-error-banner">{editError}</div>}

          <div className="jrn-form-actions">
            <button type="button" className="jrn-pill-btn jrn-pill-btn--ghost" onClick={cancelEditJourney}>Cancel</button>
            <button type="button" className="jrn-pill-btn jrn-pill-btn--primary"
                    disabled={updateJourney.isPending} onClick={saveEditJourney}>
              {updateJourney.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* ── Metrics card ─────────────────────────────────────── */}
      {metrics && isNumericJourney(j) && entryList.length > 0 && (
        <div className="jrn-metrics-card">
          <p className="jrn-metrics-heading">Metrics</p>
          <div className="jrn-metrics-grid">
            {metrics.currentValue !== null && (
              <div className="jrn-metric-tile">
                <span className="jrn-metric-tile-label">Current</span>
                <span className="jrn-metric-tile-value">{metrics.currentValue}</span>
                <span className="jrn-metric-tile-sub">{j.trackerType === 'point-log' ? j.config.metricName : valueMetricLabel(j.derivedFrom!.valueMetric)}</span>
              </div>
            )}
            {metrics.avgValue !== null && (
              <div className="jrn-metric-tile">
                <span className="jrn-metric-tile-label">Average</span>
                <span className="jrn-metric-tile-value">{metrics.avgValue}</span>
                <span className="jrn-metric-tile-sub">{j.trackerType === 'point-log' ? j.config.metricName : `${entryList.length} total`}</span>
              </div>
            )}
            {metrics.changeFromStart !== null && (
              <div className="jrn-metric-tile">
                <span className="jrn-metric-tile-label">Change</span>
                <span className={`jrn-metric-tile-value jrn-delta--${metrics.changeFromStart.sentiment}`}>{metrics.changeFromStart.text}</span>
                <span className="jrn-metric-tile-sub">from start</span>
              </div>
            )}
            {metrics.sevenDayTrend !== null && (
              <div className="jrn-metric-tile">
                <span className="jrn-metric-tile-label">Trend (7D)</span>
                <span className={`jrn-metric-tile-value jrn-delta--${metrics.sevenDayTrend.sentiment}`}>{metrics.sevenDayTrend.text}</span>
                <span className="jrn-metric-tile-sub">vs prev 7</span>
              </div>
            )}
            {metrics.minValue !== null && (
              <div className="jrn-metric-tile">
                <span className="jrn-metric-tile-label">Min</span>
                <span className="jrn-metric-tile-value">{metrics.minValue}</span>
                <span className="jrn-metric-tile-sub">recorded</span>
              </div>
            )}
            {metrics.maxValue !== null && (
              <div className="jrn-metric-tile">
                <span className="jrn-metric-tile-label">Max</span>
                <span className="jrn-metric-tile-value">{metrics.maxValue}</span>
                <span className="jrn-metric-tile-sub">recorded</span>
              </div>
            )}
          </div>

          {allChartPoints.length > 1 && (
            <div className="jrn-chart-section">
              <div className="jrn-chart-range-row">
                {(['7D', '30D', 'All'] as const).map(r => (
                  <button key={r} className={`jrn-range-btn${chartRange === r ? ' jrn-range-btn--active' : ''}`}
                          onClick={() => setChartRange(r)}>{r}</button>
                ))}
              </div>
              <TrendChart j={j} pts={filteredPts} />
            </div>
          )}
        </div>
      )}

      {/* ── Entries section header ────────────────────────────── */}
      <div className="jrn-section-header">
        <span className="jrn-section-title">Entries</span>
        <div className="jrn-section-actions">
          {j.trackerType === 'derived' && (
            <button className="jrn-pill-btn jrn-pill-btn--ghost jrn-pill-btn--sm"
                    disabled={resyncJourney.isPending} onClick={() => resyncJourney.mutate()}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {resyncJourney.isPending ? 'Syncing…' : 'Re-sync'}
            </button>
          )}
          {j.trackerType !== 'derived' && (
            <button className="jrn-pill-btn jrn-pill-btn--primary jrn-pill-btn--sm"
                    onClick={() => addingEntry ? (setAddingEntry(false)) : openAddEntry()}>
              {addingEntry ? '✕ Cancel' : '+ Add Entry'}
            </button>
          )}
        </div>
      </div>

      {/* ── Add entry form ──────────────────────────────────────── */}
      {addingEntry && (
        <div className="jrn-entry-form-card">
          <div className="jrn-entry-fields">
            <div className="jrn-field">
              <label className="jrn-label">Date</label>
              <input className="jrn-input" type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            </div>
            <div className="jrn-field">
              <label className="jrn-label">Time</label>
              <input className="jrn-input" type="time" value={entryTime} onChange={e => setEntryTime(e.target.value)} />
            </div>
            {j.config.valueType === 'numeric' && (
              <div className="jrn-field">
                <label className="jrn-label">{j.config.metricName || 'Value'}</label>
                <input className="jrn-input" type="number" step="any" placeholder="0.0"
                       value={entryNumVal} onChange={e => setEntryNumVal(e.target.value)} />
              </div>
            )}
            {j.config.valueType === 'categorical' && (
              <div className="jrn-field">
                <label className="jrn-label">{j.config.metricName || 'Value'}</label>
                <select className="jrn-input" value={entryCatVal} onChange={e => setEntryCatVal(e.target.value)}>
                  <option value="" disabled>Select…</option>
                  {j.config.allowedValues.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
          </div>
          {entryError && <div className="jrn-error-banner">{entryError}</div>}
          <button className="jrn-pill-btn jrn-pill-btn--primary jrn-entry-save-btn"
                  disabled={addEntry.isPending} onClick={submitEntry}>
            {addEntry.isPending ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      )}

      {/* ── Empty entries ──────────────────────────────────────── */}
      {entryList.length === 0 && !entriesLoading && !addingEntry && (
        <div className="jrn-empty jrn-empty--sm">
          <div className="jrn-empty-orb jrn-empty-orb--sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <p className="jrn-empty-title">No entries yet</p>
          {j.trackerType === 'derived' ? (
            <>
              <p className="jrn-empty-sub">Log something under <strong>{j.derivedFrom?.logTypeName}</strong> and entries will appear automatically.</p>
              <button className="jrn-pill-btn jrn-pill-btn--ghost jrn-pill-btn--sm"
                      disabled={resyncJourney.isPending} onClick={() => resyncJourney.mutate()}>
                {resyncJourney.isPending ? 'Syncing…' : 'Re-sync from history'}
              </button>
            </>
          ) : (
            <button className="jrn-pill-btn jrn-pill-btn--primary jrn-pill-btn--sm" onClick={openAddEntry}>Add first entry</button>
          )}
        </div>
      )}

      {/* ── Entries list ──────────────────────────────────────── */}
      {entryList.length > 0 && (
        <div className="jrn-entries">

          {/* Derived: day groups */}
          {j.trackerType === 'derived' && dayGroups.map(group => (
            <div key={group.date} className="jrn-day-group">
              <div className="jrn-day-row" onClick={() => setExpandedDays(ed => ({ ...ed, [group.date]: !ed[group.date] }))}>
                <div className="jrn-entry-left">
                  <span className="jrn-entry-date">{group.displayDate}</span>
                </div>
                <span className="jrn-day-count-chip">{group.count} log{group.count !== 1 ? 's' : ''}</span>
                <span className="jrn-entry-value">{group.consolidated}</span>
                <svg className={`jrn-expand-chevron${group.expanded ? ' jrn-expand-chevron--open' : ''}`}
                     width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {group.expanded && (
                <div className="jrn-day-sub-entries">
                  {group.entries.map(e => (
                    <div key={e.id} className="jrn-sub-entry">
                      <span className="jrn-sub-time">{fmtTimestamp(e.timestamp)}</span>
                      <span className="jrn-entry-value jrn-sub-value">
                        {j.derivedFrom?.valueMetric === 'duration' && `${e.numericValue}m`}
                        {j.derivedFrom?.valueMetric === 'count' && '1'}
                        {(j.derivedFrom?.valueMetric === 'start-time' || j.derivedFrom?.valueMetric === 'end-time') && e.numericValue !== null && minsToTimeStr(e.numericValue)}
                      </span>
                      <span className="jrn-sync-dot" title="Auto-synced from Logger">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Point-log: date groups */}
          {j.trackerType !== 'derived' && pointLogGroups.map(group => (
            <div key={group.date} className="jrn-pl-group">
              <div className="jrn-pl-date-row">
                <span className="jrn-pl-date-label">{group.displayDate}</span>
                {group.entries.length > 1 && <span className="jrn-pl-count">{group.entries.length}</span>}
              </div>
              {group.entries.map(e => (
                <div key={e.id} className="jrn-entry-card" onClick={() => setEditingEntry(e)}>
                  <div className="jrn-entry-left">
                    <span className="jrn-entry-time">{fmtTimestamp(e.timestamp)}</span>
                  </div>
                  {e.valueType === 'numeric' && <span className="jrn-entry-value">{e.numericValue}</span>}
                  {e.valueType === 'categorical' && <span className="jrn-entry-pill">{e.categoricalValue}</span>}
                  <button className="jrn-entry-del-btn" title="Delete"
                          onClick={ev => { ev.stopPropagation(); handleDeleteEntry(e); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {entriesLoading && (
        <div className="jrn-loading"><span className="jrn-loading-dot" />Loading entries…</div>
      )}

      {/* ── Edit entry sheet ──────────────────────────────────── */}
      {editingEntry && (
        <EditEntrySheet
          journey={j}
          entry={editingEntry}
          onClose={() => { setEditingEntry(null); setEditEntryError(''); }}
          onSave={handleSaveEditEntry}
          saving={updateEntry.isPending}
          error={editEntryError}
        />
      )}

      {/* ── Delete confirm sheet ──────────────────────────────── */}
      {showDeleteConfirm && (
        <ConfirmSheet
          title="Delete journey?"
          body={`<strong>${j.name}</strong> and all its entries will be permanently removed.`}
          danger
          confirmLabel={deleteJourney.isPending ? 'Deleting…' : 'Delete'}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteJourney}
        />
      )}

      {/* ── Create modal (opened from detail-view "add sibling" — not typical, but kept for completeness) */}
      {showCreateModal && (
        <CreateJourneyModal
          logTypes={logTypes}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
