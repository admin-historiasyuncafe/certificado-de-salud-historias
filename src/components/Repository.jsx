import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Eye, 
  Trash2, 
  FileText, 
  X, 
  User, 
  Clock, 
  AlertTriangle,
  Mail
} from 'lucide-react';
import { getAllCertificates, deleteCertificate, getNotificationLogs, saveCertificate } from '../services/db';
import { downloadICSFile } from '../utils/calendar';

export default function Repository({ refreshTrigger, onRecordDeleted }) {
  const [certificates, setCertificates] = useState([]);
  const [filteredCerts, setFilteredCerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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

  // Modal Dialog reference
  const dialogRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  useEffect(() => {
    filterData();
  }, [certificates, searchQuery, statusFilter]);

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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getAllCertificates();
      const notificationLogs = await getNotificationLogs();
      setCertificates(data);
      setLogs(notificationLogs);
    } catch (err) {
      console.error('Failed to load certificates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterData = () => {
    let result = [...certificates];

    // Search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => c.employeeName.toLowerCase().includes(query));
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    // Sort by expiration date: expired first, then expiring soon, then active, then indefinite
    result.sort((a, b) => {
      if (!a.expirationDate) return 1;
      if (!b.expirationDate) return -1;
      return new Date(a.expirationDate) - new Date(b.expirationDate);
    });

    setFilteredCerts(result);
  };

  const openDetails = (cert) => {
    setSelectedCert(cert);
    // Revoke any previous object URL to avoid memory leaks
    if (certImageUrl && certImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(certImageUrl);
    }
    if (cert.imageBlob) {
      // Local blob (from IndexedDB) — create a temporary URL
      setCertImageUrl(URL.createObjectURL(cert.imageBlob));
    } else if (cert.imageUrl) {
      // Remote URL from Firebase Storage — use directly
      setCertImageUrl(cert.imageUrl);
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
    // Only revoke if it's a blob URL (not a remote https:// URL)
    if (certImageUrl && certImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(certImageUrl);
    }
    setCertImageUrl('');
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
      loadData();
      if (onRecordDeleted) onRecordDeleted();
    } catch (err) {
      alert('Error al guardar los cambios: ' + err.message);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    
    const confirmDelete = window.confirm('¿Está seguro de que desea eliminar este certificado y todos sus registros de cumplimiento?');
    if (!confirmDelete) return;

    try {
      await deleteCertificate(id);
      if (selectedCert && selectedCert.id === id) {
        closeDetails();
      }
      loadData();
      if (onRecordDeleted) onRecordDeleted();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Error al eliminar el certificado: ' + err.message);
    }
  };

  // Helper to filter logs for the selected certificate
  const getCertLogs = (certId) => {
    return logs.filter(log => log.certificateId === certId);
  };

  return (
    <div className="repository-container animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Repositorio de Certificados</h2>
        <p className="view-subtitle">Busque, verifique el cumplimiento, descargue recordatorios y vea los registros de todo el personal.</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card control-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nombre del empleado..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-box">
          <Filter size={18} className="filter-icon" />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos los Estados</option>
            <option value="active">Cumplimiento Activo</option>
            <option value="expiring">Vence Pronto (Advertencia)</option>
            <option value="expired">Vencido (Atención Urgente)</option>
          </select>
        </div>
      </div>

      {/* Repository Listing */}
      {isLoading ? (
        <div className="loading-state-repo">
          <div className="spinner"></div>
          <p>Recuperando registros de la base de datos...</p>
        </div>
      ) : filteredCerts.length === 0 ? (
        <div className="glass-card empty-repo-state">
          <FileText size={64} className="empty-icon" />
          <h3>No se Encontraron Registros</h3>
          <p>Intente ajustar los criterios de búsqueda, las opciones de filtro o suba un nuevo certificado para comenzar el seguimiento.</p>
        </div>
      ) : (
        <div className="certs-grid">
          {filteredCerts.map((cert) => (
            <div 
              key={cert.id} 
              className={`glass-card cert-card cert-border-${cert.status}`}
              onClick={() => openDetails(cert)}
            >
              <div className="cert-card-header">
                <div>
                  <h3 className="cert-emp-name">{cert.employeeName}</h3>
                  <span className="cert-id-tag">ID: {cert.id}</span>
                </div>
                <span className={`badge badge-${cert.status}`}>
                  {cert.status === 'active' ? 'Activo' : cert.status === 'expiring' ? 'Vence Pronto' : 'Vencido'}
                </span>
              </div>

              <div className="cert-card-body">
                <div className="cert-info-row">
                  <Calendar size={15} className="row-icon" />
                  <span>Fecha de Emisión: <strong>{cert.issueDate}</strong></span>
                </div>
                <div className="cert-info-row">
                  <Clock size={15} className="row-icon" />
                  <span>
                    Vence:{' '}
                    <strong>
                      {cert.expirationDate ? cert.expirationDate : 'Indefinido'}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="cert-card-actions" onClick={(e) => e.stopPropagation()}>
                <button 
                  className="icon-btn" 
                  onClick={() => openDetails(cert)} 
                  title="Ver Detalles del Documento"
                >
                  <Eye size={16} />
                </button>
                {cert.expirationDate && (
                  <button 
                    className="icon-btn" 
                    onClick={() => downloadICSFile(cert)} 
                    title="Exportar Sincronización de Calendario (.ics)"
                  >
                    <Download size={16} />
                  </button>
                )}
                <button 
                  className="icon-btn btn-danger-text" 
                  onClick={(e) => handleDelete(cert.id, e)} 
                  title="Eliminar Certificado"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Dialog (Native Overlay Modal) */}
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
              {/* Left Column: Image Display */}
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
                    <img src={certImageUrl} alt="Escaneo del documento del certificado" className="modal-image-display" />
                  ) : (
                    <div className="no-image-placeholder">No se adjuntó ningún archivo de documento.</div>
                  )}
                </div>
              )}

              {/* Right Column: Metadata details & Log logs */}
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
                  <>
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
                          {selectedCert.expirationDate ? selectedCert.expirationDate : 'Indefinido'}
                        </span>
                      </div>

                      <div className="meta-detail-row">
                        <span className="meta-label">Regla de Validez</span>
                        <span className="meta-value">
                          {selectedCert.businessRule === '1year' ? 'Expiración a 1 Año' : 
                           selectedCert.businessRule === '2years' ? 'Expiración a 2 Años' : 
                           selectedCert.businessRule === 'none' ? 'Validez Indefinida' : 'Fecha de Vencimiento Personalizada'}
                        </span>
                      </div>

                      <div className="meta-detail-row">
                        <span className="meta-label">Fecha de Registro</span>
                        <span className="meta-value">
                          {new Date(selectedCert.uploadedAt).toLocaleString()}
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

                    <div className="meta-card alert-history">
                      <h3>Auditoría de Alertas Automáticas</h3>
                      {getCertLogs(selectedCert.id).length === 0 ? (
                        <p className="no-alerts-text">Aún no se han programado ni enviado alertas automáticas.</p>
                      ) : (
                        <ul className="alert-list-trail">
                          {getCertLogs(selectedCert.id).map(log => (
                            <li key={log.id} className="alert-trail-item">
                              <div className="alert-item-header">
                                <span className="alert-type">
                                  <Mail size={12} className="alert-mail-icon" />
                                  {log.type === 'warning-14day' ? 'Correo de Aviso (2 semanas)' : 'Correo de Alerta de Vencimiento'}
                                </span>
                                <span className="alert-timestamp">{new Date(log.sentAt).toLocaleDateString()}</span>
                              </div>
                              <p className="alert-details-desc">
                                Enviado auto. a: <strong>{log.recipient}</strong>. Estado: <span className="green-text">Enviado</span>
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </dialog>

      <style>{`
        .repository-container {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .control-bar {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 2rem;
          padding: 1rem 1.5rem;
          align-items: center;
        }

        .search-box {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          color: hsl(var(--text-muted));
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          background: hsl(var(--bg-tertiary) / 0.8);
          border: 1px solid hsl(var(--card-border));
          border-radius: 10px;
          padding: 0.75rem 1rem 0.75rem 2.75rem;
          color: #fff;
          font-family: var(--font-sans);
          font-size: 0.95rem;
          transition: var(--transition-smooth);
        }
        .search-input:focus {
          border-color: hsl(var(--accent-cyan));
          outline: none;
          box-shadow: 0 0 0 3px hsl(var(--accent-cyan) / 0.15);
        }

        .filter-box {
          position: relative;
          display: flex;
          align-items: center;
          width: 250px;
        }

        .filter-icon {
          position: absolute;
          left: 1rem;
          color: hsl(var(--text-muted));
          pointer-events: none;
        }

        .filter-select {
          width: 100%;
          background: hsl(var(--bg-tertiary) / 0.8);
          border: 1px solid hsl(var(--card-border));
          border-radius: 10px;
          padding: 0.75rem 1rem 0.75rem 2.5rem;
          color: #fff;
          font-family: var(--font-sans);
          font-size: 0.95rem;
          cursor: pointer;
          transition: var(--transition-smooth);
          appearance: none;
          -webkit-appearance: none;
        }
        .filter-select:focus {
          border-color: hsl(var(--accent-cyan));
          outline: none;
        }

        .loading-state-repo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 5rem 0;
          color: hsl(var(--text-secondary));
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid hsl(var(--card-border));
          border-top-color: hsl(var(--accent-cyan));
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .empty-repo-state {
          text-align: center;
          padding: 5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .certs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .cert-card {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          position: relative;
          overflow: hidden;
        }

        .cert-border-active::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 3px;
          background: hsl(var(--status-active));
        }
        .cert-border-expiring::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 3px;
          background: hsl(var(--status-warning));
        }
        .cert-border-expired::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 3px;
          background: hsl(var(--status-expired));
        }

        .cert-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .cert-emp-name {
          font-size: 1.15rem;
          font-weight: 700;
          color: #fff;
          line-height: 1.2;
        }

        .cert-id-tag {
          font-size: 0.75rem;
          color: hsl(var(--text-muted));
          display: block;
          margin-top: 0.2rem;
        }

        .cert-card-body {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          border-top: 1px solid hsl(var(--card-border));
          padding-top: 0.85rem;
        }

        .cert-info-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.85rem;
          color: hsl(var(--text-secondary));
        }

        .row-icon {
          color: hsl(var(--text-muted));
        }

        .cert-card-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: auto;
          border-top: 1px solid hsl(var(--card-border));
          padding-top: 0.75rem;
        }

        .icon-btn {
          background: hsl(var(--bg-tertiary));
          border: 1px solid hsl(var(--card-border));
          color: hsl(var(--text-secondary));
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .icon-btn:hover {
          color: #fff;
          border-color: hsl(var(--accent-cyan));
          background: hsl(var(--accent-cyan) / 0.1);
        }
        .icon-btn.btn-danger-text:hover {
          color: hsl(var(--status-expired));
          border-color: hsl(var(--status-expired));
          background: hsl(var(--status-expired) / 0.1);
        }

        .green-text {
          color: hsl(var(--status-active));
          font-weight: 600;
        }

        .mt-4 {
          margin-top: 1rem;
        }

        @media (max-width: 768px) {
          .control-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .filter-box {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
