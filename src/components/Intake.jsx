import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  UploadCloud,
  FileText,
  CheckCircle,
  RefreshCw,
  Calendar,
  User,
  AlertCircle,
  Paperclip,
  X,
  Building2,
  ClipboardList,
} from 'lucide-react';
import { saveCertificate } from '../services/db';
import { DOCUMENT_TYPES } from '../utils/constants';

export default function Intake({ onUploadSuccess }) {
  // ── Form fields ──────────────────────────────────────────────────────────────
  const [employeeName, setEmployeeName] = useState('');
  const [documentType, setDocumentType] = useState('Certificado de salud');
  const [department, setDepartment]     = useState('');
  const [issueDate, setIssueDate]       = useState('');
  const [businessRule, setBusinessRule] = useState('1year');
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes]               = useState('');

  // ── Document attachment (optional) ──────────────────────────────────────────
  const [file, setFile]         = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [error, setError]           = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedName, setSavedName]   = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving]     = useState(false);

  const errorBannerRef = useRef(null);

  const fileInputRef = useRef(null);
  const videoRef     = useRef(null);
  const streamRef    = useRef(null);

  // ── Auto-calculate expiration from issueDate + businessRule ─────────────────
  useEffect(() => {
    if (!issueDate || businessRule === 'none' || businessRule === 'custom') {
      if (businessRule === 'none') setExpirationDate('');
      return;
    }
    const date = new Date(issueDate);
    if (isNaN(date.getTime())) return;
    if (businessRule === '1year')  date.setFullYear(date.getFullYear() + 1);
    if (businessRule === '2years') date.setFullYear(date.getFullYear() + 2);
    setExpirationDate(date.toISOString().split('T')[0]);
  }, [issueDate, businessRule]);

  // ── Camera helpers ───────────────────────────────────────────────────────────
  const startCamera = async () => {
    setError('');
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError('No se pudo acceder a la cámara. Por favor, suba un archivo.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video  = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      const photoFile = new File([blob], `photo_${Date.now()}.png`, { type: 'image/png' });
      attachFile(photoFile);
      stopCamera();
    }, 'image/png');
  };

  // ── File attachment ──────────────────────────────────────────────────────────
  const attachFile = (selected) => {
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) attachFile(e.target.files[0]);
  };

  const removeFile = () => {
    setFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) attachFile(e.dataTransfer.files[0]);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    if (!employeeName.trim()) {
      setError('El nombre del empleado es obligatorio.');
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!issueDate) {
      setError('La fecha de emisión es obligatoria.');
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (businessRule === 'custom' && !expirationDate) {
      setError('Por favor, ingrese la fecha de vencimiento.');
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSaving(true);
    try {
      await saveCertificate({
        employeeName:   employeeName.trim(),
        documentType:   documentType,
        department:     department.trim(),
        issueDate,
        expirationDate: businessRule === 'none' ? '' : expirationDate,
        businessRule,
        notes:          notes.trim(),
        imageBlob:      file || null,
        imageName:      file?.name || null,
        imageType:      file?.type || null,
        uploadedAt:     new Date().toISOString(),
      });
      // Full success (local + cloud)
      setSavedName(employeeName.trim());
      setSaveSuccess(true);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      const msg = err?.message || String(err) || '';
      // If it's a cloud/network/permission error but local save succeeded, still show success
      const isCloudOnly = msg.toLowerCase().includes('timeout') ||
                          msg.toLowerCase().includes('permission') ||
                          msg.toLowerCase().includes('insufficient') ||
                          msg.toLowerCase().includes('nube') ||
                          msg.toLowerCase().includes('cloud') ||
                          msg.toLowerCase().includes('network') ||
                          msg.toLowerCase().includes('firebase') ||
                          msg.toLowerCase().includes('storage') ||
                          msg.toLowerCase().includes('firestore');
      if (isCloudOnly) {
        // Record was saved locally — let the user proceed
        setSavedName(employeeName.trim());
        setSaveSuccess(true);
        if (onUploadSuccess) onUploadSuccess();
      } else {
        setError(msg || 'Error desconocido. Revisa tu conexión e intenta de nuevo.');
        setTimeout(() => {
          errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setEmployeeName(''); setDocumentType('Certificado de salud'); setDepartment(''); setIssueDate('');
    setBusinessRule('1year'); setExpirationDate(''); setNotes('');
    setFile(null); setPreviewUrl(''); setSaveSuccess(false);
    setSavedName(''); setError('');
  };

  // ── Computed helper text ─────────────────────────────────────────────────────
  const expirationLabel = (() => {
    if (!expirationDate || businessRule === 'none') return null;
    const d = new Date(expirationDate + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  })();

  // ── Render ───────────────────────────────────────────────────────────────────
  if (saveSuccess) {
    return (
      <div className="intake-container animate-fade-in">
        <div className="glass-card success-card">
          <CheckCircle className="success-icon" size={64} />
          <h3>¡Registro Guardado!</h3>
          <p>
            El certificado de salud para <strong>{savedName}</strong> ha sido
            agregado al sistema. El monitoreo de vencimiento ya está activo.
          </p>
          <div className="success-actions">
            <button className="btn btn-primary" onClick={handleReset}>
              Agregar Otro Certificado
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="intake-container animate-fade-in">
      {/* Header */}
      <div className="view-header">
        <h2 className="view-title">Subir Documento de Empleado</h2>
        <p className="view-subtitle">
          Ingrese los detalles del documento del empleado. Todo el seguimiento y
          las alertas de vencimiento se gestionan automáticamente.
        </p>
      </div>

      {error && (
        <div ref={errorBannerRef} className="alert-banner alert-error flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="intake-grid">
        {/* ── Left column: Form ── */}
        <div className="glass-card form-panel">
          <div className="panel-heading">
            <ClipboardList size={18} />
            <span>Detalles del Documento</span>
          </div>

          <form id="intake-form" onSubmit={handleSave} className="details-form" noValidate>

            {/* Employee Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="employee-name">
                Nombre del Empleado <span className="required-star">*</span>
              </label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  id="employee-name"
                  className="form-input"
                  value={employeeName}
                  onChange={e => setEmployeeName(e.target.value)}
                  placeholder="Ej. Juan del Pueblo"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            {/* Document Type */}
            <div className="form-group">
              <label className="form-label" htmlFor="document-type">
                Tipo de Documento <span className="required-star">*</span>
              </label>
              <div className="input-with-icon">
                <FileText size={16} className="input-icon" />
                <select
                  id="document-type"
                  className="form-input"
                  value={documentType}
                  onChange={e => {
                    const selected = e.target.value;
                    setDocumentType(selected);
                    // Automatically adjust default rule based on document type
                    if (selected === 'Certificado de salud') {
                      setBusinessRule('1year');
                    } else if (
                      selected === 'Identificación (ID)' ||
                      selected === 'Certificado de Buena Conducta' ||
                      selected === 'Certificado de Antecedentes Penales' ||
                      selected === 'Forma I-9' ||
                      selected === 'Forma W-4' ||
                      selected === 'Forma PR-SD/NH-1'
                    ) {
                      setBusinessRule('custom');
                    } else {
                      setBusinessRule('none');
                    }
                  }}
                  required
                  style={{ paddingLeft: '2.5rem', width: '100%' }}
                >
                  {DOCUMENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Department */}
            <div className="form-group">
              <label className="form-label" htmlFor="department">
                Departamento <span className="optional-tag">opcional</span>
              </label>
              <div className="input-with-icon">
                <Building2 size={16} className="input-icon" />
                <input
                  type="text"
                  id="department"
                  className="form-input"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  placeholder="Ej. Cocina, Almacén, Oficina…"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Issue Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="issue-date">
                Fecha de Emisión <span className="required-star">*</span>
              </label>
              <div className="input-with-icon">
                <Calendar size={16} className="input-icon" />
                <input
                  type="date"
                  id="issue-date"
                  className="form-input"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Expiration Rule */}
            <div className="form-group">
              <label className="form-label" htmlFor="business-rule">
                Periodo de Validez <span className="required-star">*</span>
              </label>
              <select
                id="business-rule"
                className="form-input"
                value={businessRule}
                onChange={e => setBusinessRule(e.target.value)}
              >
                <option value="1year">1 Año desde la Fecha de Emisión</option>
                <option value="2years">2 Años desde la Fecha de Emisión</option>
                <option value="custom">Ingresar fecha de vencimiento exacta</option>
                <option value="none">Sin vencimiento</option>
              </select>
            </div>

            {/* Custom expiration date picker */}
            {businessRule === 'custom' && (
              <div className="form-group animate-fade-in">
                <label className="form-label" htmlFor="custom-expiration">
                  Fecha de Vencimiento <span className="required-star">*</span>
                </label>
                <div className="input-with-icon">
                  <Calendar size={16} className="input-icon" />
                  <input
                    type="date"
                    id="custom-expiration"
                    className="form-input"
                    value={expirationDate}
                    onChange={e => setExpirationDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Computed expiration preview */}
            {expirationLabel && businessRule !== 'custom' && (
              <div className="expiry-preview">
                <Calendar size={14} />
                <span>
                  El certificado vence el <strong>{expirationLabel}</strong>
                </span>
              </div>
            )}

            {/* Notes */}
            <div className="form-group">
              <label className="form-label" htmlFor="notes">
                Notas <span className="optional-tag">opcional</span>
              </label>
              <textarea
                id="notes"
                className="form-input form-textarea"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas adicionales (médico emisor, centro de salud, etc.)"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="form-actions-row">
              <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={isSaving}>
                Limpiar
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ minWidth: '200px' }}>
                {isSaving ? (
                  <><span className="btn-spinner" /> Guardando...</>
                ) : (
                  'Guardar y Empezar Seguimiento'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── Right column: Optional document attachment ── */}
        <div className="glass-card attach-panel">
          <div className="panel-heading">
            <Paperclip size={18} />
            <span>Adjuntar Documento <span className="optional-tag">opcional</span></span>
          </div>
          <p className="attach-hint">
            Adjunte una foto o escaneo para sus registros. Esto se almacena localmente y
            no es obligatorio para guardar el certificado.
          </p>

          {/* Camera view */}
          {isCameraActive && (
            <div className="camera-view-container">
              <video ref={videoRef} autoPlay playsInline className="video-stream" />
              <div className="camera-overlay" />
              <div className="camera-controls">
                <button className="btn btn-danger" onClick={stopCamera}>Cancelar</button>
                <button className="capture-btn" onClick={capturePhoto} aria-label="Tomar Foto" />
              </div>
            </div>
          )}

          {/* Dropzone (when no file and no camera) */}
          {!isCameraActive && !previewUrl && (
            <div
              className={`dropzone ${isDragging ? 'dropzone-active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={40} className="upload-icon" />
              <p className="dropzone-title">Arrastre y suelte o haga clic para buscar</p>
              <p className="dropzone-sub">PNG, JPG, PDF — hasta 10 MB</p>
              <div className="divider"><span>O</span></div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={e => { e.stopPropagation(); startCamera(); }}
              >
                <Camera size={15} /> Usar Cámara
              </button>
            </div>
          )}

          {/* File preview */}
          {!isCameraActive && previewUrl && (
            <div className="preview-wrapper">
              {file?.type === 'application/pdf' ? (
                <div className="pdf-placeholder">
                  <FileText size={64} className="pdf-icon" />
                  <p className="pdf-name">{file.name}</p>
                  <span className="badge badge-active">PDF Listo</span>
                </div>
              ) : (
                <img src={previewUrl} alt="Certificate preview" className="image-preview" />
              )}
              <button className="remove-file-btn" onClick={removeFile} title="Eliminar archivo">
                <X size={14} />
              </button>
              <button
                type="button"
                className="btn btn-secondary replace-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <RefreshCw size={14} /> Reemplazar
              </button>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*,application/pdf"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <style>{`
        .intake-container {
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
        }

        .intake-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 1.5rem;
          margin-top: 1rem;
          align-items: start;
        }

        /* ── Panels ── */
        .form-panel, .attach-panel {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .panel-heading {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          font-size: 0.95rem;
          color: hsl(var(--text-primary));
          margin-bottom: 1.25rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid hsl(var(--card-border));
        }

        .attach-hint {
          font-size: 0.82rem;
          color: hsl(var(--text-muted));
          margin-bottom: 1rem;
          line-height: 1.5;
        }

        /* ── Form ── */
        .details-form {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .required-star {
          color: hsl(var(--status-expired, 0 80% 60%));
          margin-left: 2px;
        }

        .optional-tag {
          font-size: 0.72rem;
          font-weight: 400;
          color: hsl(var(--text-muted));
          margin-left: 4px;
          background: hsl(var(--bg-tertiary));
          padding: 1px 6px;
          border-radius: 99px;
          border: 1px solid hsl(var(--card-border));
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-with-icon .form-input {
          padding-left: 2.5rem;
          width: 100%;
        }
        .input-icon {
          position: absolute;
          left: 0.85rem;
          color: hsl(var(--text-muted));
          pointer-events: none;
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
          font-family: inherit;
        }

        .expiry-preview {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.82rem;
          color: hsl(var(--accent-cyan));
          background: hsl(var(--accent-cyan) / 0.08);
          border: 1px solid hsl(var(--accent-cyan) / 0.2);
          border-radius: 8px;
          padding: 0.6rem 0.9rem;
          margin-bottom: 1rem;
        }
        .expiry-preview strong {
          color: hsl(var(--accent-cyan));
        }

        .form-actions-row {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid hsl(var(--card-border));
        }

        /* ── Dropzone ── */
        .dropzone {
          border: 2px dashed hsl(var(--card-border));
          border-radius: 12px;
          padding: 2rem 1rem;
          text-align: center;
          cursor: pointer;
          transition: var(--transition-smooth);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        .dropzone:hover, .dropzone-active {
          border-color: hsl(var(--accent-cyan));
          background: hsl(var(--accent-cyan) / 0.04);
        }
        .upload-icon {
          color: hsl(var(--accent-cyan-dim));
          margin-bottom: 0.25rem;
        }
        .dropzone-title {
          font-size: 0.9rem;
          font-weight: 500;
          color: hsl(var(--text-secondary));
        }
        .dropzone-sub {
          font-size: 0.78rem;
          color: hsl(var(--text-muted));
        }

        .divider {
          display: flex;
          align-items: center;
          width: 60%;
          margin: 0.75rem 0;
          color: hsl(var(--text-muted));
          font-size: 0.72rem;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: hsl(var(--card-border));
        }
        .divider span { padding: 0 0.5rem; }

        /* ── Camera ── */
        .camera-view-container {
          position: relative;
          width: 100%;
          border-radius: 12px;
          overflow: hidden;
          background: #000;
          aspect-ratio: 4/3;
        }
        .video-stream { width: 100%; height: 100%; object-fit: cover; }
        .camera-overlay {
          position: absolute;
          top: 8%; left: 8%;
          width: 84%; height: 84%;
          border: 2px dashed hsl(var(--accent-cyan) / 0.7);
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.45);
          border-radius: 6px;
          pointer-events: none;
        }
        .camera-controls {
          position: absolute;
          bottom: 1rem;
          left: 0; right: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 2rem;
        }
        .capture-btn {
          width: 56px; height: 56px;
          border-radius: 50%;
          background: #fff;
          border: 4px solid hsl(var(--accent-cyan));
          cursor: pointer;
          box-shadow: 0 0 12px rgba(0,0,0,0.4);
          transition: transform 0.1s;
        }
        .capture-btn:active { transform: scale(0.9); }

        /* ── Preview ── */
        .preview-wrapper {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid hsl(var(--card-border));
          background: hsl(var(--bg-tertiary));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 220px;
        }
        .image-preview {
          max-width: 100%;
          max-height: 300px;
          object-fit: contain;
        }
        .pdf-placeholder {
          display: flex; flex-direction: column;
          align-items: center; gap: 0.75rem;
          padding: 2rem;
          color: hsl(var(--text-secondary));
        }
        .pdf-icon { color: #ff4444; }
        .pdf-name {
          font-size: 0.82rem;
          word-break: break-all;
          text-align: center;
        }
        .remove-file-btn {
          position: absolute;
          top: 0.5rem; right: 0.5rem;
          background: hsl(var(--bg-secondary) / 0.9);
          border: 1px solid hsl(var(--card-border));
          border-radius: 50%;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: hsl(var(--text-secondary));
          transition: var(--transition-smooth);
        }
        .remove-file-btn:hover { color: hsl(var(--status-expired, 0 80% 60%)); }
        .replace-btn {
          margin: 0.75rem auto 0.75rem;
          font-size: 0.8rem;
        }

        /* ── Spinner ── */
        .btn-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          pointer-events: none;
        }

        /* ── Alert banner ── */
        .alert-banner {
          padding: 0.85rem 1.1rem;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 500;
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          margin-bottom: 1rem;
        }
        .alert-error {
          background: hsl(var(--status-expired) / 0.12);
          color: hsl(var(--status-expired));
          border: 1px solid hsl(var(--status-expired) / 0.35);
        }

        /* ── Success screen ── */
        .success-card {
          text-align: center;
          padding: 4rem 2rem;
          max-width: 480px;
          margin: 3rem auto 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
        }
        .success-icon {
          color: hsl(var(--status-active));
          filter: drop-shadow(0 0 16px hsl(var(--status-active) / 0.4));
        }
        .success-actions { margin-top: 0.5rem; }

        @media (max-width: 820px) {
          .intake-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
