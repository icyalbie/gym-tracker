import { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { supabase } from './supabase';
import './Home.css';
import './WorkoutLogger.css';

// ── Storage keys ─────────────────────────────────────────────
const WEIGHT_KEY    = 'gymtracker_weight';
const CALORIES_KEY  = 'gymtracker_calories';
const WORKOUTS_KEY  = 'gymtracker_workouts';
const TEMPLATES_KEY = 'gymtracker_templates';
const ACTIVE_KEY    = 'gymtracker_active_workout';

// ── Category short names ──────────────────────────────────────
const CAT_SHORT = {
  'Horizontal Push': 'H.PUSH', 'Vertical Push': 'V.PUSH',
  'Horizontal Pull': 'H.PULL', 'Vertical Pull': 'V.PULL',
  'Squat': 'SQUAT', 'Hinge': 'HINGE', 'Carry': 'CARRY',
  'Accessory': 'ACC.', 'Cardio': 'CARDIO',
};
function catShort(cat) {
  if (CAT_SHORT[cat]) return CAT_SHORT[cat];
  return cat.length > 8 ? cat.slice(0, 7) + '…' : cat.toUpperCase();
}

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayKey() {
  return localDateKey(new Date());
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
    keys.push(localDateKey(d));
  }
  return keys;
}

// function getGreeting() {
//   const h = new Date().getHours();
//   if (h < 12) return 'Good Morning';
//   if (h < 17) return 'Good Afternoon';
//   return 'Good Evening';
// }

function getDisplayWeeks(page) {
  const today = new Date();
  const dow = today.getDay();
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  const thisMonday = new Date(today);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(today.getDate() - daysSinceMon);

  return Array.from({ length: 4 }, (_, r) => {
    const weekOffset = page * 4 + (r - 3);
    const weekStart = new Date(thisMonday);
    weekStart.setDate(thisMonday.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, d) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + d);
      return day;
    });
  });
}

