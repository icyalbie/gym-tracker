import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './CalorieLogger.css';

const STORAGE_KEY = 'gymtracker_calories';

const RANGES = [
  { key: '7D',  days: 7  },
  { key: '30D', days: 30 },
];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatLabel(dateKey) {
  const [, m, d] = dateKey.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

// Returns an array of YYYY-MM-DD strings for the last `days` days (today last)
function getDaysInRange(days) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function computeDailyTotals(meals, dateKeys) {
  const totals = Object.fromEntries(dateKeys.map(k => [k, 0]));
  for (const meal of meals) {
    if (meal.dateKey in totals) {
      totals[meal.dateKey] += meal.calories;
    }
  }
  return dateKeys.map(k => ({ dateKey: k, label: formatLabel(k), calories: totals[k] }));
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length && payload[0].value > 0) {
    const { label, calories } = payload[0].payload;
    return (
      <div className="cl-tooltip">
        <p className="cl-tooltip-date">{label}</p>
        <p className="cl-tooltip-value">{calories.toLocaleString()} kcal</p>
      </div>
    );
  }
  return null;
};

function CalorieLogger() {
  const [meals, setMeals] = useState(() => load(STORAGE_KEY, []));
  const [range, setRange] = useState('7D');

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState(getTodayKey);
  const [addName, setAddName] = useState('');
  const [addCals, setAddCals] = useState('');

  function saveMeals(updated) {
    setMeals(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function openAdd() {
    setAddDate(getTodayKey());
    setAddName('');
    setAddCals('');
    setShowAdd(true);
  }

  function handleAddMeal() {
    const cals = parseInt(addCals, 10);
    if (!addName.trim() || isNaN(cals) || cals <= 0) return;
    saveMeals([...meals, {
      id:       `meal-${Date.now()}`,
      dateKey:  addDate,
      name:     addName.trim(),
      calories: cals,
    }]);
    setShowAdd(false);
  }

  function handleDelete(id) {
    saveMeals(meals.filter(m => m.id !== id));
  }

  const todayKey   = getTodayKey();
  const todayMeals = meals.filter(m => m.dateKey === todayKey);
  const todayTotal = todayMeals.reduce((sum, m) => sum + m.calories, 0);

  const rangeDays  = RANGES.find(r => r.key === range).days;
  const dateKeys   = getDaysInRange(rangeDays);
  const chartData  = computeDailyTotals(meals, dateKeys);
  const hasAnyData = chartData.some(d => d.calories > 0);

  const xInterval = rangeDays <= 7 ? 0 : Math.ceil(rangeDays / 7) - 1;

  return (
    <div className="cl-page">

      {/* Page header */}
      <div className="cl-page-header">
        <div>
          <p className="cl-sub">Calories today</p>
          <h2 className="cl-title">
            {todayTotal > 0
              ? <>{todayTotal.toLocaleString()} <span className="cl-title-unit">kcal</span></>
              : '—'}
          </h2>
        </div>
        <button className="cl-add-btn" onClick={openAdd} aria-label="Add meal">+</button>
      </div>

      {/* Chart card */}
      <div className="cl-chart-card">
        <div className="cl-range-selector">
          {RANGES.map(r => (
            <button
              key={r.key}
              className={`cl-range-btn${range === r.key ? ' active' : ''}`}
              onClick={() => setRange(r.key)}
            >
              {r.key}
            </button>
          ))}
        </div>

        {!hasAnyData ? (
          <div className="cl-empty-chart">
            <p>No meals logged yet — tap <strong>+</strong> to add your first.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#555', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={xInterval}
              />
              <YAxis
                tick={{ fill: '#555', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v === 0 ? '' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar
                dataKey="calories"
                shape={(props) => {
                  const { x, y, width, height, dateKey, calories } = props;
                  if (height <= 0) return null;
                  return (
                    <rect
                      x={x} y={y} width={width} height={height}
                      rx={4} ry={4}
                      fill={dateKey === todayKey ? '#ff5252' : '#e53935'}
                      fillOpacity={calories === 0 ? 0.12 : 1}
                    />
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Today's meals */}
      <div className="cl-section">
        <p className="cl-section-title">Today's Meals</p>
        {todayMeals.length === 0 ? (
          <p className="cl-empty-text">No meals logged today.</p>
        ) : (
          <div className="cl-meal-list">
            {todayMeals.map(meal => (
              <div key={meal.id} className="cl-meal-row">
                <div className="cl-meal-info">
                  <span className="cl-meal-name">{meal.name}</span>
                  <span className="cl-meal-cals">{meal.calories.toLocaleString()} kcal</span>
                </div>
                <button
                  className="cl-meal-delete"
                  onClick={() => handleDelete(meal.id)}
                  aria-label={`Delete ${meal.name}`}
                >✕</button>
              </div>
            ))}
            <div className="cl-meal-total-row">
              <span className="cl-meal-total-label">Total</span>
              <span className="cl-meal-total-value">{todayTotal.toLocaleString()} kcal</span>
            </div>
          </div>
        )}
      </div>

      {/* Add meal modal */}
      {showAdd && (
        <div className="cl-overlay" onClick={() => setShowAdd(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <p className="cl-modal-title">Log Meal</p>

            <div className="cl-field">
              <label className="cl-field-label">Date</label>
              <input
                type="date"
                className="cl-date-input"
                value={addDate}
                max={todayKey}
                onChange={e => setAddDate(e.target.value)}
              />
            </div>

            <div className="cl-field">
              <label className="cl-field-label">Meal Name</label>
              <input
                type="text"
                className="cl-text-input"
                placeholder="e.g. Breakfast, Lunch…"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="cl-field">
              <label className="cl-field-label">Calories</label>
              <div className="cl-input-row">
                <input
                  type="number"
                  className="cl-input"
                  placeholder="0"
                  step="1"
                  min="1"
                  value={addCals}
                  onChange={e => setAddCals(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddMeal()}
                />
                <span className="cl-unit-label">kcal</span>
              </div>
            </div>

            <div className="cl-modal-actions">
              <button className="cl-cancel-btn" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button
                className="cl-save-btn"
                onClick={handleAddMeal}
                disabled={!addName.trim() || !addCals}
              >
                Add Meal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalorieLogger;
