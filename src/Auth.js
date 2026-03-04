import { useState } from 'react';
import { supabase } from './supabase';
import './Auth.css';

function Auth({ onAuth, onGuest }) {
  const [mode,     setMode]     = useState('signin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [info,     setInfo]     = useState('');

  function switchMode(m) {
    setMode(m);
    setError('');
    setInfo('');
  }

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'signin') {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        onAuth(data.user.id);
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        if (!data.session) {
          setInfo('Check your email to confirm your account.');
          setLoading(false);
          return;
        }
        onAuth(data.user.id);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit();
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-logo">Gym Tracker</p>
        <h1 className="auth-title">
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h1>

        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === 'signin' ? ' active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Sign In
          </button>
          <button
            className={`auth-tab${mode === 'signup' ? ' active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Create Account
          </button>
        </div>

        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input
            type="email"
            className="auth-input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">Password</label>
          <input
            type="password"
            className="auth-input"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && <p className="auth-error">{error}</p>}
        {info  && <p className="auth-info">{info}</p>}

        <button
          className="auth-submit-btn"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {loading
            ? '…'
            : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>

        <div className="auth-divider">or</div>

        <button className="auth-guest-btn" onClick={onGuest}>
          Continue as Guest
        </button>
      </div>
    </div>
  );
}

export default Auth;
