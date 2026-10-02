import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, 
  Send, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Save, 
  RotateCcw, 
  Phone, 
  Building, 
  CreditCard, 
  Briefcase, 
  DollarSign, 
  Calendar as CalendarIcon, 
  Mail, 
  MapPin, 
  FileText, 
  Users, 
  Search, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  ShieldCheck,
  CheckCircle2,
  X
} from 'lucide-react';
import { getAllPayrollEmployees, savePayrollEmployee, deletePayrollEmployee } from '../services/db';

const COMMON_BANKS = [
  'Banco Popular de Puerto Rico',
  'FirstBank Puerto Rico',
  'Oriental Bank',
  'Cooperativa de Ahorro y Crédito',
  'Chase Bank',
  'Bank of America',
  'Wells Fargo',
  'PenFed Credit Union',
  'Otro banco'
];

const COMMON_POSITIONS = [
  'Barista',
  'Barista Senior / Lead',
  'Cajero / Cajera',
  'Cocina / Línea',
  'Auxiliar de Cocina',
  'Repostería / Panadería',
  'Mesero / Servicio al Cliente',
  'Encargado / Supervisor de Turno',
  'Gerente Asistente',
  'Limpieza y Mantenimiento'
];

export default function NewEmployeeView() {
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'list'
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Form State
  const initialForm = {
    fullName: '',
    phone: '',
    startDate: '',
    ssn: '',
    birthDate: '',
    physicalAddress: '',
    postalAddress: '',
    sameAddress: false,
    bankName: '',
    bankAccountType: 'Cheques',
    accountNumber: '',
    routingNumber: '',
    email: '',
    position: '',
    hourlyRate: '',
    notes: ''
  };

  const [formData, setFormData] = useState(initialForm);
  const [showSSN, setShowSSN] = useState(false);
  const [copiedAction, setCopiedAction] = useState(null); // 'request' | 'payroll' | null
  const [statusFeedback, setStatusFeedback] = useState(null);

  // Aida's phone number configuration
  const [aidaPhone] = useState(() => localStorage.getItem('aida_whatsapp_phone') || '');

  // View modal for employee details
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const detailsDialogRef = useRef(null);

  useEffect(() => {
    loadPayrollEmployees();
  }, []);

  const loadPayrollEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await getAllPayrollEmployees();
      setEmployees(data);
    } catch (err) {
      console.error('Error loading payroll employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'physicalAddress' && prev.sameAddress) {
        updated.postalAddress = value;
      }
      return updated;
    });
  };

  const handleSameAddressToggle = (checked) => {
    setFormData(prev => ({
      ...prev,
      sameAddress: checked,
      postalAddress: checked ? prev.physicalAddress : ''
    }));
  };

  const handleSSNChange = (e) => {
    // Format SSN as XXX-XX-XXXX
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
    let formatted = raw;
    if (raw.length > 5) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3, 5)}-${raw.slice(5)}`;
    } else if (raw.length > 3) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    }
    handleInputChange('ssn', formatted);
  };

  // Helper to sanitize phone for WhatsApp wa.me link
  const sanitizePhoneForWa = (phoneNumber) => {
    if (!phoneNumber) return '';
    let digits = phoneNumber.replace(/\D/g, '');
    // If standard 10 digit US/PR number, prepend 1
    if (digits.length === 10) {
      digits = '1' + digits;
    }
    return digits;
  };

  // ── Generar mensaje para pedir datos al Empleado ──────────────────
  const generateEmployeeRequestText = () => {
    const nameStr = formData.fullName.trim() ? ` ${formData.fullName.trim()}` : '';
    const posStr = formData.position.trim() ? `\n• *Puesto asignado:* ${formData.position.trim()}` : '';
    const startStr = formData.startDate ? `\n• *Fecha de Inicio:* ${formData.startDate}` : '';

    return `¡Hola${nameStr}! Te damos la bienvenida al equipo de *Historias y un Café* ☕✨.

Para tramitar tu ingreso formal a nómina con Aida, por favor llena y envíanos los siguientes datos por este medio:${posStr}${startStr}

📋 *INFORMACIÓN DE EMPLEADO PARA NÓMINA:*
• *Nombre completo:* ${formData.fullName.trim() || ''}
• *Fecha de Inicio:* ${formData.startDate || ''}
• *Seguro social:* 
• *Fecha de nacimiento:* 
• *Dirección física:* 
• *Dirección postal:* 
• *Tipo de Cuenta de banco (Cheques / Ahorros):* 
• *# cuenta:* 
• *# ruta y tránsito:* 
• *Nombre del banco:* 
• *Correo electrónico:* 
• *Puesto:* ${formData.position.trim() || ''}
• *Nota:* 

