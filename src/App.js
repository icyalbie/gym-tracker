import './App.css';
import { useState } from 'react';
import Home from './Home';
import WorkoutLogger from './WorkoutLogger';
import WeightLogger from './WeightLogger';
import CalorieLogger from './CalorieLogger';
import Exercises from './Exercises';

const NAV_ITEMS = [
  { id: 'home',      label: 'Home',      icon: '🏠' },
  { id: 'workout',   label: 'Workout',   icon: '🏋️' },
  { id: 'exercises', label: 'Exercises', icon: '📋' },
  { id: 'weight',    label: 'Weight',    icon: '⚖️' },
  { id: 'calories',  label: 'Calories',  icon: '🥗' },
];

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <div className="App">
      <header className="app-header">
        <h1>Gym Tracker</h1>
      </header>

      <main className="app-main">
        {currentPage === 'home'     && <Home onNavigate={setCurrentPage} />}
        {currentPage === 'workout'  && <WorkoutLogger />}
        {currentPage === 'weight'   && <WeightLogger />}
        {currentPage === 'exercises' && <Exercises />}
        {currentPage === 'calories' && <CalorieLogger />}
      </main>

      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`nav-btn${currentPage === id ? ' active' : ''}`}
            onClick={() => setCurrentPage(id)}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
