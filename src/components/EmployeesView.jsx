import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  Plus, 
  Eye, 
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Award,
  X
} from 'lucide-react';
import { getAllCertificates } from '../services/db';
import { DOCUMENT_TYPES } from '../utils/constants';

export default function EmployeesView({ refreshTrigger, onUploadMissingDoc }) {
  const [certificates, setCertificates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const certs = await getAllCertificates();
        setCertificates(certs);
      } catch (err) {
        console.error('Error loading certificates for employees view:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [refreshTrigger]);

  // Group certificates by employee
  const employeesMap = {};
  certificates.forEach(cert => {
    const name = (cert.employeeName || '').trim();
    if (!name) return;
    if (!employeesMap[name]) {
      employeesMap[name] = {
        name,
        documents: [],
        department: cert.department || 'N/A'
      };
    }
    // Update department if we find a more specific one
    if (cert.department && employeesMap[name].department === 'N/A') {
      employeesMap[name].department = cert.department;
    }
    employeesMap[name].documents.push(cert);
  });
  const employeesList = Object.values(employeesMap).map(emp => {
    const isKitchen = (emp.department || '').toLowerCase().includes('cocina');
    const requiredDocs = isKitchen 
      ? DOCUMENT_TYPES 
      : DOCUMENT_TYPES.filter(type => type !== 'Certificado de ServSafe');

    // Check which of the required documents are uploaded
    const uploadedTypes = new Set(emp.documents.map(d => d.documentType || 'Certificado de salud'));
    const complianceCount = requiredDocs.filter(type => uploadedTypes.has(type)).length;
    
    // Check if any uploaded document is expired or expiring
    let status = 'active';
    if (emp.documents.some(d => d.status === 'expired')) {
      status = 'expired';
    } else if (emp.documents.some(d => d.status === 'expiring')) {
      status = 'expiring';
    }

    return {
      ...emp,
      complianceCount,
      totalCount: requiredDocs.length,
      status
    };
  });
  // Filters based on search query
  const filteredEmployees = employeesList.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Overall stats
  const totalEmployees = employeesList.length;
  const compliantEmployeesCount = employeesList.filter(e => e.status === 'active' && e.complianceCount === e.totalCount).length;
  const avgComplianceScore = totalEmployees > 0 
    ? Math.round((employeesList.reduce((acc, curr) => acc + (curr.complianceCount / curr.totalCount), 0) / totalEmployees) * 100)
    : 100;
  const incompleteFilesCount = employeesList.filter(e => e.complianceCount < e.totalCount).length;

  const selectedEmployee = selectedEmployeeName ? employeesMap[selectedEmployeeName] : null;

  // Get breakdown of required document types for the selected employee
  const getSelectedEmployeeBreakdown = () => {
    if (!selectedEmployee) return [];
    
    const isKitchen = (selectedEmployee.department || '').toLowerCase().includes('cocina');
    const requiredDocs = isKitchen 
      ? DOCUMENT_TYPES 
      : DOCUMENT_TYPES.filter(type => type !== 'Certificado de ServSafe');

    const docsMap = {};
    selectedEmployee.documents.forEach(d => {
      docsMap[d.documentType || 'Certificado de salud'] = d;
    });

    return requiredDocs.map(type => {
      const doc = docsMap[type];
      return {
        type,
        uploaded: !!doc,
        document: doc || null,
        status: doc ? doc.status : 'missing',
        expirationDate: doc ? doc.expirationDate : null
      };
    });
  };

  return (
    <div className="employees-view-container animate-fade-in">
      <div className="view-header">
        <div>
          <h2 className="view-title">Expedientes de Empleados</h2>
          <p className="view-subtitle">Auditoría de cumplimiento y control de documentos faltantes por empleado</p>
        </div>
      </div>

      {/* Grid de Estadísticas Superiores */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper cyan">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Empleados Activos</p>
            <h3>{totalEmployees}</h3>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper green">
            <Award size={22} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Cumplimiento General Promedio</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3>{avgComplianceScore}%</h3>
              <span className="stat-trend positive">
                <TrendingUp size={14} /> Vigente
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper orange">
            <ShieldAlert size={22} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Expedientes Incompletos</p>
            <h3>{incompleteFilesCount}</h3>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="filters-row glass-card">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o departamento..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Analizando expedientes de cumplimiento...</p>
        </div>
      ) : (
        <div className={`employees-layout ${selectedEmployeeName ? 'has-selected' : ''}`}>
          {/* Panel Izquierdo: Lista de Empleados */}
          <div className="employees-list-panel">
            {filteredEmployees.length === 0 ? (
              <div className="no-data-card glass-card">
                <Users size={40} className="no-data-icon" />
                <h4>No se encontraron empleados</h4>
                <p>Intente refinar su búsqueda o suba un documento para registrar un nuevo empleado.</p>
              </div>
            ) : (
              <div className="employees-cards-grid">
                {filteredEmployees.map(emp => {
                  const percent = Math.round((emp.complianceCount / emp.totalCount) * 100);
                  const isSelected = selectedEmployeeName === emp.name;
                  
                  return (
                    <div 
                      key={emp.name} 
                      className={`employee-card glass-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedEmployeeName(emp.name)}
                    >
                      <div className="emp-card-header">
                        <div>
                          <h4 className="emp-card-name">{emp.name}</h4>
                          <span className="emp-card-dept">{emp.department}</span>
                        </div>
                        <span className={`badge badge-${emp.status}`}>
                          {emp.status === 'active' ? 'Vigente' : emp.status === 'expiring' ? 'Advertencia' : 'Expirado'}
                        </span>
                      </div>

                      <div className="emp-progress-section">
                        <div className="progress-labels">
                          <span>Completitud de Expediente</span>
                          <strong>{emp.complianceCount} / {emp.totalCount}</strong>
                        </div>
                        <div className="progress-bar-bg">
                          <div 
                            className={`progress-bar-fill ${emp.complianceCount === emp.totalCount ? 'complete' : ''}`} 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="percent-text">{percent}% completado</span>
                      </div>

                      <div className="emp-card-footer">
                        <span>Ver desglose de documentos</span>
                        <ArrowRight size={14} className="arrow-icon" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel Derecho: Detalle del Expediente de Empleado Seleccionado */}
          <div className="employee-detail-panel">
            {selectedEmployee ? (
              <div className="detail-card glass-card animate-fade-in">
                <div className="detail-header">
                  <div>
                    <h3 className="detail-title">{selectedEmployee.name}</h3>
                    <p className="detail-subtitle">Departamento: {selectedEmployee.department}</p>
                  </div>
                  <div className="detail-badge-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="badge badge-secondary">
                      {Math.round((selectedEmployee.documents.length / DOCUMENT_TYPES.length) * 100)}% Completado
                    </span>
                    <button 
                      className="close-detail-btn"
                      onClick={() => setSelectedEmployeeName(null)}
                      aria-label="Cerrar detalle"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="document-breakdown-list">
                  <h4 className="list-title">Desglose de Documentación Obligatoria</h4>
                  <div className="breakdown-grid">
                    {getSelectedEmployeeBreakdown().map(item => (
                      <div key={item.type} className={`breakdown-row status-${item.status}`}>
                        <div className="doc-info-cell">
                          <FileText size={18} className="doc-icon" />
                          <div>
                            <span className="doc-type-name">{item.type}</span>
                            {item.uploaded ? (
                              <span className="doc-meta-desc">
                                {item.expirationDate ? `Vence: ${item.expirationDate}` : 'Sin vencimiento'}
                              </span>
                            ) : (
                              <span className="doc-meta-desc missing">Pendiente de subir</span>
                            )}
                          </div>
                        </div>

                        <div className="doc-action-cell">
                          {item.uploaded ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className={`badge badge-${item.status}`}>
                                {item.status === 'active' ? 'Vigente' : item.status === 'expiring' ? 'Vence pronto' : 'Vencido'}
                              </span>
                            </div>
                          ) : (
                            <button 
                              className="btn btn-primary btn-sm-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUploadMissingDoc(selectedEmployee.name, item.type);
                              }}
                            >
                              <Plus size={14} /> Subir
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="select-prompt glass-card">
                <Users size={50} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <h3>Auditoría de Expediente</h3>
                <p>Seleccione un empleado de la lista para auditar sus documentos cargados, vigencias y requisitos faltantes.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .employees-view-container {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .view-subtitle {
          color: hsl(var(--text-secondary));
          font-size: 0.95rem;
          margin-top: 0.35rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin: 1.5rem 0;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon-wrapper.cyan {
          background: hsl(var(--accent-cyan) / 0.15);
          color: hsl(var(--accent-cyan));
        }

        .stat-icon-wrapper.green {
          background: hsl(var(--status-active) / 0.15);
          color: hsl(var(--status-active));
        }

        .stat-icon-wrapper.orange {
          background: hsl(var(--status-warning) / 0.15);
          color: hsl(var(--status-warning));
        }

        .stat-label {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: hsl(var(--text-muted));
        }

        .stat-trend {
          font-size: 0.75rem;
          padding: 0.15rem 0.5rem;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        .stat-trend.positive {
          background: hsl(var(--status-active) / 0.1);
          color: hsl(var(--status-active));
        }

        .filters-row {
          padding: 1rem 1.5rem;
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .search-box {
          position: relative;
          width: 100%;
          max-width: 400px;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: hsl(var(--text-muted));
        }

        .search-input {
          width: 100%;
          background: hsl(var(--bg-primary) / 0.6);
          border: 1px solid hsl(var(--card-border));
          border-radius: 8px;
          padding: 0.6rem 1rem 0.6rem 2.5rem;
          color: #fff;
          font-size: 0.9rem;
          outline: none;
          transition: var(--transition-smooth);
        }

        .search-input:focus {
          border-color: hsl(var(--accent-cyan));
          box-shadow: 0 0 0 2px hsl(var(--accent-cyan) / 0.15);
        }

        .employees-layout {
          display: grid;
          grid-template-columns: 1.1fr 1.3fr;
          gap: 1.5rem;
          align-items: start;
        }

        .employees-list-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .employees-cards-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .employee-card {
          cursor: pointer;
          border-left: 4px solid transparent;
        }

        .employee-card:hover {
          transform: translateX(3px);
        }

        .employee-card.selected {
          border-color: hsl(var(--accent-cyan));
          background: hsl(var(--accent-cyan) / 0.04);
        }

        .emp-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .emp-card-name {
          font-size: 1.05rem;
          color: #fff;
        }

        .emp-card-dept {
          font-size: 0.8rem;
          color: hsl(var(--text-muted));
        }

        .emp-progress-section {
          margin: 0.8rem 0;
        }

        .progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          margin-bottom: 0.35rem;
          color: hsl(var(--text-secondary));
        }

        .progress-bar-bg {
          height: 6px;
          background: hsl(var(--bg-primary));
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: hsl(var(--accent-cyan));
          border-radius: 3px;
          transition: width 0.4s ease;
        }

        .progress-bar-fill.complete {
          background: hsl(var(--status-active));
        }

        .percent-text {
          font-size: 0.72rem;
          color: hsl(var(--text-muted));
          display: block;
          margin-top: 0.25rem;
        }

        .emp-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
          color: hsl(var(--accent-cyan));
          padding-top: 0.75rem;
          border-top: 1px solid hsl(var(--card-border) / 0.3);
          font-weight: 600;
        }

        .arrow-icon {
          transition: transform 0.2s ease;
        }

        .employee-card:hover .arrow-icon {
          transform: translateX(4px);
        }

        .employee-detail-panel {
          position: sticky;
          top: 2rem;
        }

        .detail-card {
          padding: 1.75rem;
        }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid hsl(var(--card-border));
          padding-bottom: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .detail-title {
          font-size: 1.35rem;
          color: #fff;
        }

        .detail-subtitle {
          font-size: 0.88rem;
          color: hsl(var(--text-secondary));
        }

        .document-breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .list-title {
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: hsl(var(--accent-cyan));
          margin-bottom: 0.5rem;
        }

        .breakdown-grid {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          max-height: 480px;
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border: 1px solid hsl(var(--card-border) / 0.4);
          background: hsl(var(--bg-primary) / 0.3);
          transition: var(--transition-smooth);
        }

        .breakdown-row.status-missing {
          border-left: 3px solid hsl(var(--text-muted) / 0.4);
          opacity: 0.8;
        }

        .breakdown-row.status-active {
          border-left: 3px solid hsl(var(--status-active));
        }

        .breakdown-row.status-expiring {
          border-left: 3px solid hsl(var(--status-warning));
          background: hsl(var(--status-warning) / 0.04);
        }

        .breakdown-row.status-expired {
          border-left: 3px solid hsl(var(--status-expired));
          background: hsl(var(--status-expired) / 0.04);
        }

        .doc-info-cell {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .doc-icon {
          color: hsl(var(--text-muted));
        }

        .status-active .doc-icon {
          color: hsl(var(--status-active));
        }

        .doc-type-name {
          display: block;
          font-size: 0.88rem;
          font-weight: 600;
          color: #fff;
        }

        .doc-meta-desc {
          display: block;
          font-size: 0.75rem;
          color: hsl(var(--text-secondary));
        }

        .doc-meta-desc.missing {
          color: hsl(var(--status-expired));
          font-weight: 500;
        }

        .btn-sm-action {
          padding: 0.35rem 0.75rem;
          font-size: 0.8rem;
          border-radius: 6px;
          box-shadow: none;
        }

        .select-prompt {
          height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: hsl(var(--text-muted));
          padding: 2rem;
        }

        .select-prompt h3 {
          color: hsl(var(--text-secondary));
          margin-bottom: 0.5rem;
        }

        .select-prompt p {
          font-size: 0.85rem;
          max-width: 320px;
        }

        .no-data-card {
          padding: 3rem 2rem;
          text-align: center;
          color: hsl(var(--text-muted));
        }

        .no-data-icon {
          opacity: 0.2;
          margin-bottom: 1rem;
        }

        .no-data-card h4 {
          color: hsl(var(--text-secondary));
          margin-bottom: 0.5rem;
        }

        .no-data-card p {
          font-size: 0.88rem;
          max-width: 340px;
          margin: 0 auto;
        }

        .loading-state {
          padding: 5rem 0;
          text-align: center;
          color: hsl(var(--text-secondary));
        }

        .spinner {
          width: 36px;
          height: 36px;
          border: 3px solid hsl(var(--card-border));
          border-top-color: hsl(var(--accent-cyan));
          border-radius: 50%;
          margin: 0 auto 1rem;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .close-detail-btn {
          background: transparent;
          border: none;
          color: hsl(var(--text-secondary));
          cursor: pointer;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: var(--transition-smooth);
        }
        .close-detail-btn:hover {
          background: hsl(var(--card-border) / 0.4);
          color: #fff;
        }

        @media (max-width: 900px) {
          .employees-layout {
            grid-template-columns: 1fr;
          }

          .employee-detail-panel {
            display: none;
          }

          .employees-layout.has-selected .employee-detail-panel {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1000;
            background: hsl(var(--bg-primary));
            padding: 1.5rem;
            overflow-y: auto;
          }

          .employees-layout.has-selected .detail-card {
            border: none;
            background: transparent;
            padding: 0;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
