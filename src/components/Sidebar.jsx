import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  Database, 
  Calendar, 
  Bell, 
  Settings, 
  Menu, 
  X 
} from 'lucide-react';

const LogoIcon = ({ className, size = 24 }) => (
  <svg 
    viewBox="0 0 100 100" 
    width={size} 
    height={size} 
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <defs>
      <linearGradient id="sidebarTealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0cd2db"/>
        <stop offset="100%" stop-color="#068388"/>
      </linearGradient>
      <linearGradient id="sidebarGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f3d5b5"/>
        <stop offset="50%" stop-color="#e9c46a"/>
        <stop offset="100%" stop-color="#a78258"/>
      </linearGradient>
    </defs>
    {/* Lowercase "d" */}
    <path d="M 38,42 A 12,12 0 1,0 38,66" fill="none" stroke="url(#sidebarTealGrad)" stroke-width="8" stroke-linecap="round"/>
    <path d="M 38,30 L 38,66" fill="none" stroke="url(#sidebarTealGrad)" stroke-width="8" stroke-linecap="round"/>
    {/* Uppercase "H" */}
    <path d="M 54,30 L 54,66" fill="none" stroke="url(#sidebarGoldGrad)" stroke-width="8" stroke-linecap="round"/>
    <path d="M 72,30 L 72,66" fill="none" stroke="url(#sidebarGoldGrad)" stroke-width="8" stroke-linecap="round"/>
    <path d="M 54,48 L 72,48" fill="none" stroke="url(#sidebarGoldGrad)" stroke-width="8" stroke-linecap="round"/>
  </svg>
);

export default function Sidebar({ currentView, onViewChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard },
    { id: 'intake', label: 'Subir Certificado', icon: Upload },
    { id: 'repository', label: 'Repositorio', icon: Database },
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
        <button className="mobile-toggle" onClick={toggleMobileMenu} aria-label="Toggle Menu">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
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
                    {isActive && <div className="active-indicator" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
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
          background: linear-gradient(135deg, #ffffff 0%, hsl(var(--text-secondary)) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .sidebar-nav {
          flex: 1;
          padding: 1.5rem 1rem;
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
          gap: 1rem;
          padding: 0.85rem 1rem;
          border-radius: 10px;
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 0.95rem;
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
          color: hsl(var(--text-primary));
          background: hsl(var(--accent-cyan) / 0.08);
          font-weight: 600;
        }

        .nav-icon {
          transition: var(--transition-smooth);
        }

        .nav-link.active .nav-icon {
          color: hsl(var(--accent-cyan));
          filter: drop-shadow(0 0 4px hsl(var(--accent-cyan) / 0.4));
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
          padding: 1.5rem;
          border-top: 1px solid hsl(var(--card-border));
          background-color: hsl(var(--bg-primary) / 0.5);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, hsl(var(--accent-cyan-dim)), hsl(var(--accent-cyan)));
          color: hsl(var(--bg-primary));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.9rem;
          box-shadow: 0 0 10px hsl(var(--accent-cyan) / 0.25);
        }

        .user-info {
          overflow: hidden;
        }

        .user-name {
          font-weight: 600;
          font-size: 0.9rem;
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

        .mobile-toggle {
          background: transparent;
          border: none;
          color: hsl(var(--text-primary));
          cursor: pointer;
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
            background-color: hsl(var(--bg-secondary) / 0.95);
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
