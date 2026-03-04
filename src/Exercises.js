import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import './Exercises.css';

const STORAGE_KEY  = 'gymtracker_exercises';
const WORKOUTS_KEY = 'gymtracker_workouts';

const CATEGORIES = [
  'Vertical Pull',
  'Vertical Push',
  'Horizontal Pull',
  'Horizontal Push',
  'Hinge',
  'Squat',
  'Accessory',
];

const DEFAULT_EXERCISES = [
  // Vertical Pull
  { id: 'vpl-1', name: 'Pull-up',              category: 'Vertical Pull',    custom: false },
  { id: 'vpl-2', name: 'Chin-up',              category: 'Vertical Pull',    custom: false },
  // Vertical Push
  { id: 'vpu-1', name: 'Overhead Press',       category: 'Vertical Push',    custom: false },
  { id: 'vpu-2', name: 'Dumbbell Shoulder Press', category: 'Vertical Push', custom: false },
  // Horizontal Pull
  { id: 'hpl-1', name: 'Seal Row',  category: 'Horizontal Pull',  custom: false },
  { id: 'hpl-2', name: 'T-Bar Row',  category: 'Horizontal Pull',  custom: false },
  // Horizontal Push
  { id: 'hpu-1', name: 'Bench Press',          category: 'Horizontal Push',  custom: false },
  { id: 'hpu-2', name: 'Dips', category: 'Horizontal Push',  custom: false },
  { id: 'hpu-3', name: 'Cambered Bar Bench',  category: 'Horizontal Push',  custom: false },
  { id: 'hpu-4', name: 'Push-up',              category: 'Horizontal Push',  custom: false },
  // Hinge
  { id: 'hin-1', name: 'Deadlift',             category: 'Hinge',            custom: false },
  { id: 'hin-2', name: 'Romanian Deadlift',    category: 'Hinge',            custom: false },
  { id: 'hin-3', name: 'Hip Thrust',           category: 'Hinge',            custom: false },
  // Squat
  { id: 'sq-1',  name: 'Back Squat',           category: 'Squat',            custom: false },
  { id: 'sq-2',  name: 'Front Squat',          category: 'Squat',            custom: false },
  // Accessory
  { id: 'acc-1', name: 'Bicep Curl',           category: 'Accessory',        custom: false },
  { id: 'acc-2', name: 'Tricep Extension',     category: 'Accessory',        custom: false },
  { id: 'acc-3', name: 'Lateral Raise',        category: 'Accessory',        custom: false },
  { id: 'acc-4', name: 'Face Pull',            category: 'Accessory',        custom: false },
  { id: 'acc-5', name: 'Calf Raise',           category: 'Accessory',        custom: false },
];

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function formatExDate(dateStr) {
  const [year, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, '${year.slice(2)}`;
}

function Exercises({ userId }) {
  const isGuest = !userId;

  const [exercises, setExercises] = useState(() =>
    isGuest ? loadJSON(STORAGE_KEY, DEFAULT_EXERCISES) : []
  );
  const [workouts, setWorkouts] = useState(() =>
    isGuest ? loadJSON(WORKOUTS_KEY, []) : []
  );

  useEffect(() => {
    if (isGuest) return;

    supabase.from('exercises').select('*').then(({ data }) => {
      if (!data) return;
      if (data.length === 0) {
        supabase.from('exercises')
          .insert(DEFAULT_EXERCISES.map(e => ({ user_id: userId, name: e.name, category: e.category })))
          .select()
          .then(({ data: seeded }) => {
            if (seeded) setExercises(seeded.map(e => ({ id: e.id, name: e.name, category: e.category })));
          });
      } else {
        setExercises(data.map(e => ({ id: e.id, name: e.name, category: e.category })));
      }
    });

    supabase.from('workouts').select('*').order('date', { ascending: false }).then(({ data }) => {
      if (data) setWorkouts(data.map(wo => ({
        id: wo.id, name: wo.name, date: wo.date, exercises: wo.exercises,
      })));
    });
  }, [userId, isGuest]);

  // Exercise detail sheet
  const [selected, setSelected] = useState(null);

  // Add exercise modal
  const [showAdd,      setShowAdd]      = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newCategory,  setNewCategory]  = useState(CATEGORIES[0]);

  // Drag-and-drop reorder
  const [dragSrcId,  setDragSrcId]  = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  function saveExercises(updated) {
    setExercises(updated);
    if (isGuest) localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function handleDelete(id) {
    if (isGuest) {
      saveExercises(exercises.filter(e => e.id !== id));
    } else {
      await supabase.from('exercises').delete().eq('id', id);
      setExercises(prev => prev.filter(e => e.id !== id));
    }
    setSelected(null);
  }

  async function handleAddSave() {
    const name = newName.trim();
    if (!name) return;

    if (isGuest) {
      const exercise = { id: `custom-${Date.now()}`, name, category: newCategory, custom: true };
      saveExercises([...exercises, exercise]);
    } else {
      const { data } = await supabase
        .from('exercises')
        .insert({ user_id: userId, name, category: newCategory })
        .select()
        .single();
      if (data) setExercises(prev => [...prev, { id: data.id, name: data.name, category: data.category }]);
    }
    setNewName('');
    setNewCategory(CATEGORIES[0]);
    setShowAdd(false);
  }

  // ── Drag-and-drop reorder ──────────────────────────────────
  function handleDragStart(e, id) {
    e.dataTransfer.effectAllowed = 'move';
    setDragSrcId(id);
  }

  function handleDragOver(e, id) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  }

  function handleDrop(e, targetId) {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === targetId) { setDragSrcId(null); setDragOverId(null); return; }
    const src = exercises.find(x => x.id === dragSrcId);
    const tgt = exercises.find(x => x.id === targetId);
    if (!src || !tgt || src.category !== tgt.category) { setDragSrcId(null); setDragOverId(null); return; }
    const updated = [...exercises];
    const srcIdx = updated.findIndex(x => x.id === dragSrcId);
    const tgtIdx = updated.findIndex(x => x.id === targetId);
    const [removed] = updated.splice(srcIdx, 1);
    updated.splice(tgtIdx, 0, removed);
    saveExercises(updated);
    setDragSrcId(null);
    setDragOverId(null);
  }

  function handleDragEnd() { setDragSrcId(null); setDragOverId(null); }

  // ── Stats computation ──────────────────────────────────────
  function getExerciseData(ex) {
    const sessions = [];
    for (const wo of workouts) {
      const found = wo.exercises?.find(
        e => e.exerciseId === ex.id || e.name === ex.name
      );
      if (found && found.sets?.length > 0) {
        sessions.push({ date: wo.date, workoutName: wo.name, sets: found.sets });
      }
    }
    sessions.sort((a, b) => b.date.localeCompare(a.date));

    const allSets = sessions.flatMap(s => s.sets);

    // 1RM: highest weight at exactly 1 rep
    const oneRepSets = allSets.filter(s => s.reps === 1);
    const oneRM = oneRepSets.length > 0
      ? Math.max(...oneRepSets.map(s => s.weight))
      : null;

    // Rep PR: highest weight at 3+ reps; break ties by most reps
    const repPRSets = allSets.filter(s => s.reps >= 3);
    const repPR = repPRSets.length > 0
      ? repPRSets.reduce((best, s) =>
          s.weight > best.weight ? s
          : (s.weight === best.weight && s.reps > best.reps ? s : best)
        )
      : null;

    return { sessions, oneRM, repPR };
  }

  // Group exercises by category, preserving CATEGORIES order
  const grouped = CATEGORIES.map(cat => ({
    category: cat,
    exercises: exercises.filter(e => e.category === cat),
  }));

  const exData = selected ? getExerciseData(selected) : null;

  return (
    <div className="exercises-page">

      {/* Page header */}
      <div className="ex-header">
        <div>
          <p className="ex-sub">Library</p>
          <h2 className="ex-title">Exercises</h2>
        </div>
        <button className="ex-add-btn" onClick={() => setShowAdd(true)} aria-label="Add exercise">
          +
        </button>
      </div>

      {/* Category sections */}
      {grouped.map(({ category, exercises: list }) => (
        <div key={category} className="ex-category">
          <p className="ex-category-label">{category}</p>
          <div className="ex-list">
            {list.map(ex => (
              <button
                key={ex.id}
                className={`ex-row${dragSrcId === ex.id ? ' ex-dragging' : ''}${dragOverId === ex.id && dragSrcId !== ex.id ? ' ex-drag-over' : ''}`}
                onClick={() => setSelected(ex)}
                draggable
                onDragStart={e => handleDragStart(e, ex.id)}
                onDragOver={e => handleDragOver(e, ex.id)}
                onDrop={e => handleDrop(e, ex.id)}
                onDragEnd={handleDragEnd}
              >
                <span className="ex-row-name">{ex.name}</span>
                <span className="ex-row-chevron">›</span>
              </button>
            ))}
            {list.length === 0 && (
              <p className="ex-empty">No exercises yet — tap + to add one.</p>
            )}
          </div>
        </div>
      ))}

      {/* Exercise detail sheet */}
      {selected && exData && (
        <div className="ex-overlay" onClick={() => setSelected(null)}>
          <div className="ex-sheet" onClick={e => e.stopPropagation()}>
            <div className="ex-sheet-header">
              <div>
                <p className="ex-sheet-category">{selected.category}</p>
                <h3 className="ex-sheet-name">{selected.name}</h3>
              </div>
              <button className="ex-sheet-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="ex-stats-grid">
              <div className="ex-stat-card">
                <p className="ex-stat-label">1RM</p>
                {exData.oneRM !== null ? (
                  <>
                    <p className="ex-stat-value">{exData.oneRM}<span className="ex-stat-unit">kg</span></p>
                    <p className="ex-stat-hint">Heaviest single rep</p>
                  </>
                ) : (
                  <>
                    <p className="ex-stat-value">—</p>
                    <p className="ex-stat-hint">No 1-rep sets logged</p>
                  </>
                )}
              </div>
              <div className="ex-stat-card">
                <p className="ex-stat-label">Rep PR</p>
                {exData.repPR !== null ? (
                  <>
                    <p className="ex-stat-value">{exData.repPR.weight}<span className="ex-stat-unit">kg</span></p>
                    <p className="ex-stat-hint">× {exData.repPR.reps} reps</p>
                  </>
                ) : (
                  <>
                    <p className="ex-stat-value">—</p>
                    <p className="ex-stat-hint">No 3+ rep sets logged</p>
                  </>
                )}
              </div>
            </div>

            {exData.sessions.length > 0 ? (
              <div className="ex-history-section">
                <p className="ex-history-label">History</p>
                <div className="ex-history-list">
                  {exData.sessions.map((session, i) => (
                    <div key={i} className="ex-history-row">
                      <p className="ex-history-row-date">{formatExDate(session.date)} · {session.workoutName}</p>
                      <div className="ex-history-row-sets">
                        {session.sets.map((s, j) => (
                          <span key={j} className="ex-history-chip">
                            {s.weight}×{s.reps}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="ex-sheet-note">No sets logged yet for this exercise.</p>
            )}

            <button className="ex-delete-btn" onClick={() => handleDelete(selected.id)}>
              Delete Exercise
            </button>
          </div>
        </div>
      )}

      {/* Add exercise modal */}
      {showAdd && (
        <div className="ex-overlay" onClick={() => setShowAdd(false)}>
          <div className="ex-modal" onClick={e => e.stopPropagation()}>
            <p className="ex-modal-title">New Exercise</p>

            <div className="ex-field">
              <label className="ex-field-label">Name</label>
              <input
                type="text"
                className="ex-text-input"
                placeholder="e.g. Cable Fly"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="ex-field">
              <label className="ex-field-label">Category</label>
              <select
                className="ex-select"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="ex-modal-actions">
              <button className="ex-cancel-btn" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button
                className="ex-save-btn"
                onClick={handleAddSave}
                disabled={!newName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Exercises;
