import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import './WorkoutLogger.css';

// ── Storage keys ────────────────────────────────────────────
const EXERCISES_KEY  = 'gymtracker_exercises';
const TEMPLATES_KEY  = 'gymtracker_templates';
const WORKOUTS_KEY   = 'gymtracker_workouts';
const ACTIVE_KEY     = 'gymtracker_active_workout';
const WEIGHT_KEY     = 'gymtracker_weight';
const CATEGORIES_KEY = 'gymtracker_categories';

// ── Exercise library defaults ────────────────────────────────
const DEFAULT_CATEGORIES = [
  'Vertical Pull', 'Vertical Push',
  'Horizontal Pull', 'Horizontal Push',
  'Hinge', 'Squat', 'Accessory',
];

function loadCategories() {
  try {
    const stored = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
    if (Array.isArray(stored) && stored.length > 0) return stored;
  } catch {}
  return [...DEFAULT_CATEGORIES];
}

const DEFAULT_EXERCISES = [
  { id: 'vpl-1', name: 'Pull-up',               category: 'Vertical Pull',   custom: false },
  { id: 'vpl-2', name: 'Chin-up',               category: 'Vertical Pull',   custom: false },
  { id: 'vpl-3', name: 'Lat Pulldown',          category: 'Vertical Pull',   custom: false },
  { id: 'vpl-4', name: 'Cable Pullover',        category: 'Vertical Pull',   custom: false },
  { id: 'vpu-1', name: 'Overhead Press',        category: 'Vertical Push',   custom: false },
  { id: 'vpu-2', name: 'Dumbbell Shoulder Press', category: 'Vertical Push', custom: false },
  { id: 'vpu-3', name: 'Arnold Press',          category: 'Vertical Push',   custom: false },
  { id: 'vpu-4', name: 'Push Press',            category: 'Vertical Push',   custom: false },
  { id: 'hpl-1', name: 'Barbell Row',           category: 'Horizontal Pull', custom: false },
  { id: 'hpl-2', name: 'Dumbbell Row',          category: 'Horizontal Pull', custom: false },
  { id: 'hpl-3', name: 'Cable Row',             category: 'Horizontal Pull', custom: false },
  { id: 'hpl-4', name: 'Chest-Supported Row',   category: 'Horizontal Pull', custom: false },
  { id: 'hpu-1', name: 'Bench Press',           category: 'Horizontal Push', custom: false },
  { id: 'hpu-2', name: 'Dumbbell Bench Press',  category: 'Horizontal Push', custom: false },
  { id: 'hpu-3', name: 'Incline Bench Press',   category: 'Horizontal Push', custom: false },
  { id: 'hpu-4', name: 'Push-up',               category: 'Horizontal Push', custom: false },
  { id: 'hin-1', name: 'Deadlift',              category: 'Hinge',           custom: false },
  { id: 'hin-2', name: 'Romanian Deadlift',     category: 'Hinge',           custom: false },
  { id: 'hin-3', name: 'Hip Thrust',            category: 'Hinge',           custom: false },
  { id: 'hin-4', name: 'Good Morning',          category: 'Hinge',           custom: false },
  { id: 'sq-1',  name: 'Back Squat',            category: 'Squat',           custom: false },
  { id: 'sq-2',  name: 'Front Squat',           category: 'Squat',           custom: false },
  { id: 'sq-3',  name: 'Goblet Squat',          category: 'Squat',           custom: false },
  { id: 'sq-4',  name: 'Leg Press',             category: 'Squat',           custom: false },
  { id: 'acc-1', name: 'Bicep Curl',            category: 'Accessory',       custom: false },
  { id: 'acc-2', name: 'Tricep Extension',      category: 'Accessory',       custom: false },
  { id: 'acc-3', name: 'Lateral Raise',         category: 'Accessory',       custom: false },
  { id: 'acc-4', name: 'Face Pull',             category: 'Accessory',       custom: false },
  { id: 'acc-5', name: 'Calf Raise',            category: 'Accessory',       custom: false },
];

const CAT_SHORT = {
  'Vertical Pull':   'V. Pull',
  'Vertical Push':   'V. Push',
  'Horizontal Pull': 'H. Pull',
  'Horizontal Push': 'H. Push',
  'Hinge':           'Hinge',
  'Squat':           'Squat',
  'Accessory':       'Acc.',
};

function catShort(cat) {
  if (CAT_SHORT[cat]) return CAT_SHORT[cat];
  // Truncate long custom category names to fit the cell
  return cat.length > 8 ? cat.slice(0, 7) + '…' : cat;
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function formatExDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, '${y.slice(2)}`;
}

function getBodyweightForDate(dateKey, weightEntries) {
  if (!weightEntries || weightEntries.length === 0) return null;
  const exact = weightEntries.find(e => e.dateKey === dateKey);
  if (exact) return exact.weight;
  const sorted = [...weightEntries].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return sorted.length > 0 ? sorted[0].weight : null;
}

function getExSessions(ex, workouts) {
  const sessions = [];
  for (const wo of workouts) {
    const found = wo.exercises?.find(e =>
      (ex.exerciseId && e.exerciseId === ex.exerciseId) || e.name === ex.name
    );
    if (found && found.sets?.length > 0) {
      sessions.push({ date: wo.date, sets: found.sets });
    }
  }
  return sessions.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
}

