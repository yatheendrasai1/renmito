import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import './LoginPage.css';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login, signup } = useAuth();

  const [mode,         setMode]         = useState<Mode>('login');
  const [userName,     setUserName]     = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');

  // Already authenticated → skip login screen
  useEffect(() => {
    if (isAuthenticated) navigate('/logger', { replace: true });
  }, [isAuthenticated, navigate]);

  function switchMode(m: Mode) {
    setMode(m);
    setErrorMsg('');
    setPassword('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email || !password || (mode === 'signup' && !userName)) return;

    setLoading(true);
    setErrorMsg('');

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(userName, email, password);
      }
      // AuthContext updates isAuthenticated → useEffect above redirects
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Something went wrong. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">

      {/* ── Left panel: hero image ──────────────────────── */}
      <div className="login-left">
        <div className="hero-frame">
          <picture>
            <source srcSet="/assets/hero.webp" type="image/webp" />
            <img src="/assets/hero.jpeg" alt="Renmito hero" className="hero-img" loading="lazy" />
          </picture>
        </div>
      </div>

      {/* ── Right panel: auth form ──────────────────────── */}
      <div className="login-right">
        <div className="login-panel">

          {/* Brand */}
          <div className="login-brand">
            <h1 className="login-product-name">Renmito</h1>
            <p className="login-tagline">Pin the time. Get the grip!</p>
          </div>

          {/* Tab switcher */}
          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab${mode === 'login' ? ' login-tab--active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Log In
            </button>
            <button
              type="button"
              className={`login-tab${mode === 'signup' ? ' login-tab--active' : ''}`}
              onClick={() => switchMode('signup')}
            >
              Sign Up
            </button>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div className="login-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form className="login-form" onSubmit={handleSubmit} noValidate>

            {/* Username — signup only */}
            {mode === 'signup' && (
              <div className="form-field">
                <label htmlFor="userName">Username</label>
                <input
                  id="userName" type="text" name="userName"
                  value={userName} onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. john_doe"
                  autoComplete="username" required disabled={loading}
                />
              </div>
            )}

            {/* Email */}
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email" type="email" name="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email" required disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="form-field">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="show-pw-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {!showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="login-submit"
              disabled={loading || !email || !password || (mode === 'signup' && !userName)}
            >
              {loading && <span className="btn-spinner" />}
              <span>
                {loading
                  ? (mode === 'login' ? 'Logging in…' : 'Creating account…')
                  : (mode === 'login' ? 'Log In' : 'Create Account')}
              </span>
            </button>

          </form>

          {/* Footer switch */}
          <p className="login-switch">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button type="button" className="login-switch-btn" onClick={() => switchMode('signup')}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="login-switch-btn" onClick={() => switchMode('login')}>
                  Log in
                </button>
              </>
            )}
          </p>

        </div>
      </div>

    </div>
  );
}
