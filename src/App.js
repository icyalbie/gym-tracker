import './App.css';
import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import Auth from './Auth';
import Home from './Home';
import WorkoutLogger from './WorkoutLogger';
import WeightLogger from './WeightLogger';
import CalorieLogger from './CalorieLogger';
import Exercises from './Exercises';

const NAV_ICONS = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  workout: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M2 10v4M22 10v4M6 4v4M18 4v4M6 16v4M18 16v4"/>
    </svg>
  ),
  exercises: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  weight: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="3.5"/>
      <path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2"/>
    </svg>
  ),
  calories: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ),
};

const NAV_ITEMS = [
  { id: 'home',      label: 'Home'      },
  { id: 'workout',   label: 'Workout'   },
  { id: 'exercises', label: 'Exercises' },
  { id: 'weight',    label: 'Weight'    },
  { id: 'calories',  label: 'Calories'  },
];

const LOCAL_KEYS = [
  'gymtracker_weight',
  'gymtracker_calories',
  'gymtracker_workouts',
  'gymtracker_exercises',
  'gymtracker_templates',
];

function hasLocalData() {
  return LOCAL_KEYS.some(k => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return Array.isArray(v) && v.length > 0;
    } catch { return false; }
  });
}

async function migrateLocalToSupabase(uid) {
  const parse = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const weights   = parse('gymtracker_weight');
  const calories  = parse('gymtracker_calories');
  const workouts  = parse('gymtracker_workouts');
  const exercises = parse('gymtracker_exercises');
  const templates = parse('gymtracker_templates');

  await Promise.all([
    weights.length && supabase.from('weight_entries').upsert(
      weights.map(e => ({ user_id: uid, date_key: e.dateKey, label: e.label, weight: e.weight })),
      { onConflict: 'user_id,date_key' }
    ),
    calories.length && supabase.from('calorie_meals').insert(
      calories.map(e => ({ user_id: uid, date_key: e.dateKey, name: e.name, calories: e.calories }))
    ),
    workouts.length && supabase.from('workouts').insert(
      workouts.map(e => ({ user_id: uid, name: e.name, date: e.date, completed_at: e.completedAt, exercises: e.exercises }))
    ),
    exercises.length && supabase.from('exercises').insert(
      exercises.map(e => ({ user_id: uid, name: e.name, category: e.category }))
    ),
    templates.length && supabase.from('templates').insert(
      templates.map(e => ({ user_id: uid, name: e.name, exercises: e.exercises }))
    ),
  ].filter(Boolean));

  LOCAL_KEYS.forEach(k => localStorage.removeItem(k));
}