function computeExStats(ex, workouts) {
  const sessions = [];
  const allSets  = [];
  for (const wo of workouts) {
    const found = wo.exercises?.find(e =>
      (ex.exerciseId && e.exerciseId === ex.exerciseId) || e.name === ex.name
    );
    if (found && found.sets?.length > 0) {
      sessions.push({ date: wo.date, workoutName: wo.name, sets: found.sets });
      allSets.push(...found.sets);
    }
  }
  sessions.sort((a, b) => b.date.localeCompare(a.date));

  const oneRepSets = allSets.filter(s => s.reps === 1);
  const oneRM = oneRepSets.length > 0 ? Math.max(...oneRepSets.map(s => s.weight)) : null;

  const repPRSets = allSets.filter(s => s.reps >= 3);
  const repPR = repPRSets.length > 0
    ? repPRSets.reduce((best, s) =>
        s.weight > best.weight ? s
        : (s.weight === best.weight && s.reps > best.reps ? s : best)
      )
    : null;

  return { sessions, oneRM, repPR };
}

// ── Component ────────────────────────────────────────────────
function WorkoutLogger({ userId }) {
  const isGuest = !userId;

  const [view, setView] = useState('list'); // 'list'|'create'|'workout'

  const [exercises,     setExercises]     = useState(() => isGuest ? load(EXERCISES_KEY, DEFAULT_EXERCISES) : []);
  const [templates,     setTemplates]     = useState(() => isGuest ? load(TEMPLATES_KEY, []) : []);
  const [workouts,      setWorkouts]      = useState(() => isGuest ? load(WORKOUTS_KEY,  []) : []);
  const [activeWorkout, setActiveWorkout] = useState(() => load(ACTIVE_KEY, null));
  const [weightEntries, setWeightEntries] = useState(() => isGuest ? load(WEIGHT_KEY, []) : []);

  // History
  const [selectedWorkout,   setSelectedWorkout]   = useState(null);
  const [expandedWorkoutId, setExpandedWorkoutId] = useState(null);

  // Template carousel
  const carouselRef = useRef(null);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  // Exercise drag-to-reorder
  const exDragSrc = useRef(null);

  // Template card drag-to-reorder
  const tmplDragSrc = useRef(null);
  const [tmplDragOverIdx, setTmplDragOverIdx] = useState(null);

  // Template editor: rename
  const [renamingExIdx, setRenamingExIdx] = useState(null);
  const [renameVal,     setRenameVal]     = useState('');

  function handleCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;
    setActiveCardIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  function handleCarouselMouseDown(e) {
    const el = carouselRef.current;
    if (!el) return;
    dragState.current = { isDown: true, startX: e.pageX, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }

  function handleCarouselMouseMove(e) {
    const el = carouselRef.current;
    if (!el || !dragState.current.isDown) return;
    e.preventDefault();
    el.scrollLeft = dragState.current.scrollLeft - (e.pageX - dragState.current.startX);
  }

  function handleCarouselMouseUp() {
    const el = carouselRef.current;
    if (!el || !dragState.current.isDown) return;
    dragState.current.isDown = false;
    el.style.cursor = '';
    el.style.userSelect = '';
    const cardWidth = el.clientWidth;
    el.scrollTo({ left: Math.round(el.scrollLeft / cardWidth) * cardWidth, behavior: 'smooth' });
  }

  function handleTmplDrop(toIdx) {
    const fromIdx = tmplDragSrc.current;
    tmplDragSrc.current = null;
    setTmplDragOverIdx(null);
    if (fromIdx === null || fromIdx === toIdx) return;
    const reordered = [...templates];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    saveTemplates(reordered);
  }

  // Template draft
  const [draftName,      setDraftName]      = useState('');
  const [draftExercises, setDraftExercises] = useState([]);
  const [editTmplId,     setEditTmplId]     = useState(null);

  // Exercise picker
  // pickerTarget: null (template editor) | { action:'swap', idx } | { action:'add' }
  const [showPicker,    setShowPicker]    = useState(false);
  const [pickerTarget,  setPickerTarget]  = useState(null);
  const [pickerSearch,  setPickerSearch]  = useState('');
  const [showNewExForm, setShowNewExForm] = useState(false);
  const [newExName,     setNewExName]     = useState('');
  const [categories,    setCategories]    = useState(loadCategories);
  const [newExCategory, setNewExCategory] = useState(() => loadCategories()[0]);

  // Exercise stats sheet (active workout)
  const [activeExSheet, setActiveExSheet] = useState(null); // exIdx | null

  // Add-set modal
  const [addSetModal, setAddSetModal] = useState(null);
  const [addSetW,     setAddSetW]     = useState('');
  const [addSetR,     setAddSetR]     = useState('');
  const [addSetBW,    setAddSetBW]    = useState(false);

  // Edit-set modal
  const [editSetCtx, setEditSetCtx] = useState(null);
  const [editSetW,   setEditSetW]   = useState('');
  const [editSetR,   setEditSetR]   = useState('');
  const [editSetBW,  setEditSetBW]  = useState(false);

  // ── Load from Supabase ──────────────────────────────────────
  useEffect(() => {
    if (isGuest) return;

    Promise.all([
      supabase.from('exercises').select('*'),
      supabase.from('templates').select('*'),
      supabase.from('workouts').select('*').order('date', { ascending: false }),
      supabase.from('weight_entries').select('*').order('date_key'),
    ]).then(([exRes, tmplRes, woRes, wRes]) => {
      const exData = exRes.data ?? [];
      if (exData.length === 0) {
        supabase.from('exercises')
          .insert(DEFAULT_EXERCISES.map(e => ({ user_id: userId, name: e.name, category: e.category })))
          .select()
          .then(({ data }) => {
            if (data) setExercises(data.map(e => ({ id: e.id, name: e.name, category: e.category })));
          });
      } else {
        setExercises(exData.map(e => ({ id: e.id, name: e.name, category: e.category })));
      }

      setTemplates((tmplRes.data ?? []).map(t => ({ id: t.id, name: t.name, exercises: t.exercises })));

      setWorkouts((woRes.data ?? []).map(wo => ({
        id: wo.id, name: wo.name, date: wo.date,
        completedAt: wo.completed_at, exercises: wo.exercises,
      })));

      setWeightEntries((wRes.data ?? []).map(w => ({
        id: w.id, dateKey: w.date_key, label: w.label, weight: w.weight,
      })));
    });
  }, [userId, isGuest]);

  // ── Persistence helpers ─────────────────────────────────────
  function saveExercises(v) {
    setExercises(v);
    if (isGuest) localStorage.setItem(EXERCISES_KEY, JSON.stringify(v));
  }
  function saveTemplates(v) {
    setTemplates(v);
    if (isGuest) localStorage.setItem(TEMPLATES_KEY, JSON.stringify(v));
  }
  function saveWorkouts(v) {
    setWorkouts(v);
    if (isGuest) localStorage.setItem(WORKOUTS_KEY, JSON.stringify(v));
  }
  function saveActive(v) {
    setActiveWorkout(v);
    if (v) localStorage.setItem(ACTIVE_KEY, JSON.stringify(v));
    else   localStorage.removeItem(ACTIVE_KEY);
  }

  // ── Sync template when workout exercises change ─────────────
  async function syncTemplateExercises(updatedExercises) {
    if (!activeWorkout?.templateId) return;
    const tmplEx = updatedExercises.map(({ exerciseId, name, category }) => ({ exerciseId, name, category }));
    if (isGuest) {
      saveTemplates(templates.map(t =>
        t.id === activeWorkout.templateId ? { ...t, exercises: tmplEx } : t
      ));
    } else {
      await supabase.from('templates').update({ exercises: tmplEx }).eq('id', activeWorkout.templateId);
      setTemplates(prev => prev.map(t =>
        t.id === activeWorkout.templateId ? { ...t, exercises: tmplEx } : t
      ));
    }
  }

  // ── Exercise reordering ─────────────────────────────────────
  function reorderWorkoutEx(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const exs = [...activeWorkout.exercises];
    const [moved] = exs.splice(fromIdx, 1);
    exs.splice(toIdx, 0, moved);
    saveActive({ ...activeWorkout, exercises: exs });
  }

  function reorderDraftEx(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const exs = [...draftExercises];
    const [moved] = exs.splice(fromIdx, 1);
    exs.splice(toIdx, 0, moved);
    setDraftExercises(exs);
  }

  function commitRename(idx) {
    if (renameVal.trim()) {
      setDraftExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, name: renameVal.trim() } : ex));
    }
    setRenamingExIdx(null);
  }

  // ── Template creation / editing ────────────────────────────
  function openCreate() {
    setEditTmplId(null); setDraftName(''); setDraftExercises([]); setView('create');
  }

  function openEditTemplate(template) {
    setEditTmplId(template.id);
    setDraftName(template.name);
    setDraftExercises(template.exercises);
    setView('create');
  }

  async function handleSaveTemplate() {
    if (!draftName.trim() || draftExercises.length === 0) return;

    if (isGuest) {
      if (editTmplId !== null) {
        saveTemplates(templates.map(t =>
          t.id === editTmplId ? { ...t, name: draftName.trim(), exercises: draftExercises } : t
        ));
      } else {
        saveTemplates([...templates, {
          id: `tmpl-${Date.now()}`,
          name: draftName.trim(),
          exercises: draftExercises,
        }]);
      }
    } else {
      if (editTmplId !== null) {
        await supabase.from('templates')
          .update({ name: draftName.trim(), exercises: draftExercises })
          .eq('id', editTmplId);
        setTemplates(prev => prev.map(t =>
          t.id === editTmplId ? { ...t, name: draftName.trim(), exercises: draftExercises } : t
        ));
      } else {
        const { data } = await supabase.from('templates')
          .insert({ user_id: userId, name: draftName.trim(), exercises: draftExercises })
          .select().single();
        if (data) setTemplates(prev => [...prev, { id: data.id, name: data.name, exercises: data.exercises }]);
      }
    }
    setEditTmplId(null); setView('list');
  }

  async function handleDeleteTemplate() {
    if (isGuest) {
      saveTemplates(templates.filter(t => t.id !== editTmplId));
    } else {
      await supabase.from('templates').delete().eq('id', editTmplId);
      setTemplates(prev => prev.filter(t => t.id !== editTmplId));
    }
    setEditTmplId(null); setView('list');
  }

  // ── Exercise picker ────────────────────────────────────────
  // target: null = template editor | { action:'swap', idx } | { action:'add' }
  function openPicker(target = null) {
    // Reload categories in case user updated them on the Exercises page
    const fresh = loadCategories();
    setCategories(fresh);
    setNewExCategory(fresh[0]);
    setPickerTarget(target);
    setPickerSearch(''); setShowNewExForm(false); setNewExName(''); setShowPicker(true);
  }

  function handlePickerSelect(ex) {
    if (pickerTarget?.action === 'swap') {
      const newExercises = activeWorkout.exercises.map((e, i) =>
        i === pickerTarget.idx
          ? { exerciseId: ex.id, name: ex.name, category: ex.category, sets: e.sets }
          : e
      );
      const newActive = { ...activeWorkout, exercises: newExercises };
      saveActive(newActive);
      syncTemplateExercises(newExercises);
    } else if (pickerTarget?.action === 'add') {
      const newExercises = [
        ...activeWorkout.exercises,
        { exerciseId: ex.id, name: ex.name, category: ex.category, sets: [] },
      ];
      const newActive = { ...activeWorkout, exercises: newExercises };
      saveActive(newActive);
      syncTemplateExercises(newExercises);
    } else {
      // template editor
      setDraftExercises(prev => [...prev, { exerciseId: ex.id, name: ex.name, category: ex.category }]);
    }
    setShowPicker(false);
  }

  async function handleCreateNewExercise() {
    const name = newExName.trim();
    if (!name) return;

    if (isGuest) {
      const ex = { id: `custom-${Date.now()}`, name, category: newExCategory, custom: true };
      saveExercises([...exercises, ex]);
      handlePickerSelect(ex);
    } else {
      const { data } = await supabase.from('exercises')
        .insert({ user_id: userId, name, category: newExCategory })
        .select().single();
      if (data) {
        const ex = { id: data.id, name: data.name, category: data.category };
        setExercises(prev => [...prev, ex]);
        handlePickerSelect(ex);
      }
    }
    setNewExName(''); setShowNewExForm(false);
  }

  const filteredExercises = pickerSearch.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(pickerSearch.toLowerCase()))
    : exercises;

  // Include any exercises in categories not in the list (e.g. legacy data)
  const knownCats = new Set(categories);
  const extraCats = [...new Set(filteredExercises.map(e => e.category).filter(c => !knownCats.has(c)))];
  const pickerGrouped = [...categories, ...extraCats]
    .map(cat => ({ category: cat, list: filteredExercises.filter(e => e.category === cat) }))
    .filter(g => g.list.length > 0);

  // ── Active workout ─────────────────────────────────────────
  function startWorkout(template) {
    saveActive({
      templateId: template.id,
      name: template.name,
      startedAt: new Date().toISOString(),
      exercises: template.exercises.map(e => ({ ...e, sets: [] })),
    });
    setView('workout');
  }

  async function handleFinishWorkout() {
    if (isGuest) {
      saveWorkouts([{
        id:          `workout-${Date.now()}`,
        name:        activeWorkout.name,
        templateId:  activeWorkout.templateId,
        date:        localDateKey(),
        completedAt: new Date().toISOString(),
        exercises:   activeWorkout.exercises,
      }, ...workouts]);
    } else {
      const { data } = await supabase.from('workouts').insert({
        user_id:      userId,
        name:         activeWorkout.name,
        date:         localDateKey(),
        completed_at: new Date().toISOString(),
        exercises:    activeWorkout.exercises,
      }).select().single();
      if (data) {
        setWorkouts(prev => [{
          id: data.id, name: data.name, date: data.date,
          completedAt: data.completed_at, exercises: data.exercises,
        }, ...prev]);
      }
    }
    saveActive(null);
    setView('list');
  }

  function handleAbandonWorkout() { saveActive(null); setView('list'); }

  // ── Add set ────────────────────────────────────────────────
  function openAddSet(source, exIdx) {
    setAddSetModal({ source, exIdx });
    setAddSetW(''); setAddSetR(''); setAddSetBW(false);
  }

  function handleAddSet() {
    const w = parseFloat(addSetW);
    const r = parseInt(addSetR, 10);
    if (isNaN(w) || isNaN(r) || w < 0 || r < 1) return;
    const { source, exIdx } = addSetModal;

    let finalWeight = w;
    if (addSetBW) {
      const workoutDate = source === 'active' ? localDateKey() : selectedWorkout.date;
      const bw = getBodyweightForDate(workoutDate, weightEntries);
      if (bw !== null) finalWeight = Math.round((w + bw) * 100) / 100;
    }

    const newSet = { weight: finalWeight, reps: r };
    if (source === 'active') {
      saveActive({
        ...activeWorkout,
        exercises: activeWorkout.exercises.map((ex, i) =>
          i === exIdx ? { ...ex, sets: [...ex.sets, newSet] } : ex
        ),
      });
    } else {
      commitHistoryEdit(exIdx, sets => [...sets, newSet]);
    }
    setAddSetModal(null);
  }

  // ── Edit set ───────────────────────────────────────────────
  function openEditSet(source, exIdx, setIdx) {
    const workout = source === 'active' ? activeWorkout : selectedWorkout;
    const s = workout.exercises[exIdx].sets[setIdx];
    setEditSetCtx({ source, exIdx, setIdx });
    setEditSetW(String(s.weight));
    setEditSetR(String(s.reps));
    setEditSetBW(false);
  }

  function handleSaveEditSet() {
    const w = parseFloat(editSetW);
    const r = parseInt(editSetR, 10);
    if (isNaN(w) || isNaN(r) || w < 0 || r < 1) return;
    const { source, exIdx, setIdx } = editSetCtx;

    let finalWeight = w;
    if (editSetBW) {
      const workoutDate = source === 'active' ? localDateKey() : selectedWorkout.date;
      const bw = getBodyweightForDate(workoutDate, weightEntries);
      if (bw !== null) finalWeight = Math.round((w + bw) * 100) / 100;
    }

    const newSet = { weight: finalWeight, reps: r };
    if (source === 'active') {
      saveActive({
        ...activeWorkout,
        exercises: activeWorkout.exercises.map((ex, i) =>
          i === exIdx
            ? { ...ex, sets: ex.sets.map((s, j) => j === setIdx ? newSet : s) }
            : ex
        ),
      });
    } else {
      commitHistoryEdit(exIdx, sets => sets.map((s, j) => j === setIdx ? newSet : s));
    }
    setEditSetCtx(null);
  }

  function handleDeleteSet() {
    const { source, exIdx, setIdx } = editSetCtx;
    if (source === 'active') {
      saveActive({
        ...activeWorkout,
        exercises: activeWorkout.exercises.map((ex, i) =>
          i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex
        ),
      });
    } else {
      commitHistoryEdit(exIdx, sets => sets.filter((_, j) => j !== setIdx));
    }
    setEditSetCtx(null);
  }

  async function commitHistoryEdit(exIdx, transformSets) {
    if (isGuest) {
      const updated = workouts.map(wo =>
        wo.id !== selectedWorkout.id ? wo : {
          ...wo,
          exercises: wo.exercises.map((ex, i) =>
            i === exIdx ? { ...ex, sets: transformSets(ex.sets) } : ex
          ),
        }
      );
      saveWorkouts(updated);
      setSelectedWorkout(updated.find(wo => wo.id === selectedWorkout.id));
    } else {
      const updatedExercises = selectedWorkout.exercises.map((ex, i) =>
        i === exIdx ? { ...ex, sets: transformSets(ex.sets) } : ex
      );
      await supabase.from('workouts').update({ exercises: updatedExercises }).eq('id', selectedWorkout.id);
      const updatedWorkout = { ...selectedWorkout, exercises: updatedExercises };
      setWorkouts(prev => prev.map(wo => wo.id === selectedWorkout.id ? updatedWorkout : wo));
      setSelectedWorkout(updatedWorkout);
    }
  }

  // ── Toggle history dropdown ────────────────────────────────
  function toggleWorkout(wo) {
    if (expandedWorkoutId === wo.id) {
      setExpandedWorkoutId(null);
      setSelectedWorkout(null);
    } else {
      setExpandedWorkoutId(wo.id);
      setSelectedWorkout(wo);
    }
  }

  // ── Delete completed workout ───────────────────────────────
  async function handleDeleteWorkout() {
    if (isGuest) {
      saveWorkouts(workouts.filter(wo => wo.id !== selectedWorkout.id));
    } else {
      await supabase.from('workouts').delete().eq('id', selectedWorkout.id);
      setWorkouts(prev => prev.filter(wo => wo.id !== selectedWorkout.id));
    }
    setSelectedWorkout(null);
    setExpandedWorkoutId(null);
  }

  // ── Shared: workout table rows ─────────────────────────────
  function WorkoutTable({ workout, source }) {
    const draggable = source === 'active';
    return (
      <div className="wl-table-card">
        <div className={`wl-table-head workout-head${draggable ? ' with-handle' : ''}`}>
          {draggable && <span />}
          <span>Category</span>
          <span>Exercise</span>
          <span>Sets</span>
        </div>
        {workout.exercises.map((ex, i) => (
          <div
            key={i}
            className={`wl-table-row workout-row${draggable ? ' with-handle' : ''}`}
            draggable={draggable}
            onDragStart={draggable ? () => { exDragSrc.current = i; } : undefined}
            onDragOver={draggable ? e => e.preventDefault() : undefined}
            onDrop={draggable ? () => { reorderWorkoutEx(exDragSrc.current, i); exDragSrc.current = null; } : undefined}
          >
            {draggable && <span className="wl-drag-handle">⠿</span>}
            <span className="wl-cell-cat">{catShort(ex.category)}</span>
            <span
              className={`wl-cell-name${source === 'active' ? ' wl-cell-name-tap' : ''}`}
              onClick={source === 'active' ? () => setActiveExSheet(i) : undefined}
            >{ex.name}</span>
            <div className="wl-cell-sets">
              {ex.sets.map((s, j) => (
                <button
                  key={j}
                  className="wl-set-chip"
                  onClick={() => openEditSet(source, i, j)}
                >
                  {s.weight}×{s.reps}
                </button>
              ))}
              <button className="wl-add-set-btn" onClick={() => openAddSet(source, i)}>+</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Modal date context ─────────────────────────────────────
  const addSetWorkoutDate = addSetModal
    ? (addSetModal.source === 'active' ? localDateKey() : selectedWorkout?.date)
    : null;

  const editSetWorkoutDate = editSetCtx
    ? (editSetCtx.source === 'active' ? localDateKey() : selectedWorkout?.date)
    : null;

  // ── Shared modal props ─────────────────────────────────────
  const addSetModalProps = {
    ctx: addSetModal,
    w: addSetW, setW: setAddSetW,
    r: addSetR, setR: setAddSetR,
    onClose: () => setAddSetModal(null),
    onAdd: handleAddSet,
    workouts, weightEntries,
    workoutDate: addSetWorkoutDate,
    addBW: addSetBW, setAddBW: setAddSetBW,
  };
  const editSetModalProps = {
    ctx: editSetCtx,
    w: editSetW, setW: setEditSetW,
    r: editSetR, setR: setEditSetR,
    onClose: () => setEditSetCtx(null),
    onSave: handleSaveEditSet,
    onDelete: handleDeleteSet,
    workouts, weightEntries,
    workoutDate: editSetWorkoutDate,
    editBW: editSetBW, setEditBW: setEditSetBW,
  };
  const pickerModalProps = {
    show: showPicker,
    pickerSearch, setPickerSearch,
    pickerGrouped,
    showNewExForm, setShowNewExForm,
    newExName, setNewExName,
    newExCategory, setNewExCategory,
    categories,
    onClose: () => setShowPicker(false),
    onSelect: handlePickerSelect,
    onCreate: handleCreateNewExercise,
  };

  // ══════════════════════════════════════════════════════════
  // VIEW: LIST
  // ══════════════════════════════════════════════════════════
  if (view === 'list') return (
    <div className="wl-page">
      <div className="wl-page-header">
        <div>
          <p className="wl-sub">Your workouts</p>
          <h2 className="wl-title">Workout</h2>
        </div>
        <button className="wl-add-btn" onClick={openCreate}>+</button>
      </div>

      {activeWorkout && (
        <button className="wl-resume-banner" onClick={() => setView('workout')}>
          <div>
            <p className="wl-resume-label">In Progress</p>
            <p className="wl-resume-name">{activeWorkout.name}</p>
          </div>
          <span className="wl-resume-arrow">›</span>
        </button>
      )}

      <div className="wl-section">
        <p className="wl-section-title">Templates</p>
        {templates.length === 0 ? (
          <p className="wl-empty-text">No templates yet — tap + to create one.</p>
        ) : (
          <div className="wl-carousel-wrap">
            <div
              className="wl-carousel"
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              onMouseDown={handleCarouselMouseDown}
              onMouseMove={handleCarouselMouseMove}
              onMouseUp={handleCarouselMouseUp}
              onMouseLeave={handleCarouselMouseUp}
            >
              {templates.map((t, i) => (
                <div
                  key={t.id}
                  className={`wl-carousel-card${tmplDragOverIdx === i ? ' drag-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setTmplDragOverIdx(i); }}
                  onDragLeave={() => setTmplDragOverIdx(null)}
                  onDrop={() => handleTmplDrop(i)}
                >
                  <div className="wl-carousel-card-header">
                    <span
                      className="wl-carousel-card-handle"
                      draggable
                      onDragStart={e => { e.stopPropagation(); tmplDragSrc.current = i; }}
                      onDragEnd={() => { tmplDragSrc.current = null; setTmplDragOverIdx(null); }}
                    >⠿</span>
                    <div>
                      <p className="wl-carousel-name">{t.name}</p>
                      <p className="wl-carousel-meta">
                        {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button className="wl-carousel-edit-btn" onClick={() => openEditTemplate(t)}>
                      Edit
                    </button>
                  </div>
                  <div className="wl-carousel-exercises">
                    {t.exercises.map((ex, i) => (
                      <div key={i} className="wl-carousel-ex-row">
                        <span className="wl-carousel-ex-cat">{catShort(ex.category)}</span>
                        <span className="wl-carousel-ex-name">{ex.name}</span>
                      </div>
                    ))}
                  </div>
                  <button className="wl-carousel-start-btn" onClick={() => startWorkout(t)}>
                    Start Workout
                  </button>
                </div>
              ))}
            </div>
            {templates.length > 1 && (
              <div className="wl-carousel-dots">
                {templates.map((_, i) => (
                  <div key={i} className={`wl-carousel-dot${i === activeCardIdx ? ' active' : ''}`} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {workouts.length > 0 && (
        <div className="wl-section">
          <p className="wl-section-title">Recent</p>
          <div className="wl-card-list">
            {workouts.slice(0, 10).map(wo => {
              const isExpanded = expandedWorkoutId === wo.id;
              const totalSets  = wo.exercises.reduce((n, e) => n + e.sets.length, 0);
              return (
                <div key={wo.id} className="wl-history-item">
                  <button className="wl-history-card" onClick={() => toggleWorkout(wo)}>
                    <div>
                      <p className="wl-history-name">{wo.name}</p>
                      <p className="wl-history-meta">
                        {formatDate(wo.date)} · {wo.exercises.length} exercise{wo.exercises.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="wl-history-right">
                      <p className="wl-history-sets">{totalSets} set{totalSets !== 1 ? 's' : ''}</p>
                      <span className={`wl-row-chevron${isExpanded ? ' open' : ''}`}>›</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="wl-history-expanded">
                      <WorkoutTable workout={wo} source="history" />
                      <button className="wl-abandon-btn" onClick={handleDeleteWorkout}>
                        Delete Workout
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AddSetModal {...addSetModalProps} workout={selectedWorkout} />
      <EditSetModal {...editSetModalProps} workout={selectedWorkout} />
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // VIEW: CREATE TEMPLATE
  // ══════════════════════════════════════════════════════════
  if (view === 'create') return (
    <div className="wl-page">
      <div className="wl-nav-header">
        <button className="wl-back-btn" onClick={() => { setEditTmplId(null); setView('list'); }}>‹</button>
        <h2 className="wl-nav-title">{editTmplId ? 'Edit Template' : 'New Template'}</h2>
        <button
          className="wl-header-save-btn"
          onClick={handleSaveTemplate}
          disabled={!draftName.trim() || draftExercises.length === 0}
        >
          Save
        </button>
      </div>

      <input
        type="text"
        className="wl-name-input"
        placeholder="Template name (e.g. Push Day)"
        value={draftName}
        onChange={e => setDraftName(e.target.value)}
        autoFocus
      />

      {draftExercises.length > 0 && (
        <div className="wl-table-card">
          <div className="wl-table-head tmpl-head with-handle">
            <span />
            <span>Category</span>
            <span>Exercise</span>
            <span></span>
          </div>
          {draftExercises.map((ex, i) => (
            <div
              key={i}
              className="wl-table-row tmpl-row"
              draggable
              onDragStart={() => { exDragSrc.current = i; }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { reorderDraftEx(exDragSrc.current, i); exDragSrc.current = null; }}
            >
              <span className="wl-drag-handle">⠿</span>
              <span className="wl-cell-cat">{catShort(ex.category)}</span>
              {renamingExIdx === i ? (
                <input
                  className="wl-rename-input"
                  value={renameVal}
                  autoFocus
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => commitRename(i)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(i); if (e.key === 'Escape') setRenamingExIdx(null); }}
                />
              ) : (
                <span
                  className="wl-cell-name wl-cell-name-tap"
                  onClick={() => { setRenamingExIdx(i); setRenameVal(ex.name); }}
                  title="Tap to rename"
                >{ex.name}</span>
              )}
              <button
                className="wl-remove-btn"
                onClick={() => setDraftExercises(prev => prev.filter((_, j) => j !== i))}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <button className="wl-add-exercise-btn" onClick={() => openPicker()}>
        + Add Exercise
      </button>

      {editTmplId && (
        <button className="wl-abandon-btn" onClick={handleDeleteTemplate}>
          Delete Template
        </button>
      )}

      <PickerModal {...pickerModalProps} />
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // VIEW: ACTIVE WORKOUT
  // ══════════════════════════════════════════════════════════
  if (view === 'workout' && activeWorkout) return (
    <div className="wl-page">
      <div className="wl-nav-header">
        <button className="wl-back-btn" onClick={() => setView('list')}>‹</button>
        <h2 className="wl-nav-title">{activeWorkout.name}</h2>
        <button className="wl-finish-btn" onClick={handleFinishWorkout}>Finish</button>
      </div>

      <WorkoutTable workout={activeWorkout} source="active" />

      <button className="wl-add-exercise-btn" onClick={() => openPicker({ action: 'add' })}>
        + Add Exercise
      </button>

      <button className="wl-abandon-btn" onClick={handleAbandonWorkout}>
        Abandon Workout
      </button>

      {/* Exercise stats sheet */}
      <ExerciseStatsSheet
        exIdx={activeExSheet}
        workout={activeWorkout}
        workouts={workouts}
        onClose={() => setActiveExSheet(null)}
        onSwap={idx => {
          setActiveExSheet(null);
          openPicker({ action: 'swap', idx });
        }}
      />

      <AddSetModal {...addSetModalProps} workout={activeWorkout} />
      <EditSetModal {...editSetModalProps} workout={activeWorkout} />
      <PickerModal {...pickerModalProps} />
    </div>
  );

  return null;
}

// ── Exercise stats sheet (shown when tapping exercise in active workout) ──

function ExerciseStatsSheet({ exIdx, workout, workouts, onClose, onSwap }) {
  if (exIdx === null || exIdx === undefined || !workout) return null;
  const ex = workout.exercises[exIdx];
  if (!ex) return null;

  const { sessions, oneRM, repPR } = computeExStats(ex, workouts);

  return (
    <div className="wl-overlay" onClick={onClose}>
      <div className="wl-ex-sheet" onClick={e => e.stopPropagation()}>
        <div className="wl-ex-sheet-header">
          <div>
            <p className="wl-ex-sheet-category">{ex.category}</p>
            <h3 className="wl-ex-sheet-name">{ex.name}</h3>
          </div>
          <button className="wl-picker-close" onClick={onClose}>✕</button>
        </div>

        <div className="wl-ex-stats-grid">
          <div className="wl-ex-stat-card">
            <p className="wl-ex-stat-label">1RM</p>
            {oneRM !== null ? (
              <>
                <p className="wl-ex-stat-value">{oneRM}<span className="wl-ex-stat-unit"> kg</span></p>
                <p className="wl-ex-stat-hint">Heaviest single rep</p>
              </>
            ) : (
              <>
                <p className="wl-ex-stat-value">—</p>
                <p className="wl-ex-stat-hint">No 1-rep sets logged</p>
              </>
            )}
          </div>
          <div className="wl-ex-stat-card">
            <p className="wl-ex-stat-label">Rep PR</p>
            {repPR !== null ? (
              <>
                <p className="wl-ex-stat-value">{repPR.weight}<span className="wl-ex-stat-unit"> kg</span></p>
                <p className="wl-ex-stat-hint">× {repPR.reps} reps</p>
              </>
            ) : (
              <>
                <p className="wl-ex-stat-value">—</p>
                <p className="wl-ex-stat-hint">No 3+ rep sets logged</p>
              </>
            )}
          </div>
        </div>

        <div className="wl-ex-history-section">
          {sessions.length > 0 ? (
            <>
              <p className="wl-ex-history-label">History</p>
              {sessions.map((session, i) => (
                <div key={i} className="wl-ex-history-row">
                  <p className="wl-ex-history-date">
                    {formatExDate(session.date)} · {session.workoutName}
                  </p>
                  <div className="wl-modal-history-chips">
                    {session.sets.map((s, j) => (
                      <span key={j} className="wl-modal-history-chip">{s.weight}×{s.reps}</span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="wl-ex-sheet-note">No sets logged yet for this exercise.</p>
          )}
        </div>

        <button className="wl-ex-change-btn" onClick={() => onSwap(exIdx)}>
          Change Exercise
        </button>
      </div>
    </div>
  );
}

// ── External modal components ────────────────────────────────

function PickerModal({
  show, pickerSearch, setPickerSearch, pickerGrouped,
  showNewExForm, setShowNewExForm, newExName, setNewExName,
  newExCategory, setNewExCategory, categories,
  onClose, onSelect, onCreate,
}) {
  if (!show) return null;
  return (
    <div className="wl-overlay" onClick={onClose}>
      <div className="wl-picker-modal" onClick={e => e.stopPropagation()}>
        {showNewExForm ? (
          <>
            <div className="wl-picker-header">
              <button className="wl-back-btn" onClick={() => setShowNewExForm(false)}>‹</button>
              <p className="wl-picker-title">New Exercise</p>
              <div style={{ width: 32 }} />
            </div>
            <div className="wl-field">
              <label className="wl-field-label">Name</label>
              <input
                type="text" className="wl-text-input" placeholder="e.g. Cable Fly"
                value={newExName} onChange={e => setNewExName(e.target.value)} autoFocus
              />
            </div>
            <div className="wl-field">
              <label className="wl-field-label">Category</label>
              <select className="wl-select" value={newExCategory} onChange={e => setNewExCategory(e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="wl-modal-actions">
              <button className="wl-cancel-btn" onClick={() => setShowNewExForm(false)}>Cancel</button>
              <button className="wl-save-btn" onClick={onCreate} disabled={!newExName.trim()}>Add</button>
            </div>
          </>
        ) : (
          <>
            <div className="wl-picker-header">
              <p className="wl-picker-title">Add Exercise</p>
              <button className="wl-picker-close" onClick={onClose}>✕</button>
            </div>
            <input
              type="text" className="wl-search-input" placeholder="Search exercises…"
              value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
            />
            <button className="wl-new-ex-btn" onClick={() => { setShowNewExForm(true); setNewExName(''); }}>
              + Create New Exercise
            </button>
            <div className="wl-picker-list">
              {pickerGrouped.map(({ category, list }) => (
                <div key={category}>
                  <p className="wl-picker-category">{category}</p>
                  {list.map(ex => (
                    <button key={ex.id} className="wl-picker-row" onClick={() => onSelect(ex)}>
                      {ex.name}
                    </button>
                  ))}
                </div>
              ))}
              {pickerGrouped.length === 0 && (
                <p className="wl-picker-empty">No exercises match your search.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddSetModal({ ctx, workout, w, setW, r, setR, onClose, onAdd,
  workouts, weightEntries, workoutDate, addBW, setAddBW }) {
  if (!ctx || !workout) return null;
  const ex = workout.exercises[ctx.exIdx];
  const sessions = getExSessions(ex, workouts);
  const bwValue = getBodyweightForDate(workoutDate, weightEntries);
  return (
    <div className="wl-overlay" onClick={onClose}>
      <div className="wl-set-modal" onClick={e => e.stopPropagation()}>
        <p className="wl-set-modal-title">{ex.name}</p>
        <p className="wl-set-modal-sub">Set {ex.sets.length + 1}</p>
        <SetInputs w={w} setW={setW} r={r} setR={setR} />
        {bwValue !== null && (
          <label className="wl-bw-check">
            <input type="checkbox" checked={addBW} onChange={e => setAddBW(e.target.checked)} />
            Add Bodyweight
            <span className="wl-bw-value">(+{bwValue} kg)</span>
          </label>
        )}
        {sessions.length > 0 && (
          <div className="wl-modal-history">
            <p className="wl-modal-history-label">Previous Sessions</p>
            {sessions.map((session, i) => (
              <div key={i} className="wl-modal-history-row">
                <span className="wl-modal-history-date">{formatExDate(session.date)}</span>
                <div className="wl-modal-history-chips">
                  {session.sets.map((s, j) => (
                    <span key={j} className="wl-modal-history-chip">{s.weight}×{s.reps}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="wl-modal-actions">
          <button className="wl-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="wl-save-btn" onClick={onAdd} disabled={w === '' || !r}>Add Set</button>
        </div>
      </div>
    </div>
  );
}

function EditSetModal({ ctx, workout, w, setW, r, setR, onClose, onSave, onDelete,
  workouts, weightEntries, workoutDate, editBW, setEditBW }) {
  if (!ctx || !workout) return null;
  const ex = workout.exercises[ctx.exIdx];
  const sessions = getExSessions(ex, workouts);
  const bwValue = getBodyweightForDate(workoutDate, weightEntries);
  return (
    <div className="wl-overlay" onClick={onClose}>
      <div className="wl-set-modal" onClick={e => e.stopPropagation()}>
        <p className="wl-set-modal-title">{ex.name}</p>
        <p className="wl-set-modal-sub">Set {ctx.setIdx + 1}</p>
        <SetInputs w={w} setW={setW} r={r} setR={setR} />
        {bwValue !== null && (
          <label className="wl-bw-check">
            <input type="checkbox" checked={editBW} onChange={e => setEditBW(e.target.checked)} />
            Add Bodyweight
            <span className="wl-bw-value">(+{bwValue} kg)</span>
          </label>
        )}
        {sessions.length > 0 && (
          <div className="wl-modal-history">
            <p className="wl-modal-history-label">Previous Sessions</p>
            {sessions.map((session, i) => (
              <div key={i} className="wl-modal-history-row">
                <span className="wl-modal-history-date">{formatExDate(session.date)}</span>
                <div className="wl-modal-history-chips">
                  {session.sets.map((s, j) => (
                    <span key={j} className="wl-modal-history-chip">{s.weight}×{s.reps}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="wl-modal-actions">
          <button className="wl-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="wl-save-btn" onClick={onSave} disabled={w === '' || !r}>Save</button>
        </div>
        <button className="wl-delete-set-btn" onClick={onDelete}>Delete Set</button>
      </div>
    </div>
  );
}

function SetInputs({ w, setW, r, setR }) {
  return (
    <div className="wl-set-inputs">
      <div className="wl-set-field">
        <label className="wl-field-label">Weight</label>
        <div className="wl-input-unit-row">
          <input
            type="number" className="wl-set-input"
            placeholder="0" step="0.5" min="0"
            value={w} onChange={e => setW(e.target.value)} autoFocus
          />
          <span className="wl-unit">kg</span>
        </div>
      </div>
      <div className="wl-set-field">
        <label className="wl-field-label">Reps</label>
        <div className="wl-input-unit-row">
          <input
            type="number" className="wl-set-input"
            placeholder="0" step="1" min="1"
            value={r} onChange={e => setR(e.target.value)}
          />
          <span className="wl-unit">reps</span>
        </div>
      </div>
    </div>
  );
}

export default WorkoutLogger;