Por favor envía esta información lo más pronto posible para registrarte en el sistema. ¡Gracias y mucho éxito!`;
  };

  // ── Generar mensaje con datos llenos para enviar a Aida ───────────
  const generateAidaReportText = (data = formData) => {
    const postalVal = data.sameAddress || (data.postalAddress && data.postalAddress === data.physicalAddress)
      ? 'Misma que la dirección física'
      : (data.postalAddress || 'No especificada');

    return `📋 *INFORMACIÓN DE EMPLEADO PARA NÓMINA*
*Historias y un Café* ☕

👤 *Nombre completo:* ${data.fullName || '—'}
${data.phone ? `📱 *Teléfono:* ${data.phone}\n` : ''}📅 *Fecha de Inicio:* ${data.startDate || '—'}
🔒 *Seguro social:* ${data.ssn || '—'}
🎂 *Fecha de nacimiento:* ${data.birthDate || '—'}
📍 *Dirección física:* ${data.physicalAddress || '—'}
📬 *Dirección postal:* ${postalVal}

🏦 *Nombre del banco:* ${data.bankName || '—'}
💳 *Tipo de Cuenta:* ${data.bankAccountType || 'Cheques'}
🔢 *# cuenta:* ${data.accountNumber || '—'}
🔀 *# ruta y tránsito:* ${data.routingNumber || '—'}

