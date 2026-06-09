import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Shield, 
  Users, 
  Calendar, 
  Clock, 
  ArrowUpRight, 
  Bell, 
  Download,
  Trash2,
  X,
  FileText
} from 'lucide-react';
import { getAllCertificates, deleteCertificate, getNotificationLogs, saveCertificate } from '../services/db';
import { downloadICSFile } from '../utils/calendar';

export default function Dashboard({ refreshTrigger, onViewChange }) {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expiring: 0,
    expired: 0,
    complianceScore: 100
  });
  
  const [urgentCerts, setUrgentCerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [certImageUrl, setCertImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editIssueDate, setEditIssueDate] = useState('');
  const [editRule, setEditRule] = useState('1year');
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const dialogRef = useRef(null);

  useEffect(() => {
    loadDashboardData();
  }, [refreshTrigger]);

  // Auto-calculate expiration in edit mode
  useEffect(() => {
    if (!editIssueDate || editRule === 'none' || editRule === 'custom') {
      if (editRule === 'none') setEditExpirationDate('');
      return;
    }
    const date = new Date(editIssueDate);
    if (isNaN(date.getTime())) return;
    if (editRule === '1year')  date.setFullYear(date.getFullYear() + 1);
    if (editRule === '2years') date.setFullYear(date.getFullYear() + 2);
    setEditExpirationDate(date.toISOString().split('T')[0]);
  }, [editIssueDate, editRule]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const certificates = await getAllCertificates();
      const notificationLogs = await getNotificationLogs();
      setLogs(notificationLogs);

      const total = certificates.length;
      let active = 0;
      let expiring = 0;
      let expired = 0;
      const urgentList = [];

      certificates.forEach(c => {
        if (c.status === 'active') active++;
        else if (c.status === 'expiring') {
          expiring++;
          urgentList.push(c);
        } else if (c.status === 'expired') {
          expired++;
          urgentList.push(c);
        }
      });

      // Sort urgent certificates: expired first
      urgentList.sort((a, b) => {
        if (a.status === 'expired' && b.status !== 'expired') return -1;
        if (a.status !== 'expired' && b.status === 'expired') return 1;
        return new Date(a.expirationDate) - new Date(b.expirationDate);
      });

      // Compliance score calculation: active + expiring vs total
      // Expired counts against compliance score
      const complianceScore = total > 0 ? Math.round(((active + expiring) / total) * 100) : 100;

      setStats({
        total,
        active,
        expiring,
        expired,
        complianceScore
      });

      setUrgentCerts(urgentList.slice(0, 5)); // Show top 5 urgent items
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openDetails = (cert) => {
    setSelectedCert(cert);
    if (cert.imageBlob) {
      const url = URL.createObjectURL(cert.imageBlob);
      setCertImageUrl(url);
    } else {
      setCertImageUrl('');
    }
    
    if (dialogRef.current) {
      dialogRef.current.showModal();
    }
  };

  const closeDetails = () => {
    if (dialogRef.current) {
      dialogRef.current.close();
    }
    setSelectedCert(null);
    setIsEditing(false);
    if (certImageUrl) {
      URL.revokeObjectURL(certImageUrl);
      setCertImageUrl('');
    }
  };

  const startEditing = () => {
    if (!selectedCert) return;
    setEditName(selectedCert.employeeName || '');
    setEditDept(selectedCert.department || '');
    setEditIssueDate(selectedCert.issueDate || '');
    setEditRule(selectedCert.businessRule || '1year');
    setEditExpirationDate(selectedCert.expirationDate || '');
    setEditNotes(selectedCert.notes || '');
    setIsEditing(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return alert('El nombre del empleado es obligatorio.');
    if (!editIssueDate) return alert('La fecha de emisión es obligatoria.');
    if (editRule === 'custom' && !editExpirationDate) {
      return alert('Por favor, ingrese la fecha de vencimiento.');
    }

    try {
      const updatedCert = {
        ...selectedCert,
        employeeName: editName.trim(),
        department: editDept.trim(),
        issueDate: editIssueDate,
        businessRule: editRule,
        expirationDate: editRule === 'none' ? '' : editExpirationDate,
        notes: editNotes.trim(),
      };

      const saved = await saveCertificate(updatedCert);
      setSelectedCert(saved);
      setIsEditing(false);
      loadDashboardData();
    } catch (err) {
      alert('Error al guardar los cambios: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('¿Está seguro de que desea eliminar este certificado y todos sus registros de cumplimiento?');
    if (!confirmDelete) return;

    try {
      await deleteCertificate(id);
      closeDetails();
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // SVGRadial Gauge Math
  const radius = 50;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.complianceScore / 100) * circumference;

  return (
    <div className="dashboard-container animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Panel de Control de Cumplimiento</h2>
        <p className="view-subtitle">Monitoree certificados de salud, alertas de vencimiento y notificaciones automáticamente.</p>
      </div>

      {isLoading ? (
        <div className="loading-state-dash">
          <div className="spinner"></div>
          <p>Analizando base de datos de cumplimiento...</p>
        </div>
      ) : (
        <>
          {/* Stats Cards Row */}
          <div className="stats-row">
            <div className="glass-card stat-card border-glow-cyan">
              <div className="stat-icon-wrapper icon-bg-cyan">
                <Users size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-label">Total Empleados en Seguimiento</p>
                <h3 className="stat-value">{stats.total}</h3>
              </div>
            </div>

            <div className="glass-card stat-card border-glow-green">
              <div className="stat-icon-wrapper icon-bg-green">
                <ShieldCheck size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-label">Cumplimiento Activo</p>
                <h3 className="stat-value text-green">{stats.active}</h3>
              </div>
            </div>

            <div className="glass-card stat-card border-glow-warning">
              <div className="stat-icon-wrapper icon-bg-warning">
                <Clock size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-label">Vence Pronto (14d)</p>
                <h3 className="stat-value text-warning">{stats.expiring}</h3>
              </div>
            </div>

            <div className="glass-card stat-card border-glow-danger">
              <div className="stat-icon-wrapper icon-bg-danger">
                <ShieldAlert size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-label">Vencido (Acción Requerida)</p>
                <h3 className="stat-value text-danger">{stats.expired}</h3>
              </div>
            </div>
          </div>

          {/* Core Analytics Grid */}
          <div className="analytics-grid">
            {/* Compliance Gauge Panel */}
            <div className="glass-card compliance-panel">
              <h3>Puntuación de Cumplimiento</h3>
              <div className="gauge-wrapper">
                <svg className="radial-gauge" viewBox="0 0 120 120">
                  <circle
                    className="gauge-bg"
                    cx="60"
                    cy="60"
                    r={radius}
                    strokeWidth={strokeWidth}
                  />
                  <circle
                    className={`gauge-progress ${stats.complianceScore === 100 ? 'gauge-perfect' : stats.complianceScore >= 80 ? 'gauge-good' : 'gauge-poor'}`}
                    cx="60"
                    cy="60"
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="gauge-text">
                  <span className="gauge-percentage">{stats.complianceScore}%</span>
                  <span className="gauge-label">Seguro</span>
                </div>
              </div>
              <div className="compliance-verdict">
                {stats.complianceScore === 100 ? (
                  <p className="text-green flex items-center justify-center gap-1">
                    <Shield size={16} /> 100% en Cumplimiento. Sin acción inmediata.
                  </p>
                ) : stats.expired > 0 ? (
                  <p className="text-danger flex items-center justify-center gap-1">
                    <ShieldAlert size={16} /> Atención: Se detectaron {stats.expired} certificado{stats.expired > 1 ? 's' : ''} vencido{stats.expired > 1 ? 's' : ''}.
                  </p>
                ) : (
                  <p className="text-warning flex items-center justify-center gap-1">
                    <Clock size={16} /> Información: {stats.expiring} renovación{stats.expiring > 1 ? 'es' : ''} aproximándose a la fecha límite.
                  </p>
                )}
              </div>
            </div>

            {/* Urgent Renewal Queue */}
            <div className="glass-card action-panel">
              <div className="panel-header">
                <h3>Lista de Renovación Urgente</h3>
                <button onClick={() => onViewChange('repository')} className="view-all-link">
                  Ver Repositorio <ArrowUpRight size={16} />
                </button>
              </div>

              {urgentCerts.length === 0 ? (
                <div className="compliant-shield-wrapper animate-fade-in">
                  <ShieldCheck size={50} className="shield-sparkle" />
                  <h4>Plantilla en Cumplimiento</h4>
                  <p>Todos los empleados activos cuentan con registros de salud vigentes.</p>
                </div>
              ) : (
                <div className="urgent-list">
                  {urgentCerts.map((cert) => (
                    <div 
                      key={cert.id} 
                      className={`urgent-item border-left-${cert.status}`}
                      onClick={() => openDetails(cert)}
                    >
                      <div className="urgent-item-info">
                        <h4 className="urgent-name">{cert.employeeName}</h4>
                        <p className="urgent-date">
                          Vence: <strong>{cert.expirationDate}</strong>
                        </p>
                      </div>
                      <div className="urgent-item-action">
                        <span className={`badge badge-${cert.status}`}>
                          {cert.status === 'expired' ? 'Vencido' : 'Advertencia'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Tasks & Logs */}
          <div className="dashboard-footer-grid">
            <div className="glass-card footer-subpanel">
              <h3>Acciones de Cumplimiento Automáticas</h3>
              <p className="footer-subpanel-desc">
                El sistema programa alertas de vencimiento y construye recordatorios de calendario automáticamente sin configuración manual.
              </p>
              <div className="action-buttons-group">
                <button className="btn btn-primary" onClick={() => onViewChange('intake')}>
                  Subir Nuevo Certificado
                </button>
                <button className="btn btn-secondary" onClick={() => onViewChange('calendar')}>
                  Abrir Calendario de Cumplimiento
                </button>
              </div>
            </div>

            <div className="glass-card footer-subpanel">
              <div className="panel-header">
                <h3>Alertas Recientes Activadas</h3>
                <button onClick={() => onViewChange('notifications')} className="view-all-link">
                  Ver Registro de Auditoría <ArrowUpRight size={16} />
                </button>
              </div>
              {logs.length === 0 ? (
                <p className="no-logs-dash">Aún no se han enviado notificaciones automáticas.</p>
              ) : (
                <div className="recent-logs-list">
                  {logs.slice(0, 3).map(log => (
                    <div key={log.id} className="recent-log-row">
                      <div className="recent-log-title">
                        <Bell size={12} className="recent-log-bell" />
                        <span><strong>{log.employeeName}</strong></span>
                      </div>
                      <span className="recent-log-type">
                        {log.type === 'warning-14day' ? 'Aviso de 2 semanas' : 'Alerta de Vencimiento'}
                      </span>
                      <span className="recent-log-date">
                        {new Date(log.sentAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Details Dialog */}
      <dialog ref={dialogRef} className="cert-dialog-modal" onClose={closeDetails}>
        {selectedCert && (
          <div className="modal-content-wrapper">
            <div className="modal-header">
              <div>
                <h2>{selectedCert.employeeName}</h2>
                <p className="modal-subtitle">ID de Certificado: {selectedCert.id}</p>
              </div>
              <button className="close-modal-btn" onClick={closeDetails} aria-label="Cerrar Modal">
                <X size={24} />
              </button>
            </div>

            <div className={`modal-body-grid ${isEditing ? 'editing-mode' : ''}`}>
              {!isEditing && (
                <div className="modal-document-viewer">
                  {selectedCert.imageType === 'application/pdf' ? (
                    <div className="pdf-viewer-placeholder">
                      <FileText size={100} className="pdf-modal-icon" />
                      <h4>Documento PDF</h4>
                      <p>{selectedCert.imageName}</p>
                      <a href={certImageUrl} download={selectedCert.imageName} className="btn btn-secondary mt-4">
                        Descargar PDF
                      </a>
                    </div>
                  ) : certImageUrl ? (
                    <img src={certImageUrl} alt="Escaneo de Certificado" className="modal-image-display" />
                  ) : (
                    <div className="no-image-placeholder">No se adjuntó ningún archivo de documento.</div>
                  )}
                </div>
              )}

              <div className="modal-metadata-section">
                {isEditing ? (
                  <form onSubmit={saveEdit} className="meta-card form-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: 'none', background: 'transparent', padding: 0 }}>
                    <h3>Editar Información</h3>
                    
                    <div className="form-group">
                      <label className="form-label">Nombre del Empleado *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Departamento</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editDept} 
                        onChange={e => setEditDept(e.target.value)} 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Fecha de Emisión *</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={editIssueDate} 
                        onChange={e => setEditIssueDate(e.target.value)} 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Periodo de Validez *</label>
                      <select 
                        className="form-input" 
                        value={editRule} 
                        onChange={e => setEditRule(e.target.value)}
                      >
                        <option value="1year">1 Año desde la Fecha de Emisión</option>
                        <option value="2years">2 Años desde la Fecha de Emisión</option>
                        <option value="custom">Ingresar fecha de vencimiento exacta</option>
                        <option value="none">Sin vencimiento</option>
                      </select>
                    </div>

                    {editRule === 'custom' && (
                      <div className="form-group">
                        <label className="form-label">Fecha de Vencimiento *</label>
                        <input 
                          type="date" 
                          className="form-input" 
                          value={editExpirationDate} 
                          onChange={e => setEditExpirationDate(e.target.value)} 
                          required 
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Notas</label>
                      <textarea 
                        className="form-input" 
                        value={editNotes} 
                        onChange={e => setEditNotes(e.target.value)} 
                        rows={2} 
                      />
                    </div>

                    <div className="meta-actions">
                      <button type="submit" className="btn btn-primary">Guardar</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <div className="meta-card">
                    <h3>Resumen de Cumplimiento</h3>
                    
                    <div className="meta-detail-row">
                      <span className="meta-label">Estado</span>
                      <span className={`badge badge-${selectedCert.status}`}>
                        {selectedCert.status === 'active' ? 'Activo' : selectedCert.status === 'expiring' ? 'Vence Pronto' : 'Vencido'}
                      </span>
                    </div>

                    <div className="meta-detail-row">
                      <span className="meta-label">Fecha de Emisión</span>
                      <span className="meta-value">{selectedCert.issueDate}</span>
                    </div>

                    <div className="meta-detail-row">
                      <span className="meta-label">Fecha de Vencimiento</span>
                      <span className="meta-value">
                        {selectedCert.expirationDate ? selectedCert.expirationDate : 'Indefinido (Sin Vencimiento)'}
                      </span>
                    </div>

                    <div className="meta-actions" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={startEditing}>
                          Editar
                        </button>
                        {selectedCert.expirationDate && (
                          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => downloadICSFile(selectedCert)}>
                            <Download size={16} /> Exportar (.ics)
                          </button>
                        )}
                      </div>
                      <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => handleDelete(selectedCert.id)}>
                        <Trash2 size={16} /> Eliminar Registro
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </dialog>

      <style>{`
        .dashboard-container {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .loading-state-dash {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 5rem 0;
          color: hsl(var(--text-secondary));
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding: 1.25rem;
        }

        .border-glow-cyan:hover { border-color: hsl(var(--accent-cyan) / 0.5); box-shadow: 0 0 15px hsl(var(--accent-cyan) / 0.08); }
        .border-glow-green:hover { border-color: hsl(var(--status-active) / 0.5); box-shadow: 0 0 15px hsl(var(--status-active) / 0.08); }
        .border-glow-warning:hover { border-color: hsl(var(--status-warning) / 0.5); box-shadow: 0 0 15px hsl(var(--status-warning) / 0.08); }
        .border-glow-danger:hover { border-color: hsl(var(--status-expired) / 0.5); box-shadow: 0 0 15px hsl(var(--status-expired) / 0.08); }

        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-bg-cyan { background-color: hsl(var(--accent-cyan) / 0.15); color: hsl(var(--accent-cyan)); }
        .icon-bg-green { background-color: hsl(var(--status-active) / 0.15); color: hsl(var(--status-active)); }
        .icon-bg-warning { background-color: hsl(var(--status-warning) / 0.15); color: hsl(var(--status-warning)); }
        .icon-bg-danger { background-color: hsl(var(--status-expired) / 0.15); color: hsl(var(--status-expired)); }

        .stat-content {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 0.8rem;
          color: hsl(var(--text-secondary));
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .stat-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: #fff;
          font-family: var(--font-display);
        }

        .text-green { color: hsl(var(--status-active)) !important; }
        .text-warning { color: hsl(var(--status-warning)) !important; }
        .text-danger { color: hsl(var(--status-expired)) !important; }

        .analytics-grid {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .compliance-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          padding: 2rem;
          text-align: center;
        }

        .compliance-panel h3 {
          font-size: 1.15rem;
          color: #fff;
          width: 100%;
          text-align: left;
        }

        .gauge-wrapper {
          position: relative;
          width: 160px;
          height: 160px;
        }

        .radial-gauge {
          width: 100%;
          height: 100%;
        }

        .gauge-bg {
          fill: none;
          stroke: hsl(var(--card-border) / 0.5);
        }

        .gauge-progress {
          fill: none;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.8s ease-in-out;
        }

        .gauge-perfect { stroke: hsl(var(--status-active)); filter: drop-shadow(0 0 8px hsl(var(--status-active) / 0.6)); }
        .gauge-good { stroke: hsl(var(--accent-cyan)); filter: drop-shadow(0 0 8px hsl(var(--accent-cyan) / 0.6)); }
        .gauge-poor { stroke: hsl(var(--status-expired)); filter: drop-shadow(0 0 8px hsl(var(--status-expired) / 0.6)); }

        .gauge-text {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .gauge-percentage {
          font-size: 2rem;
          font-weight: 800;
          font-family: var(--font-display);
          color: #fff;
          line-height: 1;
        }

        .gauge-label {
          font-size: 0.75rem;
          color: hsl(var(--text-secondary));
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 0.2rem;
        }

        .compliance-verdict {
          font-size: 0.9rem;
          font-weight: 500;
        }

        .action-panel {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .panel-header h3 {
          font-size: 1.15rem;
          color: #fff;
        }

        .view-all-link {
          background: transparent;
          border: none;
          color: hsl(var(--accent-cyan));
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          transition: var(--transition-smooth);
        }
        .view-all-link:hover {
          color: #fff;
          transform: translateY(-1px);
        }

        .compliant-shield-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          gap: 0.75rem;
          color: hsl(var(--text-secondary));
          text-align: center;
          padding: 2rem 0;
        }

        .shield-sparkle {
          color: hsl(var(--status-active));
          filter: drop-shadow(0 0 10px hsl(var(--status-active) / 0.4));
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        .urgent-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          overflow-y: auto;
          max-height: 250px;
        }

        .urgent-item {
          background-color: hsl(var(--bg-tertiary) / 0.5);
          border: 1px solid hsl(var(--card-border));
          padding: 0.85rem 1rem;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .urgent-item:hover {
          border-color: hsl(var(--card-border) / 0.8);
          background-color: hsl(var(--card-border) / 0.15);
        }

        .border-left-expired { border-left: 3px solid hsl(var(--status-expired)); }
        .border-left-expiring { border-left: 3px solid hsl(var(--status-warning)); }

        .urgent-name {
          font-weight: 600;
          color: #fff;
          font-size: 0.95rem;
        }

        .urgent-date {
          font-size: 0.8rem;
          color: hsl(var(--text-secondary));
          margin-top: 0.15rem;
        }

        .dashboard-footer-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 1.5rem;
        }

        .footer-subpanel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .footer-subpanel h3 {
          font-size: 1.05rem;
          color: #fff;
        }

        .footer-subpanel-desc {
          font-size: 0.85rem;
          color: hsl(var(--text-secondary));
          line-height: 1.5;
        }

        .action-buttons-group {
          display: flex;
          gap: 1rem;
          margin-top: auto;
        }

        .action-buttons-group .btn {
          flex: 1;
        }

        .no-logs-dash {
          font-size: 0.85rem;
          color: hsl(var(--text-muted));
          padding: 1rem 0;
          text-align: center;
        }

        .recent-logs-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .recent-log-row {
          display: grid;
          grid-template-columns: 1.2fr 1fr 0.8fr;
          font-size: 0.8rem;
          border-bottom: 1px solid hsl(var(--card-border) / 0.4);
          padding-bottom: 0.5rem;
          align-items: center;
        }
        .recent-log-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .recent-log-title {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: #fff;
        }
        
        .recent-log-bell {
          color: hsl(var(--accent-cyan));
        }

        .recent-log-type {
          color: hsl(var(--text-secondary));
        }

        .recent-log-date {
          color: hsl(var(--text-muted));
          text-align: right;
        }

        .modal-body-grid.editing-mode {
          grid-template-columns: 1fr;
          max-width: 500px;
          margin: 0 auto;
          width: 100%;
          height: auto;
          max-height: calc(100vh - 200px);
        }

        @media (max-width: 900px) {
          .analytics-grid {
            grid-template-columns: 1fr;
          }
          .dashboard-footer-grid {
            grid-template-columns: 1fr;
          }
          .action-buttons-group {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
