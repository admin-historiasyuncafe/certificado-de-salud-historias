import React, { useState, useEffect } from 'react';
import { 
  verifyAppPassword, 
  saveAppPassword, 
  getAppPassword, 
  subscribeToAppPassword 
} from '../services/auth';

export default function LoginPage({ onLogin }) {
  // ── Login state ──────────────────────────────────────────────────────────
  const [password, setPassword]         = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [loginError, setLoginError]     = useState('');
  const [shake, setShake]               = useState(false);
  const [isLoggingIn, setIsLoggingIn]   = useState(false);

  // ── Change-password state ────────────────────────────────────────────────
  const [mode, setMode]                 = useState('login'); // 'login' | 'changePassword'
  const [oldPass, setOldPass]           = useState('');
  const [newPass, setNewPass]           = useState('');
  const [confirmPass, setConfirmPass]   = useState('');
  const [showOld, setShowOld]           = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [changeMsg, setChangeMsg]       = useState({ text: '', type: '' });
  const [isChanging, setIsChanging]     = useState(false);

  // ── Sync with cloud on mount ─────────────────────────────────────────────
  useEffect(() => {
    // Proactively fetch latest master password from Firestore
    getAppPassword().catch(() => {});
    // Listen for real-time changes if Firestore is active
    const unsub = subscribeToAppPassword(() => {});
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setLoginError('');

    if (!password.trim()) {
      setLoginError('Por favor ingresa tu contraseña.');
      triggerShake();
      return;
    }

    setIsLoggingIn(true);
    try {
      const isValid = await verifyAppPassword(password);
      if (isValid) {
        setLoginError('');
        onLogin();
      } else {
        setLoginError('Contraseña incorrecta. Inténtalo de nuevo.');
        setPassword('');
        triggerShake();
      }
    } catch (err) {
      setLoginError('Error de verificación. Inténtalo de nuevo.');
      triggerShake();
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (isChanging) return;
    setChangeMsg({ text: '', type: '' });

    if (!oldPass) {
      setChangeMsg({ text: 'Ingresa tu contraseña actual.', type: 'error' });
      return;
    }

    setIsChanging(true);
    try {
      const isOldCorrect = await verifyAppPassword(oldPass);
      if (!isOldCorrect) {
        setChangeMsg({ text: 'La contraseña actual es incorrecta.', type: 'error' });
        setIsChanging(false);
        return;
      }
      if (newPass.length < 6) {
        setChangeMsg({ text: 'La nueva contraseña debe tener al menos 6 caracteres.', type: 'error' });
        setIsChanging(false);
        return;
      }
      if (newPass !== confirmPass) {
        setChangeMsg({ text: 'Las contraseñas nuevas no coinciden.', type: 'error' });
        setIsChanging(false);
        return;
      }

      await saveAppPassword(newPass);
      setChangeMsg({ 
        text: '✓ Contraseña actualizada correctamente en todos tus dispositivos.', 
        type: 'success' 
      });
      setOldPass('');
      setNewPass('');
      setConfirmPass('');
      setTimeout(() => {
        setMode('login');
        setChangeMsg({ text: '', type: '' });
      }, 2200);
    } catch (err) {
      setChangeMsg({ 
        text: err.message || 'Error al guardar la contraseña.', 
        type: 'error' 
      });
    } finally {
      setIsChanging(false);
    }
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
            : 'Se actualizará en tu Mac Mini, iPad, iPhone y demás dispositivos'}
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
                  disabled={isLoggingIn}
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  disabled={isLoggingIn}
                >
                  <EyeIcon visible={showPass} />
                </button>
              </div>
              {loginError && (
                <p className="login-error-msg" role="alert">{loginError}</p>
              )}
            </div>

            <button type="submit" className="btn btn-primary login-btn" disabled={isLoggingIn}>
              {isLoggingIn ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="spin-icon">
                    <line x1="12" y1="2" x2="12" y2="6"/>
                    <line x1="12" y1="18" x2="12" y2="22"/>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                    <line x1="2" y1="12" x2="6" y2="12"/>
                    <line x1="18" y1="12" x2="22" y2="12"/>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                  </svg>
                  Verificando...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Entrar
                </>
              )}
            </button>

            <button
              type="button"
              className="login-change-link"
              onClick={() => {
                setMode('changePassword');
                setLoginError('');
                setPassword('');
              }}
              disabled={isLoggingIn}
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
                  disabled={isChanging}
                />
                <button type="button" className="login-eye-btn" onClick={() => setShowOld(v => !v)} aria-label="Mostrar contraseña actual" disabled={isChanging}>
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
                  disabled={isChanging}
                />
                <button type="button" className="login-eye-btn" onClick={() => setShowNew(v => !v)} aria-label="Mostrar nueva contraseña" disabled={isChanging}>
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
                  disabled={isChanging}
                />
                <button type="button" className="login-eye-btn" onClick={() => setShowConfirm(v => !v)} aria-label="Mostrar confirmación" disabled={isChanging}>
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
                disabled={isChanging}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isChanging}>
                {isChanging ? 'Sincronizando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
