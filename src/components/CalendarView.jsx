import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  X, 
  Trash2, 
  Eye, 
  Download,
  FileText
} from 'lucide-react';
import { getAllCertificates, deleteCertificate, getNotificationLogs, saveCertificate } from '../services/db';
import { downloadICSFile } from '../utils/calendar';

export default function CalendarView({ refreshTrigger, onRecordDeleted }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [certificates, setCertificates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [certImageUrl, setCertImageUrl] = useState('');
  
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
    loadData();
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

  const loadData = async () => {
    try {
      const data = await getAllCertificates();
      const notificationLogs = await getNotificationLogs();
      setCertificates(data);
      setLogs(notificationLogs);
    } catch (err) {
      console.error('Failed to load certificates for calendar:', err);
    }
  };

  // Calendar Math Helpers
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay(); // 0 is Sunday, 1 is Monday etc
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const setToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar grid array
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayIndex = getFirstDayOfMonth(currentDate);
    const calendarDays = [];

    // Padding for previous month's empty slots
    for (let i = 0; i < firstDayIndex; i++) {
      calendarDays.push({ day: null, dateStr: null });
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(i).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      calendarDays.push({ day: i, dateStr });
    }

    return calendarDays;
  };

  // Check events for a specific date string (YYYY-MM-DD)
  const getEventsForDate = (dateStr) => {
    if (!dateStr) return [];
    
    const events = [];

    certificates.forEach(cert => {
      if (!cert.expirationDate) return;

      // 1. Expiration Event
      if (cert.expirationDate === dateStr) {
        events.push({
          type: 'expiration',
          title: `☠️ Vencido: ${cert.employeeName}`,
          cert: cert
        });
      }

      // 2. 14-Day Warning Event (2 weeks before expiration)
      const expDateObj = new Date(cert.expirationDate);
      expDateObj.setDate(expDateObj.getDate() - 14);
      const warningDateStr = expDateObj.toISOString().split('T')[0];

      if (warningDateStr === dateStr) {
        events.push({
          type: 'warning',
          title: `⚠️ Renovación: ${cert.employeeName}`,
          cert: cert
        });
      }
    });

    return events;
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
      loadData();
      if (onRecordDeleted) onRecordDeleted();
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
      loadData();
      if (onRecordDeleted) onRecordDeleted();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar');
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const weekdayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="calendar-view-container animate-fade-in">
      <div className="view-header flex-header">
        <div>
          <h2 className="view-title">Calendario de Cumplimiento</h2>
          <p className="view-subtitle">Monitoree notificaciones programadas y plazos de vencimiento de certificados.</p>
        </div>

        <div className="calendar-controls-bar">
          <button className="btn btn-secondary py-1 px-3" onClick={prevMonth}>
            <ChevronLeft size={16} />
          </button>
          <span className="current-month-label">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button className="btn btn-secondary py-1 px-3" onClick={nextMonth}>
            <ChevronRight size={16} />
          </button>
          <button className="btn btn-primary py-1 px-3" onClick={setToday}>
            Hoy
          </button>
        </div>
      </div>

      {/* Monthly Grid */}
      <div className="glass-card calendar-card">
        <div className="calendar-grid-header">
          {weekdayNames.map(name => (
            <div key={name} className="weekday-name-label">{name}</div>
          ))}
        </div>

        <div className="calendar-grid-body">
          {generateCalendarDays().map((slot, index) => {
            const isToday = slot.dateStr === new Date().toISOString().split('T')[0];
            const dateEvents = getEventsForDate(slot.dateStr);

            return (
              <div 
                key={index} 
                className={`calendar-day-slot ${slot.day ? 'filled-slot' : 'empty-slot'} ${isToday ? 'today-slot' : ''}`}
              >
                {slot.day && (
                  <div className="day-number-wrapper">
                    <span className="day-number-label">{slot.day}</span>
                  </div>
                )}

                {slot.day && dateEvents.length > 0 && (
                  <div className="day-events-list">
                    {dateEvents.map((evt, idx) => (
                      <button
                        key={idx}
                        onClick={() => openDetails(evt.cert)}
                        className={`calendar-event-badge event-type-${evt.type}`}
                        title={evt.title}
                      >
                        {evt.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Details Dialog overlay (same dialog as Repository, modal reuse) */}
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
                        {selectedCert.expirationDate ? selectedCert.expirationDate : 'Indefinido'}
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
        .calendar-view-container {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .flex-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          gap: 1.5rem;
        }

        .calendar-controls-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .current-month-label {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
          min-width: 160px;
          text-align: center;
        }

        .calendar-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
        }

        .calendar-grid-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          border-bottom: 1px solid hsl(var(--card-border));
          padding-bottom: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .weekday-name-label {
          font-weight: 600;
          color: hsl(var(--text-secondary));
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }

        .calendar-grid-body {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          grid-auto-rows: minmax(90px, 1fr);
          gap: 0.25rem;
        }

        .calendar-day-slot {
          background: hsl(var(--bg-tertiary) / 0.3);
          border: 1px solid hsl(var(--card-border) / 0.5);
          border-radius: 8px;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          transition: var(--transition-smooth);
        }
        
        .filled-slot:hover {
          background: hsl(var(--bg-tertiary) / 0.6);
          border-color: hsl(var(--card-border));
        }

        .empty-slot {
          opacity: 0.15;
          pointer-events: none;
        }

        .today-slot {
          background: hsl(var(--accent-cyan) / 0.04);
          border-color: hsl(var(--accent-cyan) / 0.4);
        }

        .day-number-wrapper {
          display: flex;
          justify-content: flex-end;
        }

        .day-number-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: hsl(var(--text-secondary));
        }
        
        .today-slot .day-number-label {
          color: hsl(var(--accent-cyan));
          background: hsl(var(--accent-cyan) / 0.15);
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
        }

        .day-events-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          overflow: hidden;
        }

        .calendar-event-badge {
          border: none;
          text-align: left;
          font-family: var(--font-sans);
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          cursor: pointer;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          transition: var(--transition-smooth);
        }
        .calendar-event-badge:hover {
          filter: brightness(1.15);
          transform: translateX(1px);
        }

        .event-type-expiration {
          background-color: hsl(var(--status-expired) / 0.15);
          color: hsl(var(--status-expired));
          border-left: 2px solid hsl(var(--status-expired));
        }

        .event-type-warning {
          background-color: hsl(var(--status-warning) / 0.15);
          color: hsl(var(--status-warning));
          border-left: 2px solid hsl(var(--status-warning));
        }

        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
        .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }

        @media (max-width: 768px) {
          .flex-header {
            flex-direction: column;
            align-items: stretch;
          }
          .calendar-controls-bar {
            justify-content: space-between;
          }
          .calendar-grid-body {
            grid-auto-rows: minmax(70px, 1fr);
          }
          .calendar-event-badge {
            font-size: 0.6rem;
            padding: 0.15rem 0.25rem;
          }
        }
      `}</style>
    </div>
  );
}
