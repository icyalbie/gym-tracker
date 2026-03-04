import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { supabase } from './supabase';
import './WeightLogger.css';

const STORAGE_KEY = 'gymtracker_weight';

const RANGES = [
  { key: 'W',  days: 7 },
  { key: 'M',  days: 30 },
  { key: '6M', days: 180 },
  { key: 'Y',  days: 365 },
];

const RANGE_SUBTITLES = {
  W:  'Past week',
  M:  'Past month',
  '6M': 'Past 6 months',
  Y:  'Past year',
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function formatLabel(dateKey) {
  const [, month, day] = dateKey.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
}

// Returns the inclusive [startKey, endKey] for a given range and offset
// offset=0 → current window, offset=1 → one window back, etc.
function getWindow(rangeDays, offset) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - offset * rangeDays);
  const endKey = endDate.toISOString().slice(0, 10);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (rangeDays - 1));
  const startKey = startDate.toISOString().slice(0, 10);

  return { startKey, endKey };
}

function formatWindowLabel(startKey, endKey) {
  const [startYear] = startKey.split('-');
  const [endYear]   = endKey.split('-');
  return `${formatLabel(startKey)} '${startYear.slice(2)} – ${formatLabel(endKey)} '${endYear.slice(2)}`;
}

function ClickableDot({ cx, cy, payload, onDotClick }) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="#e53935"
      stroke="#1e1e1e"
      strokeWidth={2}
      style={{ cursor: 'pointer' }}
      onClick={() => onDotClick(payload)}
    />
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="wl-tooltip">
        <p className="wl-tooltip-date">{label}</p>
        <p className="wl-tooltip-value">{payload[0].value} kg</p>
      </div>
    );
  }
  return null;
};

