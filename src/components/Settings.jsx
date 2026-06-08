import React, { useState, useEffect } from 'react';
import { Calendar, ShieldCheck, Database, Trash2, Save, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { saveCertificate, logNotification, getAllCertificates, deleteCertificate } from '../services/db';
import { isFirebaseConfigured } from '../services/firebase';

export default function Settings({ onDataReset }) {
  const [validity, setValidity] = useState('1year');
  const [warningPeriod, setWarningPeriod] = useState(14);
  const [recipient, setRecipient] = useState('hr@company.com');
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Firebase Config States
  const [firebaseConfigText, setFirebaseConfigText] = useState('');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);

  useEffect(() => {
    setValidity(localStorage.getItem('default_validity') || '1year');
    setWarningPeriod(parseInt(localStorage.getItem('warning_period') || '14', 10));
    setRecipient(localStorage.getItem('notification_recipient') || 'hr@company.com');

    // Load Firebase Config
    const localConfig = localStorage.getItem('firebase_config');
    if (localConfig) {
      try {
        const parsed = JSON.parse(localConfig);
        setFirebaseConfigText(JSON.stringify(parsed, null, 2));
        setIsFirebaseConnected(isFirebaseConfigured());
      } catch (e) {
        setFirebaseConfigText(localConfig);
      }
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('default_validity', validity);
    localStorage.setItem('warning_period', warningPeriod.toString());
    localStorage.setItem('notification_recipient', recipient);
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
        recipient: recipient,
        type: 'warning-14day',
        sentAt: new Date(today.getTime() - (29 * 24 * 60 * 60 * 1000)).toISOString(),
        expirationDate: getOffsetDate(-15),
        status: 'Sent'
      });

      await logNotification({
        certificateId: 'cert_4',
        employeeName: 'Marcos Vargas',
        recipient: recipient,
        type: 'expired-alert',
        sentAt: new Date(today.getTime() - (15 * 24 * 60 * 60 * 1000)).toISOString(),
        expirationDate: getOffsetDate(-15),
        status: 'Sent'
      });

      // Elena Rodríguez (expiring soon in 10 days). Warned 4 days ago.
      await logNotification({
        certificateId: 'cert_3',
        employeeName: 'Elena Rodríguez',
        recipient: recipient,
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
              <label className="form-label" htmlFor="recipient-input">Destinatario de Notificaciones de RRHH</label>
              <input
                type="email"
                id="recipient-input"
                className="form-input"
                placeholder="hr@company.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              />
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

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', margin: '0.5rem 0' }}>
              <span className="form-label" style={{ margin: 0 }}>Estado:</span>
              {isFirebaseConnected ? (
                <span style={{ color: 'hsl(var(--status-active))', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  <Cloud size={16} /> Conectado a la Nube (Firestore)
                </span>
              ) : (
                <span style={{ color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
                  <CloudOff size={16} /> Solo almacenamiento local (IndexedDB)
                </span>
              )}
            </div>

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