📧 *Correo electrónico:* ${data.email || '—'}
💼 *Puesto:* ${data.position || '—'}
${data.notes ? `📝 *Nota:* ${data.notes}\n` : ''}
_Registrado en docuHistorias_`;
  };

  // ── Acciones de WhatsApp ──────────────────────────────────────────
  const handleSendRequestToEmployeeWA = () => {
    const text = generateEmployeeRequestText();
    const encoded = encodeURIComponent(text);
    const targetPhone = sanitizePhoneForWa(formData.phone);

    const waUrl = targetPhone 
      ? `https://wa.me/${targetPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showFeedback('Abriendo WhatsApp para solicitar datos al empleado...');
  };

  const handleCopyEmployeeRequest = async () => {
    const text = generateEmployeeRequestText();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAction('request');
      showFeedback('¡Plantilla para solicitar datos copiada al portapapeles!');
      setTimeout(() => setCopiedAction(null), 3000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  const handleSendToAidaWA = (data = formData) => {
    if (!data.fullName.trim()) {
      alert('Por favor ingresa al menos el Nombre Completo del empleado antes de enviar a Aida.');
      return;
    }

    const text = generateAidaReportText(data);
    const encoded = encodeURIComponent(text);
    const targetPhone = sanitizePhoneForWa(aidaPhone);

    const waUrl = targetPhone 
      ? `https://wa.me/${targetPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showFeedback('Abriendo WhatsApp para enviar nómina a Aida...');
  };

  const handleCopyAidaReport = async (data = formData) => {
    const text = generateAidaReportText(data);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAction('payroll');
      showFeedback('¡Información de nómina copiada al portapapeles!');
      setTimeout(() => setCopiedAction(null), 3000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  // ── Guardar en Base de Datos ──────────────────────────────────────
  const handleSaveEmployee = async (e) => {
    if (e) e.preventDefault();

    if (!formData.fullName.trim()) {
      alert('Por favor ingresa el Nombre Completo del empleado.');
      return;
    }

    setIsLoading(true);
    try {
      const record = {
        ...formData,
        id: editingId || undefined,
        status: 'Registrado'
      };

      await savePayrollEmployee(record);
      showFeedback(`¡Empleado "${formData.fullName}" guardado exitosamente!`);
      await loadPayrollEmployees();
      
      if (!editingId) {
        // Reset if it was a new record
        setFormData(initialForm);
      } else {
        setEditingId(null);
      }
    } catch (err) {
      console.error('Error saving payroll employee:', err);
      alert('Error al guardar el empleado: ' + (err.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (employee) => {
    setFormData({
      fullName: employee.fullName || '',
      phone: employee.phone || '',
      startDate: employee.startDate || '',
      ssn: employee.ssn || '',
      birthDate: employee.birthDate || '',
      physicalAddress: employee.physicalAddress || '',
      postalAddress: employee.postalAddress || '',
      sameAddress: !!employee.sameAddress,
      bankName: employee.bankName || '',
      bankAccountType: employee.bankAccountType || 'Cheques',
      accountNumber: employee.accountNumber || '',
      routingNumber: employee.routingNumber || '',
      email: employee.email || '',
      position: employee.position || '',
      hourlyRate: employee.hourlyRate || '',
      notes: employee.notes || ''
    });
    setEditingId(employee.id);
    setActiveTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar a "${name}" del registro de nómina?`)) {
      return;
    }

    try {
      await deletePayrollEmployee(id);
      showFeedback(`Registro de "${name}" eliminado.`);
      await loadPayrollEmployees();
      if (editingId === id) {
        setEditingId(null);
        setFormData(initialForm);
      }
    } catch (err) {
      console.error('Error deleting employee:', err);
    }
  };

  const handleResetForm = () => {
    if (window.confirm('¿Deseas limpiar todos los campos del formulario?')) {
      setFormData(initialForm);
      setEditingId(null);
    }
  };

  const showFeedback = (msg) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 4000);
  };

  // Filtered employees for list tab
  const filteredEmployees = employees.filter(emp => {
    const q = searchQuery.toLowerCase();
    return (
      (emp.fullName && emp.fullName.toLowerCase().includes(q)) ||
      (emp.position && emp.position.toLowerCase().includes(q)) ||
      (emp.bankName && emp.bankName.toLowerCase().includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="onboarding-page animate-fade-in">
      {/* Header Banner */}
      <div className="view-header">
        <div className="header-titles">
          <div className="header-badge">
            <UserPlus size={16} />
            <span>Nómina y Recursos Humanos</span>
          </div>
          <h1 className="view-title">Ingreso de Nuevo Empleado</h1>
          <p className="view-subtitle">
            Captura la información de nómina, pídela al empleado por WhatsApp con un clic, o envíale el reporte directo a Aida.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="tab-pill-container">
          <button 
            type="button"
            className={`tab-pill ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            <UserPlus size={16} />
            <span>{editingId ? 'Editando Empleado' : 'Formulario de Ingreso'}</span>
          </button>
          <button 
            type="button"
            className={`tab-pill ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <Users size={16} />
            <span>Empleados Registrados ({employees.length})</span>
          </button>
        </div>
      </div>

      {/* Floating Status Feedback Toast */}
      {statusFeedback && (
        <div className="floating-feedback animate-fade-in">
          <CheckCircle2 size={18} className="feedback-icon" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {activeTab === 'form' ? (
        <div className="onboarding-form-wrapper">
          {/* Quick Action: Request info from Employee */}
          <div className="glass-card request-info-box">
            <div className="request-info-content">
              <div className="request-badge">
                <span>Paso 1: ¿Necesitas que el empleado te envíe la información?</span>
              </div>
              <h3 className="request-title">Pedirle los datos al empleado por WhatsApp</h3>
              <p className="request-desc">
                Genera al instante un mensaje profesional con el formato de todos los datos que Aida necesita. Puedes enviarlo directamente al celular del empleado o copiarlo.
              </p>
            </div>

            <div className="request-actions">
              <button 
                type="button"
                className="btn btn-wa-secondary"
                onClick={handleSendRequestToEmployeeWA}
              >
                <Send size={16} />
                <span>📲 Pedir datos al Empleado (WhatsApp)</span>
              </button>

              <button 
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyEmployeeRequest}
              >
                {copiedAction === 'request' ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                <span>{copiedAction === 'request' ? '¡Copiado!' : 'Copiar Solicitud'}</span>
              </button>
            </div>
          </div>

          {/* Main Form */}
          <form onSubmit={handleSaveEmployee} className="glass-card employee-entry-card">
            <div className="form-card-header">
              <div>
                <h2 className="section-heading">Información de Empleado para Nómina</h2>
                <p className="section-subheading">
                  {editingId ? 'Modifica los datos del empleado y guarda o reenvía a Aida.' : 'Completa la ficha para registrar al empleado y despachar los datos por WhatsApp.'}
                </p>
              </div>

              {editingId && (
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingId(null);
                    setFormData(initialForm);
                  }}
                >
                  Cancelar Edición
                </button>
              )}
            </div>

            {/* SECCIÓN 1: Datos Personales */}
            <div className="form-group-section">
              <div className="section-title-tag">
                <Users size={16} />
                <span>1. Datos Personales</span>
              </div>

              <div className="form-grid-3">
                <div className="form-group span-2">
                  <label className="form-label" htmlFor="emp-fullname">
                    Nombre completo <span className="required-star">*</span>
                  </label>
                  <input 
                    id="emp-fullname"
                    type="text" 
                    className="form-input"
                    placeholder="Ej. Carmen Rodríguez Ortiz"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="emp-phone">
                    Teléfono celular (WhatsApp)
                  </label>
                  <div className="input-with-icon">
                    <Phone size={16} className="input-icon" />
                    <input 
                      id="emp-phone"
                      type="tel" 
                      className="form-input with-icon"
                      placeholder="787-555-0123"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="emp-start-date">
                    Fecha de Inicio
                  </label>
                  <div className="input-with-icon">
                    <CalendarIcon size={16} className="input-icon" />
                    <input 
                      id="emp-start-date"
                      type="date" 
                      className="form-input with-icon"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="emp-birth-date">
                    Fecha de nacimiento
                  </label>
                  <div className="input-with-icon">
                    <CalendarIcon size={16} className="input-icon" />
                    <input 
                      id="emp-birth-date"
                      type="date" 
                      className="form-input with-icon"
                      value={formData.birthDate}
                      onChange={(e) => handleInputChange('birthDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="emp-ssn">
                    Seguro social (SSN)
                  </label>
                  <div className="input-with-action">
                    <input 
                      id="emp-ssn"
                      type={showSSN ? "text" : "password"} 
                      className="form-input"
                      placeholder="XXX-XX-XXXX"
                      value={formData.ssn}
                      onChange={handleSSNChange}
                      maxLength={11}
                    />
                    <button 
                      type="button" 
                      className="field-toggle-btn"
                      onClick={() => setShowSSN(!showSSN)}
                      title={showSSN ? "Ocultar dígitos" : "Mostrar dígitos"}
                    >
                      {showSSN ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group span-3">
                  <label className="form-label" htmlFor="emp-email">
                    Correo electrónico
                  </label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input 
                      id="emp-email"
                      type="email" 
                      className="form-input with-icon"
                      placeholder="nombre@ejemplo.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: Direcciones */}
            <div className="form-group-section">
              <div className="section-title-tag">
                <MapPin size={16} />
                <span>2. Direcciones Residencial y Postal</span>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="emp-phys-addr">
                    Dirección física
                  </label>
                  <textarea 
                    id="emp-phys-addr"
                    className="form-input form-textarea"
                    rows="2"
                    placeholder="Urb., Calle, Número, Apto, Pueblo, Código Postal"
                    value={formData.physicalAddress}
                    onChange={(e) => handleInputChange('physicalAddress', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <div className="postal-label-row">
                    <label className="form-label" htmlFor="emp-post-addr">
                      Dirección postal
                    </label>
                    <label className="same-address-checkbox">
                      <input 
                        type="checkbox"
                        checked={formData.sameAddress}
                        onChange={(e) => handleSameAddressToggle(e.target.checked)}
                      />
                      <span>Misma que física</span>
                    </label>
                  </div>
                  <textarea 
                    id="emp-post-addr"
                    className={`form-input form-textarea ${formData.sameAddress ? 'disabled' : ''}`}
                    rows="2"
                    placeholder={formData.sameAddress ? "Misma que la dirección física" : "P.O. Box o Dirección postal"}
                    value={formData.postalAddress}
                    onChange={(e) => handleInputChange('postalAddress', e.target.value)}
                    disabled={formData.sameAddress}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: Datos Bancarios */}
            <div className="form-group-section">
              <div className="section-title-tag">
                <Building size={16} />
                <span>3. Datos Bancarios para Nómina / Depósito Directo</span>
              </div>

              <div className="form-grid-4">
                <div className="form-group span-2">
                  <label className="form-label" htmlFor="emp-bank-name">
                    Nombre del banco
                  </label>
                  <input 
                    id="emp-bank-name"
                    type="text" 
                    list="banks-list"
                    className="form-input"
                    placeholder="Ej. Banco Popular de Puerto Rico"
                    value={formData.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                  />
                  <datalist id="banks-list">
                    {COMMON_BANKS.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>

                <div className="form-group span-2">
                  <label className="form-label" htmlFor="emp-acc-type">
                    Tipo de Cuenta de banco
                  </label>
                  <select 
                    id="emp-acc-type"
                    className="form-input"
                    value={formData.bankAccountType}
                    onChange={(e) => handleInputChange('bankAccountType', e.target.value)}
                  >
                    <option value="Cheques">Cuenta de Cheques (Checking)</option>
                    <option value="Ahorros">Cuenta de Ahorros (Savings)</option>
                    <option value="Nómina / Nómina Directa">Nómina / Nómina Directa</option>
                  </select>
                </div>

                <div className="form-group span-2">
                  <label className="form-label" htmlFor="emp-acc-num">
                    # cuenta
                  </label>
                  <div className="input-with-icon">
                    <CreditCard size={16} className="input-icon" />
                    <input 
                      id="emp-acc-num"
                      type="text" 
                      className="form-input with-icon"
                      placeholder="Número de cuenta bancaria"
                      value={formData.accountNumber}
                      onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group span-2">
                  <label className="form-label" htmlFor="emp-routing-num">
                    # ruta y tránsito (Routing Number)
                  </label>
                  <input 
                    id="emp-routing-num"
                    type="text" 
                    className="form-input"
                    placeholder="9 dígitos (ej. 021502011)"
                    value={formData.routingNumber}
                    onChange={(e) => handleInputChange('routingNumber', e.target.value)}
                    maxLength={12}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 4: Puesto y Compensación */}
            <div className="form-group-section">
              <div className="section-title-tag">
                <Briefcase size={16} />
                <span>4. Puesto y Compensación</span>
              </div>

              <div className="form-grid-3">
                <div className="form-group span-2">
                  <label className="form-label" htmlFor="emp-position">
                    Puesto
                  </label>
                  <input 
                    id="emp-position"
                    type="text" 
                    list="positions-list"
                    className="form-input"
                    placeholder="Ej. Barista, Cocina, Repostería"
                    value={formData.position}
                    onChange={(e) => handleInputChange('position', e.target.value)}
                  />
                  <datalist id="positions-list">
                    {COMMON_POSITIONS.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="emp-hourly-rate">
                    Pago por hora $
                  </label>
                  <div className="input-with-icon">
                    <DollarSign size={16} className="input-icon" />
                    <input 
                      id="emp-hourly-rate"
                      type="number" 
                      step="0.01" 
                      min="0"
                      className="form-input with-icon"
                      placeholder="10.50"
                      value={formData.hourlyRate}
                      onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group span-3">
                  <label className="form-label" htmlFor="emp-notes">
                    Nota
                  </label>
                  <textarea 
                    id="emp-notes"
                    className="form-input form-textarea"
                    rows="2"
                    placeholder="Turnos acordados, uniforme talla M, referencias, comentarios especiales..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="form-actions-bottom">
              <div className="primary-dispatch-actions">
                {/* Botón principal: Enviar a Aida por WA */}
                <button 
                  type="button" 
                  className="btn btn-wa-primary"
                  onClick={() => handleSendToAidaWA(formData)}
                  title="Abre WhatsApp con la ficha completa formateada para enviársela a Aida"
                >
                  <Send size={18} />
                  <span>📤 Enviar a Aida por WhatsApp</span>
                </button>

                {/* Copiar resumen */}
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => handleCopyAidaReport(formData)}
                >
                  {copiedAction === 'payroll' ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                  <span>{copiedAction === 'payroll' ? '¡Copiado!' : 'Copiar Resumen para Aida'}</span>
                </button>
              </div>

              <div className="secondary-save-actions">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  <Save size={16} />
                  <span>{editingId ? 'Actualizar Ficha' : 'Guardar en Sistema'}</span>
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary btn-icon-only"
                  onClick={handleResetForm}
                  title="Limpiar campos"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* TAB 2: LISTA DE EMPLEADOS REGISTRADOS */
        <div className="registered-employees-tab animate-fade-in">
          <div className="list-toolbar">
            <div className="search-bar-wrapper">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="Buscar por nombre, puesto o banco..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input search-input"
              />
              {searchQuery && (
                <button 
                  type="button" 
                  className="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => {
                setEditingId(null);
                setFormData(initialForm);
                setActiveTab('form');
              }}
            >
              <UserPlus size={16} />
              <span>+ Nuevo Empleado</span>
            </button>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="glass-card empty-list-card">
              <Users size={48} className="empty-icon" />
              <h3>No se encontraron registros de empleados</h3>
              <p>
                {searchQuery ? 'Prueba con otro término de búsqueda.' : 'Aún no has registrado empleados en este apartado. Haz clic en el botón de arriba para ingresar uno nuevo.'}
              </p>
            </div>
          ) : (
            <div className="employees-cards-grid">
              {filteredEmployees.map((emp) => (
                <div key={emp.id} className="glass-card emp-payroll-card">
                  <div className="emp-card-top">
                    <div>
                      <h3 className="emp-name">{emp.fullName}</h3>
                      <div className="emp-pills">
                        {emp.position && <span className="emp-pill-position">{emp.position}</span>}
                        {emp.hourlyRate && <span className="emp-pill-rate">${emp.hourlyRate}/hr</span>}
                        {emp.startDate && <span className="emp-pill-date">Inicia: {emp.startDate}</span>}
                      </div>
                    </div>

                    <div className="card-top-actions">
                      <button 
                        type="button" 
                        className="btn-icon"
                        title="Ver detalles completos"
                        onClick={() => {
                          setViewingEmployee(emp);
                          if (detailsDialogRef.current) detailsDialogRef.current.showModal();
                        }}
                      >
                        <Eye size={17} />
                      </button>

                      <button 
                        type="button" 
                        className="btn-icon"
                        title="Editar empleado"
                        onClick={() => handleEdit(emp)}
                      >
                        <Edit3 size={17} />
                      </button>

                      <button 
                        type="button" 
                        className="btn-icon text-danger-hover"
                        title="Eliminar registro"
                        onClick={() => handleDelete(emp.id, emp.fullName)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>

                  <div className="emp-card-details">
                    <div className="detail-item">
                      <span className="detail-label">Banco:</span>
                      <span className="detail-val">{emp.bankName || 'No indicado'} ({emp.bankAccountType || 'Cheques'})</span>
                    </div>

                    {emp.accountNumber && (
                      <div className="detail-item">
                        <span className="detail-label">Cuenta:</span>
                        <span className="detail-val">•••• {emp.accountNumber.slice(-4)}</span>
                      </div>
                    )}

                    {emp.phone && (
                      <div className="detail-item">
                        <span className="detail-label">Teléfono:</span>
                        <span className="detail-val">{emp.phone}</span>
                      </div>
                    )}

                    {emp.email && (
                      <div className="detail-item">
                        <span className="detail-label">Email:</span>
                        <span className="detail-val">{emp.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="emp-card-footer">
                    <button 
                      type="button" 
                      className="btn btn-wa-secondary btn-sm"
                      onClick={() => handleSendToAidaWA(emp)}
                      title="Enviar nómina de este empleado a Aida por WhatsApp"
                    >
                      <Send size={14} />
                      <span>Reenviar a Aida</span>
                    </button>

                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopyAidaReport(emp)}
                      title="Copiar texto de nómina"
                    >
                      <Copy size={14} />
                      <span>Copiar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DETALLES DE EMPLEADO */}
      <dialog 
        ref={detailsDialogRef}
        className="cert-dialog-modal details-dialog"
        onClick={(e) => {
          if (e.target === detailsDialogRef.current) detailsDialogRef.current.close();
        }}
      >
        {viewingEmployee && (
          <div className="modal-content-wrapper">
            <div className="modal-header">
              <div>
                <h2>{viewingEmployee.fullName}</h2>
                <div className="modal-subtitle">
                  Ficha de Nómina • Registrado el {new Date(viewingEmployee.createdAt || Date.now()).toLocaleDateString('es-PR')}
                </div>
              </div>
              <button 
                type="button" 
                className="close-modal-btn"
                onClick={() => detailsDialogRef.current.close()}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-details-body">
              <div className="details-grid">
                <div className="detail-group">
                  <span className="lbl">Puesto:</span>
                  <span className="val">{viewingEmployee.position || '—'}</span>
                </div>
                <div className="detail-group">
                  <span className="lbl">Pago por hora:</span>
                  <span className="val">{viewingEmployee.hourlyRate ? `$${viewingEmployee.hourlyRate}` : '—'}</span>
                </div>
                <div className="detail-group">
                  <span className="lbl">Fecha de Inicio:</span>
                  <span className="val">{viewingEmployee.startDate || '—'}</span>
                </div>
                <div className="detail-group">
                  <span className="lbl">Fecha de nacimiento:</span>
                  <span className="val">{viewingEmployee.birthDate || '—'}</span>
                </div>
                <div className="detail-group">
                  <span className="lbl">Seguro social:</span>
                  <span className="val">{viewingEmployee.ssn || '—'}</span>
                </div>
                <div className="detail-group">
                  <span className="lbl">Teléfono:</span>
                  <span className="val">{viewingEmployee.phone || '—'}</span>
                </div>
                <div className="detail-group">
                  <span className="lbl">Correo:</span>
                  <span className="val">{viewingEmployee.email || '—'}</span>
                </div>
                <div className="detail-group span-2">
                  <span className="lbl">Dirección física:</span>
                  <span className="val">{viewingEmployee.physicalAddress || '—'}</span>
                </div>
                <div className="detail-group span-2">
                  <span className="lbl">Dirección postal:</span>
                  <span className="val">
                    {viewingEmployee.sameAddress 
                      ? 'Misma que física' 
                      : (viewingEmployee.postalAddress || '—')}
                  </span>
                </div>
                <div className="detail-group">
                  <span className="lbl">Banco:</span>
                  <span className="val">{viewingEmployee.bankName || '—'}</span>
                </div>
                <div className="detail-group">
                  <span className="lbl">Tipo de Cuenta:</span>
                  <span className="val">{viewingEmployee.bankAccountType || '—'}</span>
                </div>
                <div className="detail-group">
                  <span className="lbl"># Cuenta:</span>
                  <span className="val">{viewingEmployee.accountNumber || '—'}</span>
                </div>
                <div className="detail-group">
                  <span className="lbl"># Ruta y Tránsito:</span>
                  <span className="val">{viewingEmployee.routingNumber || '—'}</span>
                </div>
                {viewingEmployee.notes && (
                  <div className="detail-group span-2">
                    <span className="lbl">Notas adicionales:</span>
                    <span className="val">{viewingEmployee.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer-actions">
              <button 
                type="button" 
                className="btn btn-wa-primary btn-sm"
                onClick={() => {
                  handleSendToAidaWA(viewingEmployee);
                }}
              >
                <Send size={15} />
                <span>Enviar a Aida (WA)</span>
              </button>

              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopyAidaReport(viewingEmployee)}
              >
                <Copy size={15} />
                <span>Copiar Datos</span>
              </button>

              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  detailsDialogRef.current.close();
                  handleEdit(viewingEmployee);
                }}
              >
                <Edit3 size={15} />
                <span>Editar</span>
              </button>
            </div>
          </div>
        )}
      </dialog>

      <style>{`
        .onboarding-page {
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .view-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .header-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          background: hsl(var(--accent-cyan) / 0.15);
          color: hsl(var(--accent-cyan));
          border: 1px solid hsl(var(--accent-cyan) / 0.3);
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .view-title {
          font-size: 1.85rem;
          font-weight: 800;
          color: hsl(var(--text-primary));
          letter-spacing: -0.02em;
        }

        .view-subtitle {
          color: hsl(var(--text-secondary));
          font-size: 0.95rem;
          margin-top: 0.25rem;
          max-width: 650px;
        }

        .tab-pill-container {
          display: flex;
          background: hsl(var(--bg-secondary));
          border: 1px solid hsl(var(--card-border));
          padding: 0.3rem;
          border-radius: 12px;
          gap: 0.25rem;
        }

        .tab-pill {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.55rem 1rem;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: hsl(var(--text-secondary));
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .tab-pill:hover {
          color: hsl(var(--text-primary));
        }

        .tab-pill.active {
          background: hsl(var(--accent-cyan) / 0.15);
          color: hsl(var(--accent-cyan));
          border: 1px solid hsl(var(--accent-cyan) / 0.3);
        }

        /* Aida config banner */
        .aida-config-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.85rem 1.25rem;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .aida-info-left {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .aida-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #25D366;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.1rem;
          box-shadow: 0 0 10px rgba(37, 211, 102, 0.35);
        }

        .aida-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: hsl(var(--text-muted));
          font-weight: 700;
        }

        .aida-value {
          margin-top: 0.15rem;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .phone-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: #25D366;
        }

        .phone-empty {
          color: hsl(var(--text-secondary));
          font-style: italic;
          font-size: 0.85rem;
        }

        .aida-edit-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .aida-phone-input {
          padding: 0.4rem 0.75rem;
          font-size: 0.85rem;
          width: 160px;
        }

        /* Request Info Box */
        .request-info-box {
          border-left: 4px solid #25D366;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
          background: linear-gradient(135deg, hsl(var(--card-bg)), hsl(var(--bg-secondary)));
          margin-bottom: 1.5rem;
        }

        .request-badge {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 700;
          color: #25D366;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }

        .request-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: hsl(var(--text-primary));
        }

        .request-desc {
          color: hsl(var(--text-secondary));
          font-size: 0.88rem;
          margin-top: 0.25rem;
          max-width: 580px;
        }

        .request-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        /* WhatsApp Button Variants */
        .btn-wa-primary {
          background: #25D366;
          color: #ffffff;
          font-weight: 700;
          border: none;
          box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.4rem;
          border-radius: 10px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .btn-wa-primary:hover {
          background: #20bd5a;
          box-shadow: 0 6px 20px rgba(37, 211, 102, 0.5);
          transform: translateY(-2px);
        }

        .btn-wa-secondary {
          background: rgba(37, 211, 102, 0.12);
          color: #25D366;
          border: 1px solid rgba(37, 211, 102, 0.35);
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1.15rem;
          border-radius: 10px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .btn-wa-secondary:hover {
          background: #25D366;
          color: #ffffff;
          border-color: #25D366;
          transform: translateY(-2px);
        }

        /* Form sections */
        .employee-entry-card {
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .form-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid hsl(var(--card-border));
          padding-bottom: 1.25rem;
        }

        .section-heading {
          font-size: 1.3rem;
          font-weight: 800;
          color: hsl(var(--text-primary));
        }

        .section-subheading {
          font-size: 0.85rem;
          color: hsl(var(--text-muted));
          margin-top: 0.25rem;
        }

        .form-group-section {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .section-title-tag {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
          font-weight: 700;
          color: hsl(var(--accent-cyan));
          border-bottom: 1px dashed hsl(var(--card-border));
          padding-bottom: 0.5rem;
        }

        .form-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.25rem;
        }

        .form-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
        }

        .form-grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }

        .span-2 {
          grid-column: span 2;
        }

        .span-3 {
          grid-column: span 3;
        }

        .required-star {
          color: hsl(var(--status-expired));
          font-weight: 700;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 0.9rem;
          color: hsl(var(--text-muted));
          pointer-events: none;
        }

        .form-input.with-icon {
          padding-left: 2.5rem;
        }

        .input-with-action {
          position: relative;
          display: flex;
          align-items: center;
        }

        .field-toggle-btn {
          position: absolute;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: hsl(var(--text-muted));
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0.25rem;
          border-radius: 4px;
        }

        .field-toggle-btn:hover {
          color: hsl(var(--text-primary));
        }

        .form-textarea {
          resize: vertical;
          min-height: 60px;
        }

        .form-textarea.disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: hsl(var(--bg-secondary) / 0.5);
        }

        .postal-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.35rem;
        }

        .same-address-checkbox {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          color: hsl(var(--accent-cyan));
          cursor: pointer;
          user-select: none;
        }

        .same-address-checkbox input {
          cursor: pointer;
          accent-color: hsl(var(--accent-cyan));
        }

        /* Bottom Actions */
        .form-actions-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid hsl(var(--card-border));
          flex-wrap: wrap;
        }

        .primary-dispatch-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .secondary-save-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .btn-icon-only {
          padding: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-sm {
          padding: 0.45rem 0.85rem;
          font-size: 0.85rem;
        }

        .text-success {
          color: #25D366;
        }

        /* Floating feedback */
        .floating-feedback {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          background: hsl(var(--bg-secondary));
          border: 1px solid hsl(var(--accent-cyan));
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
          color: hsl(var(--text-primary));
          padding: 0.85rem 1.25rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          z-index: 999;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .feedback-icon {
          color: #25D366;
        }

        /* List Tab Styles */
        .list-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }

        .search-bar-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
          max-width: 450px;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          color: hsl(var(--text-muted));
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding-left: 2.6rem;
          padding-right: 2.2rem;
        }

        .clear-search-btn {
          position: absolute;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: hsl(var(--text-muted));
          cursor: pointer;
        }

        .empty-list-card {
          text-align: center;
          padding: 4rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .empty-icon {
          color: hsl(var(--text-muted));
          opacity: 0.5;
        }

        .employees-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.25rem;
        }

        .emp-payroll-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 1.25rem;
          gap: 1rem;
          transition: var(--transition-smooth);
        }

        .emp-payroll-card:hover {
          border-color: hsl(var(--accent-cyan) / 0.5);
          transform: translateY(-2px);
        }

        .emp-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .emp-name {
          font-size: 1.15rem;
          font-weight: 700;
          color: hsl(var(--text-primary));
        }

        .emp-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: 0.4rem;
        }

        .emp-pill-position {
          background: hsl(var(--accent-cyan) / 0.12);
          color: hsl(var(--accent-cyan));
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
        }

        .emp-pill-rate {
          background: rgba(37, 211, 102, 0.12);
          color: #25D366;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
        }

        .emp-pill-date {
          background: hsl(var(--card-border) / 0.5);
          color: hsl(var(--text-secondary));
          font-size: 0.75rem;
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
        }

        .card-top-actions {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }

        .btn-icon {
          background: hsl(var(--bg-tertiary));
          border: 1px solid hsl(var(--card-border));
          color: hsl(var(--text-secondary));
          border-radius: 6px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .btn-icon:hover {
          color: hsl(var(--text-primary));
          border-color: hsl(var(--accent-cyan));
        }

        .text-danger-hover:hover {
          color: hsl(var(--status-expired)) !important;
          border-color: hsl(var(--status-expired)) !important;
        }

        .emp-card-details {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          font-size: 0.85rem;
          background: hsl(var(--bg-primary) / 0.3);
          padding: 0.75rem;
          border-radius: 8px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .detail-label {
          color: hsl(var(--text-muted));
        }

        .detail-val {
          color: hsl(var(--text-secondary));
          font-weight: 500;
          text-align: right;
        }

        .emp-card-footer {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid hsl(var(--card-border));
        }

        /* Modal Details */
        .details-dialog {
          max-width: 650px;
          width: 95vw;
        }

        .modal-details-body {
          padding: 1.5rem;
          overflow-y: auto;
          max-height: 60vh;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.25rem;
        }

        .detail-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .detail-group .lbl {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: hsl(var(--text-muted));
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .detail-group .val {
          font-size: 0.95rem;
          color: hsl(var(--text-primary));
          font-weight: 500;
        }

        .modal-footer-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1.25rem 1.5rem;
          border-top: 1px solid hsl(var(--card-border));
        }

        @media (max-width: 768px) {
          .view-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .tab-pill-container {
            width: 100%;
          }

          .tab-pill {
            flex: 1;
            justify-content: center;
          }

          .form-grid-2, .form-grid-3, .form-grid-4 {
            grid-template-columns: 1fr;
          }

          .span-2, .span-3 {
            grid-column: span 1;
          }

          .form-actions-bottom {
            flex-direction: column;
            align-items: stretch;
          }

          .primary-dispatch-actions, .secondary-save-actions {
            width: 100%;
          }

          .btn-wa-primary, .btn-wa-secondary {
            width: 100%;
            justify-content: center;
          }

          .request-info-box {
            flex-direction: column;
            align-items: stretch;
          }

          .request-actions {
            flex-direction: column;
          }

          .request-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
