const DB_NAME = 'HealthCertificatesDB';
const DB_VERSION = 1;

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Object store for certificates
      if (!db.objectStoreNames.contains('certificates')) {
        const certStore = db.createObjectStore('certificates', { keyPath: 'id' });
        certStore.createIndex('employeeName', 'employeeName', { unique: false });
        certStore.createIndex('expirationDate', 'expirationDate', { unique: false });
        certStore.createIndex('status', 'status', { unique: false });
      }

      // Object store for logs (notifications log)
      if (!db.objectStoreNames.contains('notifications')) {
        const logStore = db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
        logStore.createIndex('certificateId', 'certificateId', { unique: false });
        logStore.createIndex('sentAt', 'sentAt', { unique: false });
      }
    };
  });
}

// Get all certificates
export async function getAllCertificates() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('certificates', 'readonly');
    const store = transaction.objectStore('certificates');
    const request = store.getAll();

    request.onsuccess = () => {
      // Refresh dynamic status based on current date before returning
      const today = new Date().toISOString().split('T')[0];
      const warningPeriod = parseInt(localStorage.getItem('warning_period') || '14', 10);

      const updatedCerts = request.result.map(cert => {
        const newStatus = getCertificateStatus(cert.expirationDate, today, warningPeriod);
        if (newStatus !== cert.status) {
          cert.status = newStatus;
          // We don't block on writing it back, but let's save the sync update in background
          saveCertificateStatusInBackground(cert.id, newStatus);
        }
        return cert;
      });

      resolve(updatedCerts);
    };

    request.onerror = () => reject(request.error);
  });
}

// Helper function to save updated status
async function saveCertificateStatusInBackground(id, status) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction('certificates', 'readwrite');
    const store = transaction.objectStore('certificates');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const cert = getReq.result;
      if (cert) {
        cert.status = status;
        store.put(cert);
      }
    };
  } catch (err) {
    console.error('Failed to sync status in DB:', err);
  }
}

// Helper to determine status
export function getCertificateStatus(expirationDate, today, warningPeriod) {
  if (!expirationDate) return 'active';
  
  const exp = new Date(expirationDate);
  const tod = new Date(today);
  
  // Reset hours to compare dates accurately
  exp.setHours(0, 0, 0, 0);
  tod.setHours(0, 0, 0, 0);

  const diffTime = exp - tod;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'expired';
  } else if (diffDays <= warningPeriod) {
    return 'expiring';
  } else {
    return 'active';
  }
}

// Get certificate by ID
export async function getCertificateById(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('certificates', 'readonly');
    const store = transaction.objectStore('certificates');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Add or update certificate
export async function saveCertificate(certificate) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('certificates', 'readwrite');
    const store = transaction.objectStore('certificates');
    
    // Automatically set ID if not present
    if (!certificate.id) {
      certificate.id = 'cert_' + Math.random().toString(36).substr(2, 9);
    }
    
    if (!certificate.uploadedAt) {
      certificate.uploadedAt = new Date().toISOString();
    }

    const today = new Date().toISOString().split('T')[0];
    const warningPeriod = parseInt(localStorage.getItem('warning_period') || '14', 10);
    certificate.status = getCertificateStatus(certificate.expirationDate, today, warningPeriod);

    const request = store.put(certificate);

    request.onsuccess = () => resolve(certificate);
    request.onerror = () => reject(request.error);
  });
}

// Delete certificate
export async function deleteCertificate(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['certificates', 'notifications'], 'readwrite');
    
    // Delete certificate
    const certStore = transaction.objectStore('certificates');
    certStore.delete(id);

    // Delete associated notifications in background
    const notifStore = transaction.objectStore('notifications');
    const index = notifStore.index('certificateId');
    const request = index.openCursor(IDBKeyRange.only(id));
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

// Log notifications
export async function logNotification(notification) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notifications', 'readwrite');
    const store = transaction.objectStore('notifications');
    const request = store.add(notification);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get notification logs
export async function getNotificationLogs() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notifications', 'readonly');
    const store = transaction.objectStore('notifications');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)));
    request.onerror = () => reject(request.error);
  });
}
