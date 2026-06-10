import React, { useState, useEffect } from 'react';
import { Calendar, ShieldCheck, Database, Trash2, Save, Cloud, CloudOff, RefreshCw, CheckCircle, XCircle, Loader } from 'lucide-react';
import { saveCertificate, logNotification, getAllCertificates, deleteCertificate } from '../services/db';
import { isFirebaseConfigured, getFirebaseConnectionError, setFirebaseConnectionError, getFirestoreDb } from '../services/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

export default function Settings({ onDataReset }) {
  const [validity, setValidity] = useState('1year');
  const [warningPeriod, setWarningPeriod] = useState(14);
  const [template, setTemplate] = useState('Hola [Nombre], te recordamos que debes actualizar tu Certificado de Salud que vence el [fecha]. ¡Gracias!');
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Firebase Config States
  const [firebaseConfigText, setFirebaseConfigText] = useState('');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);
  const [connectionTestStatus, setConnectionTestStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [connectionTestMsg, setConnectionTestMsg] = useState('');

  useEffect(() => {
    setValidity(localStorage.getItem('default_validity') || '1year');
    setWarningPeriod(parseInt(localStorage.getItem('warning_period') || '14', 10));
    setTemplate(localStorage.getItem('notification_template') || 'Hola [Nombre], te recordamos que debes actualizar tu Certificado de Salud que vence el [fecha]. ¡Gracias!');

    // Load Firebase Config
    const localConfig = localStorage.getItem('firebase_config');
    if (localConfig) {
      try {
        const parsed = JSON.parse(localConfig);
        setFirebaseConfigText(JSON.stringify(parsed, null, 2));
      } catch (e) {
        setFirebaseConfigText(localConfig);
      }
    } else {
      // Cargar la configuración por defecto si está activa en el sistema
      const hasFirebase = isFirebaseConfigured();
      if (hasFirebase) {
        // Obtenemos la config por defecto directamente
        const localCreds = {
          apiKey: "AIzaSyARgNWxgx6l5OWRzKRam-xrbOh94XXrlMM",
          authDomain: "docuhistorias-db.firebaseapp.com",
          projectId: "docuhistorias-db",
          storageBucket: "docuhistorias-db.firebasestorage.app",
          messagingSenderId: "512184671483",
          appId: "1:512184671483:web:5352e8eddfdf97124d645e",
          measurementId: "G-8JM1DQ26ZS"
        };
        setFirebaseConfigText(JSON.stringify(localCreds, null, 2));
      }
    }
    setIsFirebaseConnected(isFirebaseConfigured());
    // Only show the stored error on first load — the user can re-test manually
    const storedErr = getFirebaseConnectionError();
    setFirebaseError(storedErr);
  }, []);

  // Live connection test against Firestore
  const testFirestoreConnection = async () => {
    if (!isFirebaseConfigured()) {
      setConnectionTestStatus('error');
      setConnectionTestMsg('Firebase no está configurado.');
      return;
    }
    setConnectionTestStatus('testing');
    setConnectionTestMsg('');
    try {
      const db = getFirestoreDb();
      const certsCol = collection(db, 'certificates');
      const q = query(certsCol, limit(1));
      // Race against a 8s timeout
      await Promise.race([
        getDocs(q),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tiempo de espera agotado (8s). Revisa tu conexión a internet.')), 8000)
        )
      ]);
      // Success!
      setConnectionTestStatus('ok');
      setConnectionTestMsg('¡Firestore accesible! La sincronización en la nube está funcionando correctamente.');
      setFirebaseError(null);
      setFirebaseConnectionError(null);
    } catch (err) {
      const msg = err?.message || String(err);
      setConnectionTestStatus('error');
      setConnectionTestMsg(msg);
      setFirebaseError(msg);
      setFirebaseConnectionError(msg);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('default_validity', validity);
    localStorage.setItem('warning_period', warningPeriod.toString());
    localStorage.setItem('notification_template', template);
    setStatusMessage({ text: '¡Configuración guardada con éxito!', type: 'success' });
    setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
  };

  const handleLoadMockData = async () => {
    setIsLoading(true);
    try {
      // 1. Wipe existing certificates first to have a clean mock setup
      const existing = await getAllCertificates();
      for (const cert of existing) {
        await deleteCertificate(cert.id);
      }

      const today = new Date();
      
      // Helper to generate ISO date offset from today
      const getOffsetDate = (days) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
      };

      // Create a 1x1 transparent PNG blob for mock images
      const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const byteCharacters = atob(base64Png);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const mockBlob = new Blob([byteArray], { type: 'image/png' });

      // Mock dataset
      const mockCerts = [
        {
          id: 'cert_1',
          employeeName: 'Sofía Jiménez',
          issueDate: getOffsetDate(-100),
          expirationDate: getOffsetDate(265), // Active (approx 9 months left)
          businessRule: '1year',
          uploadedAt: getOffsetDate(-100),
          imageBlob: mockBlob,
          imageName: 'sofia_jimenez_certificado_salud.png',
          imageType: 'image/png'
        },
        {
          id: 'cert_2',
          employeeName: 'Daniel Martínez',
          issueDate: getOffsetDate(-30),
          expirationDate: getOffsetDate(700), // Active (2 years validity, 1.9 years left)
          businessRule: '2years',
          uploadedAt: getOffsetDate(-30),
          imageBlob: mockBlob,
          imageName: 'daniel_martinez_alta_medica.png',
          imageType: 'image/png'
        },
        {
          id: 'cert_3',
          employeeName: 'Elena Rodríguez',
          issueDate: getOffsetDate(-355),
          expirationDate: getOffsetDate(10), // Expiring Soon (10 days left, within 14d limit)
          businessRule: '1year',
          uploadedAt: getOffsetDate(-355),
          imageBlob: mockBlob,
          imageName: 'elena_rodriguez_certificado_2026.png',
          imageType: 'image/png'
        },
        {
          id: 'cert_4',
          employeeName: 'Marcos Vargas',
          issueDate: getOffsetDate(-380),
          expirationDate: getOffsetDate(-15), // Expired (15 days ago)
          businessRule: '1year',
          uploadedAt: getOffsetDate(-380),
          imageBlob: mockBlob,
          imageName: 'marcos_vargas_evaluacion_medica.png',
          imageType: 'image/png'
        },
        {
          id: 'cert_5',
          employeeName: 'Diana Pérez',
          issueDate: getOffsetDate(-200),
          expirationDate: '', // Indefinite rule
          businessRule: 'none',
          uploadedAt: getOffsetDate(-200),
          imageBlob: mockBlob,
          imageName: 'diana_perez_declaracion_salud.png',
          imageType: 'image/png'
        }
      ];

      // Save each certificate
      for (const cert of mockCerts) {
        await saveCertificate(cert);
      }

      // Pre-populate notification logs for expired/expiring
      // Marcos Vargas (expired 15 days ago). Warned 29 days ago. Expiration reminder sent 15 days ago.
      await logNotification({
        certificateId: 'cert_4',
        employeeName: 'Marcos Vargas',
        recipient: 'Manual (WhatsApp/SMS)',
        type: 'warning-14day',
        sentAt: new Date(today.getTime() - (29 * 24 * 60 * 60 * 1000)).toISOString(),
        expirationDate: getOffsetDate(-15),
        status: 'Sent'
      });

      await logNotification({
        certificateId: 'cert_4',
        employeeName: 'Marcos Vargas',
        recipient: 'Manual (WhatsApp/SMS)',
        type: 'expired-alert',
        sentAt: new Date(today.getTime() - (15 * 24 * 60 * 60 * 1000)).toISOString(),
        expirationDate: getOffsetDate(-15),
        status: 'Sent'
      });

      // Elena Rodríguez (expiring soon in 10 days). Warned 4 days ago.
      await logNotification({
        certificateId: 'cert_3',
        employeeName: 'Elena Rodríguez',
        recipient: 'Manual (WhatsApp/SMS)',
        type: 'warning-14day',
        sentAt: new Date(today.getTime() - (4 * 24 * 60 * 60 * 1000)).toISOString(),
        expirationDate: getOffsetDate(10),
        status: 'Sent'
      });

      setStatusMessage({ text: '¡Datos demo cargados con éxito!', type: 'success' });
      if (onDataReset) onDataReset();
    } catch (err) {
      console.error(err);
      setStatusMessage({ text: 'Error al cargar datos demo: ' + err.message, type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 4000);
    }
  };

  const handleWipeData = async () => {
    if (!window.confirm('¿Está completamente seguro de que desea eliminar todos los datos y registros de certificados? Esta acción es irreversible.')) return;
    
    setIsLoading(true);
    try {
      const existing = await getAllCertificates();
      for (const cert of existing) {
        await deleteCertificate(cert.id);
      }
      setStatusMessage({ text: 'Se han eliminado todos los datos.', type: 'success' });
      if (onDataReset) onDataReset();
    } catch (err) {
      setStatusMessage({ text: 'Error al eliminar datos: ' + err.message, type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 4000);
    }
  };

  const handleSaveFirebase = (e) => {
    e.preventDefault();
    try {
      if (!firebaseConfigText.trim()) {
        throw new Error('La configuración de Firebase no puede estar vacía.');
      }
      
      const parsed = JSON.parse(firebaseConfigText);
      if (!parsed.apiKey || !parsed.projectId) {
        throw new Error('La configuración debe contener al menos "apiKey" y "projectId".');
      }

      localStorage.setItem('firebase_config', JSON.stringify(parsed));
      setIsFirebaseConnected(true);
      setStatusMessage({ text: '¡Configuración de Firebase guardada con éxito! Recargando para iniciar la sincronización...', type: 'success' });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      setStatusMessage({ text: 'Error en el JSON de Firebase: ' + err.message, type: 'error' });
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 5000);
    }
  };

  const handleDisconnectFirebase = () => {
    if (window.confirm('¿Deseas desconectar Firebase? La aplicación volverá a utilizar la base de datos local (IndexedDB).')) {
      localStorage.removeItem('firebase_config');
      setIsFirebaseConnected(false);
      setFirebaseConfigText('');
      setStatusMessage({ text: 'Firebase desconectado. Recargando...', type: 'success' });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  return (
    <div className="settings-container animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Configuración del Sistema</h2>
        <p className="view-subtitle">Configure las reglas de alerta de vencimiento, los periodos de validez predeterminados y gestione la base de datos local.</p>
      </div>

      {statusMessage.text && (
        <div className={`alert-banner ${statusMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {statusMessage.text}
        </div>
      )}

      <div className="settings-grid">
        {/* Business and Alert Rules */}
        <section className="glass-card settings-card">
          <div className="card-header-icon">
            <Calendar className="cyan-glow-icon" size={24} />
            <h3>Reglas de Cumplimiento y Alertas</h3>
          </div>
          <p className="settings-description">
            Defina las reglas de negocio globales para determinar las fechas de vencimiento y activar las alertas de RRHH.
          </p>
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label" htmlFor="default-validity-select">Periodo de Validez Predeterminado</label>
                <select
                  id="default-validity-select"
                  className="form-input"
                  value={validity}
                  onChange={(e) => setValidity(e.target.value)}
                >
                  <option value="1year">1 Año (Estándar)</option>
                  <option value="2years">2 Años (Extendido)</option>
                  <option value="none">Sin valor predeterminado (Requerir fecha explícita)</option>
                </select>
              </div>

              <div className="form-group flex-1">
                <label className="form-label" htmlFor="warning-period-input">Periodo de Advertencia (Días)</label>
                <input
                  type="number"
                  id="warning-period-input"
                  className="form-input"
                  min="1"
                  max="120"
                  value={warningPeriod}
                  onChange={(e) => setWarningPeriod(Math.max(1, parseInt(e.target.value, 10)))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="template-input">Plantilla de Recordatorio por Texto (SMS / WhatsApp)</label>
              <textarea
                id="template-input"
                className="form-input"
                rows="4"
                style={{ resize: 'vertical' }}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem', display: 'block' }}>
                Usa <strong>[Nombre]</strong> para el nombre y <strong>[fecha]</strong> para la fecha de vencimiento.
              </span>
            </div>

            <button type="submit" className="btn btn-primary">
              <Save size={18} />
              Guardar Reglas del Sistema
            </button>
          </form>
        </section>

        {/* Sincronización con Firebase */}
        <section className="glass-card settings-card">
          <div className="card-header-icon">
            <Cloud className="cyan-glow-icon" size={24} />
            <h3>Sincronización en la Nube (Firebase)</h3>
          </div>
          <p className="settings-description">
            Conecta tu aplicación a un proyecto de Firebase para sincronizar tus datos (certificados y logs) en tiempo real entre múltiples dispositivos.
          </p>
          <form onSubmit={handleSaveFirebase}>
            <div className="form-group">
              <label className="form-label" htmlFor="firebase-config-input">Objeto de Configuración Firebase (JSON)</label>
              <textarea
                id="firebase-config-input"
                className="form-input"
                rows="6"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                placeholder={`{\n  "apiKey": "AIzaSy...",\n  "authDomain": "...",\n  "projectId": "...",\n  "storageBucket": "...",\n  "messagingSenderId": "...",\n  "appId": "..."\n}`}
                value={firebaseConfigText}
                onChange={(e) => setFirebaseConfigText(e.target.value)}
                required
              />
            </div>

            {/* Connection Status & Test */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', margin: '0.5rem 0' }}>
              <span className="form-label" style={{ margin: 0 }}>Estado:</span>
              {isFirebaseConnected ? (
                <span style={{ color: 'hsl(var(--status-active))', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  <Cloud size={16} /> Firebase Configurado
                </span>
              ) : (
                <span style={{ color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
                  <CloudOff size={16} /> Solo almacenamiento local (IndexedDB)
                </span>
              )}
              {isFirebaseConnected && (
                <button
                  type="button"
                  onClick={testFirestoreConnection}
                  disabled={connectionTestStatus === 'testing'}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', gap: '0.4rem' }}
                >
                  {connectionTestStatus === 'testing'
                    ? <><RefreshCw size={14} className="spin-icon" /> Probando...</>
                    : <><RefreshCw size={14} /> Probar Conexión</>}
                </button>
              )}
            </div>

            {/* Test result banner */}
            {connectionTestStatus === 'ok' && (
              <div style={{
                marginTop: '0.5rem', padding: '0.75rem', borderRadius: '8px',
                backgroundColor: 'hsl(var(--status-active) / 0.12)',
                border: '1px solid hsl(var(--status-active) / 0.3)',
                color: 'hsl(var(--status-active))',
                fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem'
              }}>
                <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{connectionTestMsg}</span>
              </div>
            )}

            {connectionTestStatus === 'error' && (
              <div style={{
                marginTop: '0.5rem', padding: '0.75rem', borderRadius: '8px',
                backgroundColor: 'hsl(var(--status-expired) / 0.12)',
                border: '1px solid hsl(var(--status-expired) / 0.3)',
                color: 'hsl(var(--status-expired))',
                fontSize: '0.85rem', lineHeight: '1.5'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <XCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <strong>{connectionTestMsg}</strong>
                </div>
                <div style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem', paddingLeft: '1.5rem' }}>
                  Verifica que las <strong>Reglas de Firestore</strong> digan{' '}
                  <code style={{ background: 'hsl(var(--bg-primary))', padding: '1px 5px', borderRadius: '4px' }}>
                    allow read, write: if true;
                  </code>{' '}
                  y que hayas hecho clic en <strong>Publicar</strong> en la consola de Firebase.
                </div>
              </div>
            )}

            {/* Legacy error (from previous session) shown only if no test has been run yet */}
            {!connectionTestStatus && firebaseError && (
              <div style={{
                marginTop: '0.5rem', padding: '0.75rem', borderRadius: '8px',
                backgroundColor: 'hsl(var(--status-warning) / 0.1)',
                border: '1px solid hsl(var(--status-warning) / 0.3)',
                color: 'hsl(var(--status-warning))',
                fontSize: '0.85rem', lineHeight: '1.4'
              }}>
                <strong>⚠️ Último error registrado:</strong> {firebaseError}
                <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'hsl(var(--text-secondary))' }}>
                  Haz clic en <strong>Probar Conexión</strong> para verificar el estado actual.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                <Save size={18} />
                Guardar y Conectar
              </button>
              {isFirebaseConnected && (
                <button
                  type="button"
                  onClick={handleDisconnectFirebase}
                  className="btn btn-danger"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem' }}
                  title="Desconectar Firebase"
                >
                  <CloudOff size={18} />
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Database Management */}
        <section className="glass-card settings-card span-two-cols">
          <div className="card-header-icon">
            <Database className="cyan-glow-icon" size={24} />
            <h3>Controles de la Base de Datos Local</h3>
          </div>
          <p className="settings-description">
            Sus datos se almacenan 100% de forma local en el navegador (IndexedDB). Limpie la base de datos para eliminar todos los registros o cargue un conjunto de datos demo estructurado.
          </p>
          <div className="settings-actions">
            <button
              onClick={handleLoadMockData}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              <ShieldCheck className="green-text" size={18} />
              {isLoading ? 'Reiniciando...' : 'Cargar Datos de Demostración'}
            </button>
            <button
              onClick={handleWipeData}
              disabled={isLoading}
              className="btn btn-danger"
            >
              <Trash2 size={18} />
              {isLoading ? 'Eliminando...' : 'Limpiar Base de Datos'}
            </button>
          </div>
        </section>
      </div>

      <style>{`
        .settings-container {
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
        }

        .view-header {
          margin-bottom: 2rem;
        }

        .view-title {
          font-size: 2.2rem;
          margin-bottom: 0.5rem;
        }

        .view-subtitle {
          color: hsl(var(--text-secondary));
          font-size: 1.05rem;
        }

        .alert-banner {
          padding: 1rem 1.5rem;
          border-radius: 10px;
          margin-bottom: 1.5rem;
          font-weight: 500;
          animation: fadeIn 0.3s ease;
        }

        .alert-success {
          background-color: hsl(var(--status-active) / 0.15);
          color: hsl(var(--status-active));
          border: 1px solid hsl(var(--status-active) / 0.3);
        }

        .alert-error {
          background-color: hsl(var(--status-expired) / 0.15);
          color: hsl(var(--status-expired));
          border: 1px solid hsl(var(--status-expired) / 0.3);
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .span-two-cols {
          grid-column: span 2;
        }

        .settings-card {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .card-header-icon {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .card-header-icon h3 {
          font-size: 1.25rem;
          color: hsl(var(--text-primary));
        }

        .cyan-glow-icon {
          color: hsl(var(--accent-cyan));
          filter: drop-shadow(0 0 6px hsl(var(--accent-cyan) / 0.4));
        }

        .settings-description {
          color: hsl(var(--text-secondary));
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .inline-link {
          color: hsl(var(--accent-cyan));
          text-decoration: none;
          font-weight: 600;
        }
        .inline-link:hover {
          text-decoration: underline;
        }

        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-input {
          width: 100%;
          padding-right: 2.5rem;
        }

        .password-toggle {
          position: absolute;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: hsl(var(--text-secondary));
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .password-toggle:hover {
          color: hsl(var(--text-primary));
        }

        .form-row {
          display: flex;
          gap: 1rem;
        }

        .flex-1 {
          flex: 1;
        }

        .settings-actions {
          display: flex;
          gap: 1rem;
        }

        .green-text {
          color: hsl(var(--status-active));
        }

        /* Spinning animation for the test button */
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 900px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }
          .span-two-cols {
            grid-column: span 1;
          }
          .settings-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
