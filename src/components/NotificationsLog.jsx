import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Search, 
  Mail, 
  Calendar, 
  Eye, 
  Trash2, 
  X,
  FileText,
  Download
} from 'lucide-react';
import { getNotificationLogs, getCertificateById, deleteCertificate } from '../services/db';
import { downloadICSFile } from '../utils/calendar';

export default function NotificationsLog({ refreshTrigger }) {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [selectedCert, setSelectedCert] = useState(null);
  const [certImageUrl, setCertImageUrl] = useState('');
  const dialogRef = useRef(null);

  useEffect(() => {
    loadLogs();
  }, [refreshTrigger]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredLogs(logs);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredLogs(logs.filter(l => l.employeeName.toLowerCase().includes(q)));
    }
  }, [searchQuery, logs]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const notificationLogs = await getNotificationLogs();
      setLogs(notificationLogs);
      setFilteredLogs(notificationLogs);
    } catch (err) {
      console.error('Failed to load notification logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const viewCertificate = async (certId) => {
    try {
      const cert = await getCertificateById(certId);
      if (cert) {
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
      } else {
        alert('Archivo de certificado no encontrado (podría haber sido eliminado).');
      }
    } catch (err) {
      console.error(err);
      alert('Error al cargar el certificado.');
    }
  };

  const closeDetails = () => {
    if (dialogRef.current) {
      dialogRef.current.close();
    }
    setSelectedCert(null);
    if (certImageUrl) {
      URL.revokeObjectURL(certImageUrl);
      setCertImageUrl('');
    }
  };

  const handleDeleteCert = async (id) => {
    const confirm = window.confirm('¿Está seguro de que desea eliminar este registro de certificado?');
    if (!confirm) return;
    try {
      await deleteCertificate(id);
      closeDetails();
      loadLogs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="logs-container animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Historial de Notificaciones</h2>
        <p className="view-subtitle">Registro de las notificaciones de cumplimiento enviadas por correo electrónico.</p>
      </div>

      {/* Control Bar */}
      <div className="glass-card control-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Filtrar por nombre de empleado..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="loading-state-logs">
          <div className="spinner"></div>
          <p>Cargando el registro de auditoría...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="glass-card empty-logs-state">
          <Bell size={64} className="empty-icon" />
          <h3>No se Enviaron Notificaciones</h3>
          <p>Las notificaciones se generan automáticamente cuando los certificados se acercan a su fecha de vencimiento.</p>
        </div>
      ) : (
        <div className="glass-card table-card">
          <div className="table-responsive">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Tipo de Notificación</th>
                  <th>Destinatario</th>
                  <th>Fecha de Envío</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th className="actions-header">Acceso al Archivo</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="emp-name-cell">{log.employeeName}</span>
                    </td>
                    <td>
                      <div className="notif-type-cell">
                        <Mail size={14} className="cell-icon" />
                        <span>
                          {log.type === 'warning-14day' ? 'Aviso de 2 semanas' : 'Alerta de Vencimiento'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <code className="email-badge">{log.recipient}</code>
                    </td>
                    <td>
                      {new Date(log.sentAt).toLocaleString()}
                    </td>
                    <td>
                      {log.expirationDate || 'Indefinido'}
                    </td>
                    <td>
                      <span className="status-indicator-sent">Enviado</span>
                    </td>
                    <td className="actions-cell">
                      <button 
                        className="btn btn-secondary py-1 px-3 btn-small"
                        onClick={() => viewCertificate(log.certificateId)}
                      >
                        <Eye size={14} /> Ver Doc
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      <dialog ref={dialogRef} className="cert-dialog-modal glass-card" onClose={closeDetails}>
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

            <div className="modal-body-grid">
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
                  <img src={certImageUrl} alt="Escaneo del Certificado" className="modal-image-display" />
                ) : (
                  <div className="no-image-placeholder">No se adjuntó ningún archivo de documento.</div>
                )}
              </div>

              <div className="modal-metadata-section">
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

                  <div className="meta-actions">
                    {selectedCert.expirationDate && (
                      <button className="btn btn-primary" onClick={() => downloadICSFile(selectedCert)}>
                        <Download size={16} /> Exportar Recordatorio (.ics)
                      </button>
                    )}
                    <button className="btn btn-danger" onClick={() => handleDeleteCert(selectedCert.id)}>
                      <Trash2 size={16} /> Eliminar Registro
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </dialog>

      <style>{`
        .logs-container {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .loading-state-logs {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 5rem 0;
          color: hsl(var(--text-secondary));
        }

        .empty-logs-state {
          text-align: center;
          padding: 5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .table-card {
          padding: 0;
          overflow: hidden;
        }

        .table-responsive {
          overflow-x: auto;
          width: 100%;
        }

        .audit-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.9rem;
        }

        .audit-table th {
          background-color: hsl(var(--bg-tertiary) / 0.7);
          color: hsl(var(--text-secondary));
          font-weight: 600;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid hsl(var(--card-border));
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }

        .audit-table td {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid hsl(var(--card-border) / 0.5);
          color: hsl(var(--text-secondary));
        }

        .audit-table tbody tr:hover td {
          background-color: hsl(var(--card-border) / 0.15);
          color: #fff;
        }

        .emp-name-cell {
          font-weight: 600;
          color: #fff;
        }

        .notif-type-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .cell-icon {
          color: hsl(var(--accent-cyan));
        }

        .email-badge {
          background-color: hsl(var(--bg-primary));
          border: 1px solid hsl(var(--card-border));
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          font-size: 0.8rem;
          color: hsl(var(--text-primary));
        }

        .status-indicator-sent {
          background-color: hsl(var(--status-active) / 0.15);
          color: hsl(var(--status-active));
          border: 1px solid hsl(var(--status-active) / 0.3);
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .actions-header {
          text-align: right;
        }

        .actions-cell {
          display: flex;
          justify-content: flex-end;
        }

        .btn-small {
          font-size: 0.8rem;
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
        }
      `}</style>
    </div>
  );
}
