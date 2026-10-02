import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  UserPlus,
  Upload, 
  Database, 
  Calendar, 
  Bell, 
  Settings, 
  Menu, 
  X,
  Users,
  Sun,
  Moon
} from 'lucide-react';

const LogoIcon = ({ className, size = 24 }) => (
  <img 
    src="/certificado-de-salud-historias/icon.png"
    width={size} 
    height={size} 
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', objectFit: 'contain', borderRadius: '25%' }}
    alt="Logo docuHistorias"
  />
);

export default function Sidebar({ currentView, onViewChange, theme = 'dark', onToggleTheme }) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard },
    { id: 'onboarding', label: 'Nuevo Empleado', icon: UserPlus },
    { id: 'intake', label: 'Subir Documento', icon: Upload },
    { id: 'repository', label: 'Repositorio', icon: Database },
    { id: 'employees', label: 'Expedientes', icon: Users },
    { id: 'calendar', label: 'Calendario', icon: Calendar },
    { id: 'notifications', label: 'Registro de Alertas', icon: Bell },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  const toggleMobileMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleNav = (viewId) => {
    onViewChange(viewId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Top Navigation Header */}
      <header className="mobile-header">
        <div className="logo-container animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LogoIcon className="logo-icon animate-pulse" size={28} />
          <span className="logo-text">docuHistorias</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onToggleTheme && (
            <button 
              className="theme-mobile-btn" 
              onClick={onToggleTheme} 
              aria-label="Toggle Theme"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
          <button className="mobile-toggle" onClick={toggleMobileMenu} aria-label="Toggle Menu">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Sidebar Container */}
      <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <LogoIcon className="logo-icon" size={32} />
          <h1 className="logo-text">docuHistorias</h1>
        </div>

        <nav className="sidebar-nav">
          <ul>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <li key={item.id}>
                  <button
                     onClick={() => handleNav(item.id)}
                     className={`nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={20} className="nav-icon" />
                    <span>{item.label}</span>
                    {item.id === 'onboarding' && (
                      <span className="nav-badge-new">NUEVO</span>
                    )}
                    {isActive && <div className="active-indicator" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer with Theme Toggle and Admin Profile */}
        <div className="sidebar-footer">
          {onToggleTheme && (
            <button 
              type="button" 
              className="theme-toggle-bar"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              <div className="theme-toggle-left">
                {theme === 'dark' ? <Sun size={17} className="sun-icon" /> : <Moon size={17} className="moon-icon" />}
                <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
              </div>
              <span className="theme-pill-status">
                {theme === 'dark' ? 'Oscuro' : 'Claro'}
              </span>
            </button>
          )}

          <div className="user-profile">
            <div className="avatar">AD</div>
            <div className="user-info">
              <p className="user-name">Portal de Admin</p>
              <p className="user-role">Superusuario</p>
            </div>
          </div>
        </div>
      </aside>

      {/* CSS specific to Sidebar and Layout structures */}
      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          background-color: hsl(var(--bg-secondary));
          border-right: 1px solid hsl(var(--card-border));
          display: flex;
          flex-direction: column;
          height: 100vh;
          z-index: 100;
          transition: var(--transition-smooth);
        }

        .sidebar-brand {
          padding: 2rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-bottom: 1px solid hsl(var(--card-border));
        }

        .logo-icon {
          color: hsl(var(--accent-cyan));
          filter: drop-shadow(0 0 8px hsl(var(--accent-cyan) / 0.5));
        }

        .logo-text {
          font-family: var(--font-display);
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: hsl(var(--text-primary));
        }

        .sidebar-nav {
          flex: 1;
          padding: 1.5rem 1rem;
          overflow-y: auto;
        }

        .sidebar-nav ul {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .nav-link {
          width: 100%;
          background: transparent;
          border: none;
          color: hsl(var(--text-secondary));
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 0.92rem;
          font-weight: 500;
          text-align: left;
          position: relative;
          transition: var(--transition-smooth);
        }

        .nav-link:hover {
          color: hsl(var(--text-primary));
          background: hsl(var(--card-border) / 0.3);
        }

        .nav-link.active {
          color: hsl(var(--accent-cyan));
          background: hsl(var(--accent-cyan) / 0.1);
          font-weight: 700;
        }

        .nav-icon {
          transition: var(--transition-smooth);
          flex-shrink: 0;
        }

        .nav-link.active .nav-icon {
          color: hsl(var(--accent-cyan));
          filter: drop-shadow(0 0 4px hsl(var(--accent-cyan) / 0.4));
        }

        .nav-badge-new {
          margin-left: auto;
          background: #25D366;
          color: #ffffff;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.15rem 0.45rem;
          border-radius: 10px;
          letter-spacing: 0.04em;
        }

        .active-indicator {
          position: absolute;
          left: 0;
          top: 25%;
          height: 50%;
          width: 4px;
          background-color: hsl(var(--accent-cyan));
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 8px hsl(var(--accent-cyan));
        }

        .sidebar-footer {
          padding: 1.25rem 1rem;
          border-top: 1px solid hsl(var(--card-border));
          background-color: hsl(var(--bg-primary) / 0.5);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .theme-toggle-bar {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0.85rem;
          background: hsl(var(--bg-secondary));
          border: 1px solid hsl(var(--card-border));
          border-radius: 10px;
          color: hsl(var(--text-secondary));
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          transition: var(--transition-smooth);
        }

        .theme-toggle-bar:hover {
          color: hsl(var(--text-primary));
          border-color: hsl(var(--accent-cyan) / 0.5);
          background: hsl(var(--card-border) / 0.2);
        }

        .theme-toggle-left {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .sun-icon {
          color: #f59e0b;
        }

        .moon-icon {
          color: #6366f1;
        }

        .theme-pill-status {
          font-size: 0.72rem;
          padding: 0.15rem 0.5rem;
          border-radius: 12px;
          background: hsl(var(--bg-tertiary));
          color: hsl(var(--text-muted));
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, hsl(var(--accent-cyan-dim)), hsl(var(--accent-cyan)));
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.88rem;
          box-shadow: 0 0 10px hsl(var(--accent-cyan) / 0.25);
          flex-shrink: 0;
        }

        .user-info {
          overflow: hidden;
        }

        .user-name {
          font-weight: 600;
          font-size: 0.88rem;
          color: hsl(var(--text-primary));
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 0.75rem;
          color: hsl(var(--text-muted));
        }

        .mobile-header {
          display: none;
          height: 60px;
          background-color: hsl(var(--bg-secondary));
          border-bottom: 1px solid hsl(var(--card-border));
          padding: 0 1.25rem;
          align-items: center;
          justify-content: space-between;
          z-index: 101;
        }

        .mobile-toggle, .theme-mobile-btn {
          background: transparent;
          border: none;
          color: hsl(var(--text-primary));
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.4rem;
          border-radius: 6px;
        }

        .theme-mobile-btn:hover {
          background: hsl(var(--card-border) / 0.3);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        /* Responsive Breakpoints */
        @media (max-width: 768px) {
          .mobile-header {
            display: flex;
          }

          .sidebar {
            position: fixed;
            top: 60px;
            left: -100%;
            height: calc(100vh - 60px);
            width: 100%;
            background-color: hsl(var(--bg-secondary) / 0.98);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            box-shadow: var(--shadow-glow);
          }

          .sidebar.mobile-open {
            left: 0;
          }
        }
      `}</style>
    </>
  );
}

