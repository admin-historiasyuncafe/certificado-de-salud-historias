import React, { useState } from 'react';

const DEFAULT_PASSWORD_KEY = 'docu_app_password';
const DEFAULT_PASSWORD     = 'Pabonscosme01!!';

function getStoredPassword() {
  return localStorage.getItem(DEFAULT_PASSWORD_KEY) || DEFAULT_PASSWORD;
}

export default function LoginPage({ onLogin }) {
  // ── Login state ──────────────────────────────────────────────────────────
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loginError, setLoginError] = useState('');
  const [shake, setShake]           = useState(false);

  // ── Change-password state ────────────────────────────────────────────────
  const [mode, setMode]             = useState('login'); // 'login' | 'changePassword'
  const [oldPass, setOldPass]       = useState('');
  const [newPass, setNewPass]       = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showOld, setShowOld]       = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changeMsg, setChangeMsg]   = useState({ text: '', type: '' });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === getStoredPassword()) {
      setLoginError('');
      onLogin();
    } else {
      setLoginError('Contraseña incorrecta. Inténtalo de nuevo.');
      setPassword('');
      triggerShake();
    }
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setChangeMsg({ text: '', type: '' });

    if (oldPass !== getStoredPassword()) {
      setChangeMsg({ text: 'La contraseña actual es incorrecta.', type: 'error' });
      return;
    }
    if (newPass.length < 6) {
      setChangeMsg({ text: 'La nueva contraseña debe tener al menos 6 caracteres.', type: 'error' });
      return;
    }
    if (newPass !== confirmPass) {
      setChangeMsg({ text: 'Las contraseñas nuevas no coinciden.', type: 'error' });
      return;
    }

    localStorage.setItem(DEFAULT_PASSWORD_KEY, newPass);
    setChangeMsg({ text: '✓ Contraseña actualizada correctamente.', type: 'success' });
    setOldPass('');
    setNewPass('');
    setConfirmPass('');
    setTimeout(() => {
      setMode('login');
      setChangeMsg({ text: '', type: '' });
    }, 2000);
  };

  // ── EyeIcon helper ───────────────────────────────────────────────────────
  const EyeIcon = ({ visible }) => visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="login-overlay">
      {/* Animated background blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      <div className={`login-card ${shake ? 'login-shake' : ''}`}>
        {/* Logo / branding */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
        </div>

        <h1 className="login-title">
          {mode === 'login' ? 'Bienvenido' : 'Cambiar Contraseña'}
        </h1>
        <p className="login-subtitle">
          {mode === 'login'
            ? 'Certificado de Salud · Historias y un Café'
            : 'Ingresa tu contraseña actual y la nueva'}
        </p>

        {/* ── LOGIN FORM ── */}
        {mode === 'login' && (
          <form className="login-form" onSubmit={handleLogin} noValidate>
            <div className="login-field">
              <label className="form-label" htmlFor="login-password">Contraseña</label>
              <div className="login-input-wrap">
                <input
                  id="login-password"
                  className="form-input login-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLoginError('');
                  }}
                  placeholder="Ingresa tu contraseña"
                  autoFocus
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <EyeIcon visible={showPass} />
                </button>
              </div>
              {loginError && (
                <p className="login-error-msg" role="alert">{loginError}</p>
              )}
            </div>

            <button type="submit" className="btn btn-primary login-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              Entrar
            </button>

            <button
              type="button"
              className="login-change-link"
              onClick={() => {
                setMode('changePassword');
                setLoginError('');
                setPassword('');
              }}
            >
              ¿Cambiar contraseña?
            </button>
          </form>
        )}

        {/* ── CHANGE PASSWORD FORM ── */}
        {mode === 'changePassword' && (
          <form className="login-form" onSubmit={handleChangePassword} noValidate>
            {/* Current password */}
            <div className="login-field">
              <label className="form-label" htmlFor="old-password">Contraseña actual</label>
              <div className="login-input-wrap">
                <input
                  id="old-password"
                  className="form-input login-input"
                  type={showOld ? 'text' : 'password'}
                  value={oldPass}
                  onChange={(e) => { setOldPass(e.target.value); setChangeMsg({ text: '', type: '' }); }}
                  placeholder="Tu contraseña actual"
                  autoFocus
                  autoComplete="current-password"
                />
                <button type="button" className="login-eye-btn" onClick={() => setShowOld(v => !v)} aria-label="Mostrar contraseña actual">
                  <EyeIcon visible={showOld} />
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="login-field">
              <label className="form-label" htmlFor="new-password">Nueva contraseña</label>
              <div className="login-input-wrap">
                <input
                  id="new-password"
                  className="form-input login-input"
                  type={showNew ? 'text' : 'password'}
                  value={newPass}
                  onChange={(e) => { setNewPass(e.target.value); setChangeMsg({ text: '', type: '' }); }}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
                <button type="button" className="login-eye-btn" onClick={() => setShowNew(v => !v)} aria-label="Mostrar nueva contraseña">
                  <EyeIcon visible={showNew} />
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="login-field">
              <label className="form-label" htmlFor="confirm-password">Confirmar nueva contraseña</label>
              <div className="login-input-wrap">
                <input
                  id="confirm-password"
                  className="form-input login-input"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPass}
                  onChange={(e) => { setConfirmPass(e.target.value); setChangeMsg({ text: '', type: '' }); }}
                  placeholder="Repite la nueva contraseña"
                  autoComplete="new-password"
                />
                <button type="button" className="login-eye-btn" onClick={() => setShowConfirm(v => !v)} aria-label="Mostrar confirmación">
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>
            </div>

            {changeMsg.text && (
              <p
                className={`login-change-msg ${changeMsg.type === 'success' ? 'login-change-msg--success' : 'login-change-msg--error'}`}
                role="alert"
              >
                {changeMsg.text}
              </p>
            )}

            <div className="login-change-actions">
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  setMode('login');
                  setOldPass('');
                  setNewPass('');
                  setConfirmPass('');
                  setChangeMsg({ text: '', type: '' });
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Guardar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