function App() {
  const [authReady,     setAuthReady]     = useState(false);
  const [userId,        setUserId]        = useState(null);
  const [isGuest,       setIsGuest]       = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);
  const [showSettings,  setShowSettings]  = useState(false);
  const [migrating,     setMigrating]     = useState(false);
  const [currentPage,   setCurrentPage]   = useState('home');
  const importInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else if (localStorage.getItem('gymtracker_guest') === '1') {
        setIsGuest(true);
      }
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUserId(null);
        setIsGuest(false);
        setPendingUserId(null);
        setShowSettings(false);
        setCurrentPage('home');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function onAuth(uid) {
    if (hasLocalData()) {
      setPendingUserId(uid);
    } else {
      setUserId(uid);
    }
  }

  function onGuest() {
    localStorage.setItem('gymtracker_guest', '1');
    setIsGuest(true);
  }

  async function handleMigrate() {
    const uid = pendingUserId;
    setMigrating(true);
    await migrateLocalToSupabase(uid);
    localStorage.removeItem('gymtracker_guest');
    setMigrating(false);
    setPendingUserId(null);
    setUserId(uid);
  }

  function handleSkipMigration() {
    const uid = pendingUserId;
    setPendingUserId(null);
    setUserId(uid);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setShowSettings(false);
  }

  function handleSignInFromGuest() {
    localStorage.removeItem('gymtracker_guest');
    setIsGuest(false);
    setShowSettings(false);
  }

  async function handleExport() {
    const [wRes, cRes, woRes, exRes, tmplRes] = await Promise.all([
      supabase.from('weight_entries').select('*'),
      supabase.from('calorie_meals').select('*'),
      supabase.from('workouts').select('*'),
      supabase.from('exercises').select('*'),
      supabase.from('templates').select('*'),
    ]);
    const payload = {
      weight_entries: wRes.data ?? [],
      calorie_meals:  cRes.data ?? [],
      workouts:       woRes.data ?? [],
      exercises:      exRes.data ?? [],
      templates:      tmplRes.data ?? [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gymtracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const { weight_entries, calorie_meals, workouts, exercises, templates } = JSON.parse(text);
      await Promise.all([
        supabase.from('weight_entries').delete().eq('user_id', userId),
        supabase.from('calorie_meals').delete().eq('user_id', userId),
        supabase.from('workouts').delete().eq('user_id', userId),
        supabase.from('exercises').delete().eq('user_id', userId),
        supabase.from('templates').delete().eq('user_id', userId),
      ]);
      const tag = arr => (arr ?? []).map(({ id, user_id, ...rest }) => ({ ...rest, user_id: userId }));
      await Promise.all([
        weight_entries?.length  && supabase.from('weight_entries').insert(tag(weight_entries)),
        calorie_meals?.length   && supabase.from('calorie_meals').insert(tag(calorie_meals)),
        workouts?.length        && supabase.from('workouts').insert(tag(workouts)),
        exercises?.length       && supabase.from('exercises').insert(tag(exercises)),
        templates?.length       && supabase.from('templates').insert(tag(templates)),
      ].filter(Boolean));
      window.location.reload();
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed — please check the file format.');
    }
  }

  if (!authReady) return null;

  // ── Migration prompt ───────────────────────────────────────
  if (pendingUserId) {
    return (
      <div className="app-overlay">
        <div className="app-modal">
          <p className="app-modal-title">Import Local Data?</p>
          <p className="app-modal-body">
            You have workout data saved on this device. Import it into your account?
          </p>
          <button
            className="app-modal-btn"
            onClick={handleMigrate}
            disabled={migrating}
          >
            {migrating ? 'Importing…' : 'Import & Sign In'}
          </button>
          <button
            className="app-modal-secondary-btn"
            onClick={handleSkipMigration}
            disabled={migrating}
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // ── Auth screen ────────────────────────────────────────────
  if (!userId && !isGuest) {
    return <Auth onAuth={onAuth} onGuest={onGuest} />;
  }

  // ── Main app ───────────────────────────────────────────────
  return (
    <div className="App">
      <header className="app-header">
        <h1>Gym Tracker</h1>
        <button
          className="app-settings-btn"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
        >
          ⋮
        </button>
      </header>

      <main className="app-main">
        {currentPage === 'home'      && <Home         userId={userId} />}
        {currentPage === 'workout'   && <WorkoutLogger userId={userId} />}
        {currentPage === 'exercises' && <Exercises     userId={userId} />}
        {currentPage === 'weight'    && <WeightLogger  userId={userId} />}
        {currentPage === 'calories'  && <CalorieLogger userId={userId} />}
      </main>

      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            className={`nav-btn${currentPage === id ? ' active' : ''}`}
            onClick={() => setCurrentPage(id)}
          >
            <span className="nav-icon">{NAV_ICONS[id]}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* Settings modal */}
      {showSettings && (
        <div className="app-overlay" onClick={() => setShowSettings(false)}>
          <div className="app-modal" onClick={e => e.stopPropagation()}>
            <p className="app-modal-title">Settings</p>

            {userId ? (
              <>
                <p className="app-modal-hint">Signed in · data synced to your account</p>
                <div className="app-modal-divider" />
                <button className="app-modal-secondary-btn" onClick={handleExport}>
                  Export Data
                </button>
                <button
                  className="app-modal-secondary-btn"
                  onClick={() => importInputRef.current?.click()}
                >
                  Import Data
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files[0]) {
                      handleImport(e.target.files[0]);
                      setShowSettings(false);
                    }
                  }}
                />
                <div className="app-modal-divider" />
                <button className="app-modal-danger-btn" onClick={handleSignOut}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <p className="app-modal-hint">Guest mode — data stored locally on this device</p>
                <div className="app-modal-divider" />
                <button className="app-modal-btn" onClick={handleSignInFromGuest}>
                  Sign In / Create Account
                </button>
              </>
            )}

            <button className="app-modal-secondary-btn" onClick={() => setShowSettings(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