function WeightLogger({ userId }) {
  const isGuest = !userId;

  const [entries, setEntries] = useState(() => {
    if (!isGuest) return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  });

  // Range selector + pan offset
  const [range, setRange]   = useState('M');
  const [offset, setOffset] = useState(0);

  // Add modal
  const [showAdd, setShowAdd]     = useState(false);
  const [addDate, setAddDate]     = useState(getTodayKey);
  const [addWeight, setAddWeight] = useState('');

  // Edit modal (dot click)
  const [editEntry, setEditEntry] = useState(null);
  const [editWeight, setEditWeight] = useState('');

  useEffect(() => {
    if (isGuest) return;
    supabase.from('weight_entries').select('*').order('date_key').then(({ data }) => {
      if (data) setEntries(data.map(e => ({
        id: e.id, dateKey: e.date_key, label: e.label, weight: e.weight,
      })));
    });
  }, [userId, isGuest]);

  const todayKey = getTodayKey();
  const entryMap = Object.fromEntries(entries.map(e => [e.dateKey, e]));

  const rangeDays            = RANGES.find(r => r.key === range).days;
  const { startKey, endKey } = getWindow(rangeDays, offset);
  const chartData            = entries
    .filter(e => e.dateKey >= startKey && e.dateKey <= endKey)
    .map(e => ({ dateKey: e.dateKey, label: e.label, weight: e.weight }));

  // Thin out X-axis ticks for dense views
  const xInterval = chartData.length <= 8
    ? 0
    : Math.ceil(chartData.length / 6) - 1;

  const latest      = chartData.length > 0 ? chartData[chartData.length - 1].weight : null;
  const rangeStart  = chartData.length > 0 ? chartData[0].weight : null;
  const change      = latest !== null && rangeStart !== null
    ? (latest - rangeStart).toFixed(1)
    : null;

  function openAdd() {
    setAddDate(getTodayKey());
    setAddWeight('');
    setShowAdd(true);
  }

  async function handleAddSave() {
    const val = parseFloat(addWeight);
    if (isNaN(val) || val <= 0 || !addDate) return;
    const lbl = formatLabel(addDate);

    if (isGuest) {
      const newEntry = { dateKey: addDate, label: lbl, weight: val };
      const updated = [...entries.filter(e => e.dateKey !== addDate), newEntry]
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      setEntries(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } else {
      const { data } = await supabase
        .from('weight_entries')
        .upsert(
          { user_id: userId, date_key: addDate, label: lbl, weight: val },
          { onConflict: 'user_id,date_key' }
        )
        .select()
        .single();
      if (data) {
        const mapped = { id: data.id, dateKey: data.date_key, label: data.label, weight: data.weight };
        setEntries(prev =>
          [...prev.filter(e => e.dateKey !== addDate), mapped]
            .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
        );
      }
    }
    setShowAdd(false);
  }

  function handleDotClick(payload) {
    const entry = entryMap[payload.dateKey];
    if (!entry) return;
    const index = entries.findIndex(e => e.dateKey === payload.dateKey);
    setEditEntry({ ...entry, index });
    setEditWeight(String(entry.weight));
  }

  async function handleEditSave() {
    const val = parseFloat(editWeight);
    if (isNaN(val) || val <= 0) return;
    const updated = entries.map(e =>
      e.dateKey === editEntry.dateKey ? { ...e, weight: val } : e
    );
    if (isGuest) {
      setEntries(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } else {
      await supabase.from('weight_entries').update({ weight: val }).eq('id', editEntry.id);
      setEntries(updated);
    }
    setEditEntry(null);
  }

  const renderDot = (props) => (
    <ClickableDot {...props} onDotClick={handleDotClick} />
  );

  return (
    <div className="weight-logger">

      {/* Page header */}
      <div className="wl-header">
        <p className="wl-sub">{RANGE_SUBTITLES[range]}</p>
        <h2 className="wl-title">Weight</h2>
        {latest !== null && (
          <div className="wl-header-meta">
            <span className="wl-current">{latest} kg</span>
            {change !== null && (
              <span className={`change-badge ${parseFloat(change) <= 0 ? 'down' : 'up'}`}>
                {parseFloat(change) > 0 ? `+${change}` : change} kg
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chart card */}
      <div className="wl-chart-card">
        <div className="wl-chart-title-row">
          <div className="wl-range-selector">
            {RANGES.map(r => (
              <button
                key={r.key}
                className={`wl-range-btn${range === r.key ? ' active' : ''}`}
                onClick={() => { setRange(r.key); setOffset(0); }}
              >
                {r.key}
              </button>
            ))}
          </div>
          <button className="wl-add-btn" onClick={openAdd} aria-label="Add entry">+</button>
        </div>

        {/* Period navigation */}
        <div className="wl-nav-row">
          <button className="wl-nav-arrow" onClick={() => setOffset(o => o + 1)}>‹</button>
          <span className="wl-nav-label">{formatWindowLabel(startKey, endKey)}</span>
          <button
            className="wl-nav-arrow"
            onClick={() => setOffset(o => o - 1)}
            disabled={offset === 0}
          >›</button>
        </div>

        {chartData.length === 0 ? (
          <div className="wl-empty-chart">
            <p>No entries yet — tap <strong>+</strong> to log your first weight.</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#555', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={xInterval}
                />
                <YAxis
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fill: '#555', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333' }} />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#e53935"
                  strokeWidth={2.5}
                  dot={renderDot}
                  activeDot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="wl-chart-hint">Tap a point to edit that day's entry</p>
          </>
        )}
      </div>

      {/* Add entry modal */}
      {showAdd && (
        <div className="wl-overlay" onClick={() => setShowAdd(false)}>
          <div className="wl-modal" onClick={e => e.stopPropagation()}>
            <p className="wl-modal-title">Log Weight</p>

            <div className="wl-field">
              <label className="wl-field-label">Date</label>
              <input
                type="date"
                className="wl-date-input"
                value={addDate}
                max={todayKey}
                onChange={e => setAddDate(e.target.value)}
              />
            </div>

            <div className="wl-field">
              <label className="wl-field-label">Weight</label>
              <div className="wl-input-row">
                <input
                  type="number"
                  className="wl-input"
                  placeholder="0.0"
                  step="0.1"
                  min="0"
                  value={addWeight}
                  onChange={e => setAddWeight(e.target.value)}
                  autoFocus
                />
                <span className="wl-unit">kg</span>
              </div>
            </div>

            <div className="wl-modal-actions">
              <button className="wl-cancel-btn" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button
                className="wl-save-btn"
                onClick={handleAddSave}
                disabled={!addWeight || !addDate}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit entry modal (dot click) */}
      {editEntry && (
        <div className="wl-overlay" onClick={() => setEditEntry(null)}>
          <div className="wl-modal" onClick={e => e.stopPropagation()}>
            <p className="wl-modal-title">Edit — {editEntry.label}</p>

            <div className="wl-field">
              <label className="wl-field-label">Weight</label>
              <div className="wl-input-row">
                <input
                  type="number"
                  className="wl-input"
                  step="0.1"
                  min="0"
                  value={editWeight}
                  onChange={e => setEditWeight(e.target.value)}
                  autoFocus
                />
                <span className="wl-unit">kg</span>
              </div>
            </div>

            <div className="wl-modal-actions">
              <button className="wl-cancel-btn" onClick={() => setEditEntry(null)}>
                Cancel
              </button>
              <button className="wl-save-btn" onClick={handleEditSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default WeightLogger;
