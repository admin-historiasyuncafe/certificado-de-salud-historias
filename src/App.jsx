import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Intake from './components/Intake';
import Repository from './components/Repository';
import CalendarView from './components/CalendarView';
import NotificationsLog from './components/NotificationsLog';
import Settings from './components/Settings';
import { getAllCertificates, logNotification, getNotificationLogs } from './services/db';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Request browser notification permissions on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Run automated scan check whenever the database updates or view changes
  useEffect(() => {
    runAutomaticAlertCheck();
  }, [refreshTrigger, currentView]);

  const triggerBrowserNotification = (title, body) => {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
      new Notification(title, { 
        body, 
        icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛡️</text></svg>' 
      });
    }
  };

  const runAutomaticAlertCheck = async () => {
    try {
      const certs = await getAllCertificates();
      const todayStr = new Date().toISOString().split('T')[0];
      const today = new Date(todayStr);
      const warningPeriod = parseInt(localStorage.getItem('warning_period') || '14', 10);
      const logs = await getNotificationLogs();
      
      let logsCreated = false;

      for (const cert of certs) {
        if (!cert.expirationDate) continue;
        
        const exp = new Date(cert.expirationDate);
        
        // Reset time component for accurate comparison
        exp.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = exp - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const certLogs = logs.filter(l => l.certificateId === cert.id);
        
        // 1. Send warning notification (14 days before expiration or closer)
        if (diffDays <= warningPeriod && diffDays >= 0) {
          const hasWarningLog = certLogs.some(l => l.type === 'warning-14day');
          if (!hasWarningLog) {
            // Log alert in local DB
            await logNotification({
              certificateId: cert.id,
              employeeName: cert.employeeName,
              recipient: 'Manual (WhatsApp/SMS)',
              type: 'warning-14day',
              sentAt: new Date().toISOString(),
              expirationDate: cert.expirationDate,
              status: 'Sent'
            });
            
            // Fire Browser Notification
            triggerBrowserNotification(
              `⚠️ Alerta de Cumplimiento: ${cert.employeeName}`,
              `El certificado de salud vence el ${cert.expirationDate} (en ${diffDays} días). Por favor, solicite la renovación.`
            );
            logsCreated = true;
          }
        }
        
        // 2. Send expired notification (on or after expiration)
        if (diffDays < 0) {
          const hasExpiredLog = certLogs.some(l => l.type === 'expired-alert');
          if (!hasExpiredLog) {
            await logNotification({
              certificateId: cert.id,
              employeeName: cert.employeeName,
              recipient: 'Manual (WhatsApp/SMS)',
              type: 'expired-alert',
              sentAt: new Date().toISOString(),
              expirationDate: cert.expirationDate,
              status: 'Sent'
            });
            
            triggerBrowserNotification(
              `☠️ Cumplimiento Crítico: ${cert.employeeName}`,
              `El certificado de salud venció el ${cert.expirationDate}. Se requiere acción inmediata.`
            );
            logsCreated = true;
          }
        }
      }
      
      if (logsCreated) {
        // Trigger screen refresh to reflect new logs or status changes
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error("Auto compliance scan failure:", err);
    }
  };

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    setCurrentView('dashboard');
  };

  const handleSyncRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            refreshTrigger={refreshTrigger} 
            onViewChange={(view) => setCurrentView(view)} 
          />
        );
      case 'intake':
        return (
          <Intake 
            onUploadSuccess={handleUploadSuccess} 
          />
        );
      case 'repository':
        return (
          <Repository 
            refreshTrigger={refreshTrigger} 
            onRecordDeleted={handleSyncRefresh} 
          />
        );
      case 'calendar':
        return (
          <CalendarView 
            refreshTrigger={refreshTrigger} 
            onRecordDeleted={handleSyncRefresh} 
          />
        );
      case 'notifications':
        return (
          <NotificationsLog 
            refreshTrigger={refreshTrigger} 
          />
        );
      case 'settings':
        return (
          <Settings 
            onDataReset={handleSyncRefresh} 
          />
        );
      default:
        return (
          <Dashboard 
            refreshTrigger={refreshTrigger} 
            onViewChange={(view) => setCurrentView(view)} 
          />
        );
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        currentView={currentView} 
        onViewChange={(view) => setCurrentView(view)} 
      />
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  );
}
