import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { supabase } from './supabase';
import './Home.css';

// ── Storage keys ─────────────────────────────────────────────
const WEIGHT_KEY   = 'gymtracker_weight';
const CALORIES_KEY = 'gymtracker_calories';
const WORKOUTS_KEY = 'gymtracker_workouts';

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function getLastNDays(n) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

// function getGreeting() {
//   const h = new Date().getHours();
//   if (h < 12) return 'Good Morning';
//   if (h < 17) return 'Good Afternoon';
//   return 'Good Evening';
// }

function getTodayLabel() {
  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
}

// ── Tooltips ──────────────────────────────────────────────────
const WeightTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="h-tooltip">
      <p className="h-tooltip-date">{payload[0].payload.label}</p>
      <p className="h-tooltip-value">{payload[0].value} kg</p>
    </div>
  );
};

const CalTooltip = ({ active, payload }) => {
  if (!active || !payload?.length || payload[0].value === 0) return null;
  return (
    <div className="h-tooltip">
      <p className="h-tooltip-date">{payload[0].payload.label}</p>
      <p className="h-tooltip-value">{payload[0].value.toLocaleString()} kcal</p>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────
function Home({ userId }) {
  const isGuest = !userId;
  const [expandedId, setExpandedId] = useState(null);

  // Auth mode: load from Supabase into state
  const [sbWeightEntries, setSbWeightEntries] = useState([]);
  const [sbCalorieMeals,  setSbCalorieMeals]  = useState([]);
  const [sbWorkouts,      setSbWorkouts]      = useState([]);

  useEffect(() => {
    if (isGuest) return;
    Promise.all([
      supabase.from('weight_entries').select('*').order('date_key'),
      supabase.from('calorie_meals').select('*'),
      supabase.from('workouts').select('*').order('date', { ascending: false }),
    ]).then(([wRes, cRes, woRes]) => {
      setSbWeightEntries((wRes.data ?? []).map(e => ({
        dateKey: e.date_key, label: e.label, weight: e.weight,
      })));
      setSbCalorieMeals((cRes.data ?? []).map(m => ({
        id: m.id, dateKey: m.date_key, name: m.name, calories: m.calories,
      })));
      setSbWorkouts((woRes.data ?? []).map(wo => ({
        id: wo.id, name: wo.name, date: wo.date, exercises: wo.exercises,
      })));
    });
  }, [userId, isGuest]);

  // Guest mode: read fresh from localStorage each render (stays current on tab switches)
  const weightEntries = isGuest ? load(WEIGHT_KEY)   : sbWeightEntries;
  const calorieMeals  = isGuest ? load(CALORIES_KEY) : sbCalorieMeals;
  const workouts      = isGuest ? load(WORKOUTS_KEY) : sbWorkouts;

  const todayKey = getTodayKey();

  // ── Weight chart ──────────────────────────────────────────
  // WeightLogger keeps entries sorted by dateKey; take last 30
  const weightChartData = weightEntries.slice(-30);
  const latestWeight    = weightChartData.length > 0
    ? weightChartData[weightChartData.length - 1].weight : null;
  const firstWeight     = weightChartData.length > 0 ? weightChartData[0].weight : null;
  const weightChange    = latestWeight !== null && firstWeight !== null
    ? (latestWeight - firstWeight).toFixed(1) : null;
  const weightInterval  = weightChartData.length <= 8
    ? 0 : Math.ceil(weightChartData.length / 6) - 1;

  // ── Calorie chart (last 7 days) ───────────────────────────
  const calDays    = getLastNDays(7);
  const calTotals  = Object.fromEntries(calDays.map(k => [k, 0]));
  for (const meal of calorieMeals) {
    if (meal.dateKey in calTotals) calTotals[meal.dateKey] += meal.calories;
  }
  const calChartData = calDays.map(k => ({
    dateKey:  k,
    label:    formatDate(k),
    calories: calTotals[k],
  }));
  const todayCals  = calTotals[todayKey] || 0;
  const hasCalData = calChartData.some(d => d.calories > 0);

  // ── Workout history ───────────────────────────────────────
  function toggleWorkout(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  return (
    <div className="home">

      {/* Greeting */}
      <div className="greeting">
        <p className="greeting-sub">{getTodayLabel()}</p>
        {/* <h2 className="greeting-title">{getGreeting()}</h2> */}
      </div>

      {/* Weight chart */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <p className="chart-label">Weight</p>
            <p className="chart-value">
              {latestWeight !== null
                ? <>{latestWeight} <span className="chart-unit">kg</span></>
                : <span className="chart-no-data">No data yet</span>}
            </p>
          </div>
          {weightChange !== null && (
            <span className={`change-badge ${parseFloat(weightChange) <= 0 ? 'down' : 'up'}`}>
              {parseFloat(weightChange) > 0 ? `+${weightChange}` : weightChange} kg
            </span>
          )}
        </div>
        {weightChartData.length === 0 ? (
          <p className="h-empty">Log your weight to see your progress here.</p>
        ) : (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weightChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#555', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={weightInterval}
                />
                <YAxis
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fill: '#555', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<WeightTooltip />} cursor={{ stroke: '#333' }} />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#e53935"
                  strokeWidth={2.5}
                  dot={{ fill: '#e53935', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#ff5252' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Calorie chart */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <p className="chart-label">Calories Today</p>
            <p className="chart-value">
              {todayCals > 0
                ? <>{todayCals.toLocaleString()} <span className="chart-unit">kcal</span></>
                : <span className="chart-no-data">—</span>}
            </p>
          </div>
          <span className="h-range-label">Last 7 days</span>
        </div>
        {!hasCalData ? (
          <p className="h-empty">Log a meal to see your calorie graph here.</p>
        ) : (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={130}>
              <BarChart
                data={calChartData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#555', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#555', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v === 0 ? '' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                />
                <Tooltip content={<CalTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar
                  dataKey="calories"
                  shape={(props) => {
                    const { x, y, width, height, dateKey, calories } = props;
                    if (height <= 0) return null;
                    return (
                      <rect
                        x={x} y={y} width={width} height={height}
                        rx={3} ry={3}
                        fill={dateKey === todayKey ? '#ff5252' : '#e53935'}
                        fillOpacity={calories === 0 ? 0.12 : 1}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Workout history */}
      {workouts.length > 0 && (
        <div className="h-section">
          <p className="h-section-title">Recent Workouts</p>
          <div className="h-workout-list">
            {workouts.slice(0, 10).map(workout => {
              const isExpanded = expandedId === workout.id;
              const totalSets  = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
              return (
                <div key={workout.id} className="h-workout-item">
                  <button
                    className="h-workout-row"
                    onClick={() => toggleWorkout(workout.id)}
                  >
                    <div className="h-workout-info">
                      <p className="h-workout-name">{workout.name}</p>
                      <p className="h-workout-meta">
                        {formatDate(workout.date)}
                        {' · '}{workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                        {' · '}{totalSets} set{totalSets !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className={`h-chevron${isExpanded ? ' open' : ''}`}>›</span>
                  </button>

                  {isExpanded && (
                    <div className="h-workout-detail">
                      {workout.exercises.map((ex, i) => (
                        <div key={i} className="h-ex-row">
                          <span className="h-ex-name">{ex.name}</span>
                          <div className="h-ex-chips">
                            {ex.sets.length > 0
                              ? ex.sets.map((s, j) => (
                                  <span key={j} className="h-ex-chip">{s.weight}×{s.reps}</span>
                                ))
                              : <span className="h-ex-empty">No sets</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

export default Home;