function weekRangeLabel(weeks) {
  const oldest = weeks[0][0];
  const newest = weeks[3][6];
  return `${formatDate(localDateKey(oldest))} – ${formatDate(localDateKey(newest))}`;
}

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
function Home({ userId, onNavigate }) {
  const isGuest = !userId;
  const [weekPage, setWeekPage] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [modalActiveIdx, setModalActiveIdx] = useState(0);
  const modalCarouselRef = useRef(null);
  const modalDragState   = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

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
  const templates     = isGuest ? load(TEMPLATES_KEY) : [];

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

  // ── Modal carousel handlers ───────────────────────────────
  function handleModalScroll() {
    const el = modalCarouselRef.current;
    if (!el) return;
    setModalActiveIdx(Math.round(el.scrollLeft / el.clientWidth));
  }
  function handleModalMouseDown(e) {
    const el = modalCarouselRef.current;
    if (!el) return;
    modalDragState.current = { isDown: true, startX: e.pageX, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }
  function handleModalMouseMove(e) {
    const el = modalCarouselRef.current;
    if (!el || !modalDragState.current.isDown) return;
    e.preventDefault();
    el.scrollLeft = modalDragState.current.scrollLeft - (e.pageX - modalDragState.current.startX);
  }
  function handleModalMouseUp() {
    const el = modalCarouselRef.current;
    if (!el || !modalDragState.current.isDown) return;
    modalDragState.current.isDown = false;
    el.style.cursor = '';
    el.style.userSelect = '';
    const cardWidth = el.clientWidth;
    el.scrollTo({ left: Math.round(el.scrollLeft / cardWidth) * cardWidth, behavior: 'smooth' });
  }
  function startFromTemplate(template) {
    const active = {
      templateId: template.id,
      name: template.name,
      startedAt: new Date().toISOString(),
      exercises: template.exercises.map(e => ({ ...e, sets: [] })),
    };
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    setShowStartModal(false);
    onNavigate('workout');
  }

  // ── Workout calendar ──────────────────────────────────────
  const workoutByDate = {};
  for (const wo of workouts) {
    if (wo.date && !workoutByDate[wo.date]) workoutByDate[wo.date] = wo;
  }
  const displayWeeks = getDisplayWeeks(weekPage);

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

      {/* Workout calendar */}
      <div className="h-section">
        <div className="h-cal-header">
          <div>
            <p className="h-section-title">Workouts</p>
            <p className="h-cal-range">{weekRangeLabel(displayWeeks)}</p>
          </div>
          <div className="h-cal-nav">
            <button className="h-cal-nav-btn" onClick={() => { setWeekPage(p => p - 1); setSelectedDateKey(null); }}>←</button>
            {weekPage < 0 && (
              <button className="h-cal-nav-btn" onClick={() => { setWeekPage(p => p + 1); setSelectedDateKey(null); }}>→</button>
            )}
          </div>
        </div>

        <div className="h-cal-grid">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="h-cal-dow">{d}</div>
          ))}
          {displayWeeks.map((week) =>
            week.map((day) => {
              const dk = localDateKey(day);
              const wo = workoutByDate[dk];
              const isToday = dk === todayKey;
              const isFuture = day > new Date() && !isToday;
              const isSelected = selectedDateKey === dk;
              const cls = ['h-cal-cell', wo ? 'has-workout' : '', isToday ? 'today' : '', isFuture ? 'future' : '', isSelected ? 'selected' : ''].filter(Boolean).join(' ');
              return (
                <div key={dk} className={cls} onClick={isToday ? () => setShowStartModal(true) : wo ? () => setSelectedDateKey(isSelected ? null : dk) : undefined}>
                  <span className="h-cal-date">{day.getDate()}</span>
                  {wo && <span className="h-cal-wo-name">{wo.name}</span>}
                </div>
              );
            })
          )}
        </div>

        {selectedDateKey && workoutByDate[selectedDateKey] && (() => {
          const wo = workoutByDate[selectedDateKey];
          const totalSets = wo.exercises.reduce((n, e) => n + e.sets.length, 0);
          return (
            <div className="h-cal-detail">
              <p className="h-cal-detail-title">
                {wo.name}
                <span className="h-cal-detail-meta"> · {formatDate(wo.date)} · {wo.exercises.length} exercise{wo.exercises.length !== 1 ? 's' : ''} · {totalSets} set{totalSets !== 1 ? 's' : ''}</span>
              </p>
              {wo.exercises.map((ex, i) => (
                <div key={i} className="h-ex-row">
                  <span className="h-ex-name">{ex.name}</span>
                  <div className="h-ex-chips">
                    {ex.sets.length > 0
                      ? ex.sets.map((s, j) => <span key={j} className="h-ex-chip">{s.weight}×{s.reps}</span>)
                      : <span className="h-ex-empty">No sets</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {showStartModal && (
        <div className="h-modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="h-modal" onClick={e => e.stopPropagation()}>
            <div className="h-modal-header">
              <p className="h-modal-title">Start Workout</p>
              <button className="h-modal-close" onClick={() => setShowStartModal(false)}>✕</button>
            </div>
            {templates.length === 0 ? (
              <p className="wl-empty-text">No templates yet — create one on the Workout page.</p>
            ) : (
              <div className="wl-carousel-wrap">
                <div
                  className="wl-carousel"
                  ref={modalCarouselRef}
                  onScroll={handleModalScroll}
                  onMouseDown={handleModalMouseDown}
                  onMouseMove={handleModalMouseMove}
                  onMouseUp={handleModalMouseUp}
                  onMouseLeave={handleModalMouseUp}
                >
                  {templates.map((t) => (
                    <div key={t.id} className="wl-carousel-card">
                      <div className="wl-carousel-card-header">
                        <div>
                          <p className="wl-carousel-name">{t.name}</p>
                          <p className="wl-carousel-meta">{t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="wl-carousel-exercises">
                        {t.exercises.map((ex, j) => (
                          <div key={j} className="wl-carousel-ex-row">
                            <span className="wl-carousel-ex-cat">{catShort(ex.category)}</span>
                            <span className="wl-carousel-ex-name">{ex.name}</span>
                          </div>
                        ))}
                      </div>
                      <button className="wl-carousel-start-btn" onClick={() => startFromTemplate(t)}>
                        Start Workout
                      </button>
                    </div>
                  ))}
                </div>
                {templates.length > 1 && (
                  <div className="wl-carousel-dots">
                    {templates.map((_, i) => (
                      <div key={i} className={`wl-carousel-dot${i === modalActiveIdx ? ' active' : ''}`} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default Home;
