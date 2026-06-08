import { 
  getFirestoreDb, 
  getFirebaseStorageInstance, 
  isFirebaseConfigured 
} from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  query,
  updateDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

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
  const today = new Date().toISOString().split('T')[0];
  const warningPeriod = parseInt(localStorage.getItem('warning_period') || '14', 10);

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      const certsCol = collection(db, 'certificates');
      const q = query(certsCol);
      const snapshot = await getDocs(q);
      const certs = [];
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Refresh dynamic status based on current date
        const newStatus = getCertificateStatus(data.expirationDate, today, warningPeriod);
        if (newStatus !== data.status) {
          data.status = newStatus;
          saveCertificateStatusInBackground(data.id, newStatus);
        }
        certs.push(data);
      });
      return certs;
    } catch (err) {
      console.error('Error fetching certificates from Firestore, falling back to local DB:', err);
    }
  }

  // Local fallback
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('certificates', 'readonly');
    const store = transaction.objectStore('certificates');
    const request = store.getAll();

    request.onsuccess = () => {
      const updatedCerts = request.result.map(cert => {
        const newStatus = getCertificateStatus(cert.expirationDate, today, warningPeriod);
        if (newStatus !== cert.status) {
          cert.status = newStatus;
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
    if (isFirebaseConfigured()) {
      const db = getFirestoreDb();
      const docRef = doc(db, 'certificates', id);
      await updateDoc(docRef, { status });
      return;
    }

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
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      const docRef = doc(db, 'certificates', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (err) {
      console.error('Error fetching certificate from Firestore:', err);
    }
  }

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
  if (!certificate.id) {
    certificate.id = 'cert_' + Math.random().toString(36).substr(2, 9);
  }
  
  if (!certificate.uploadedAt) {
    certificate.uploadedAt = new Date().toISOString();
  }

  const today = new Date().toISOString().split('T')[0];
  const warningPeriod = parseInt(localStorage.getItem('warning_period') || '14', 10);
  certificate.status = getCertificateStatus(certificate.expirationDate, today, warningPeriod);

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      
      // If there's an image file to upload
      if (certificate.imageBlob) {
        const storage = getFirebaseStorageInstance();
        const storageRef = ref(storage, `certificates/${certificate.id}_${certificate.imageName || 'image.png'}`);
        await uploadBytes(storageRef, certificate.imageBlob);
        const downloadUrl = await getDownloadURL(storageRef);
        certificate.imageUrl = downloadUrl;
      }
      
      // Remove imageBlob from document structure before sending to Firestore
      const firestoreData = { ...certificate };
      delete firestoreData.imageBlob;

      const docRef = doc(db, 'certificates', certificate.id);
      await setDoc(docRef, firestoreData);
      
      // Also cache locally in IndexedDB as a fallback
      try {
        const localDb = await openDatabase();
        const transaction = localDb.transaction('certificates', 'readwrite');
        const store = transaction.objectStore('certificates');
        store.put(certificate);
      } catch (localErr) {
        console.warn('Could not cache locally in IndexedDB:', localErr);
      }

      return certificate;
    } catch (err) {
      console.error('Error saving certificate in Firebase:', err);
      throw err;
    }
  }

  // Default IndexedDB behavior
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('certificates', 'readwrite');
    const store = transaction.objectStore('certificates');
    const request = store.put(certificate);

    request.onsuccess = () => resolve(certificate);
    request.onerror = () => reject(request.error);
  });
}

// Delete certificate
export async function deleteCertificate(id) {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      const docRef = doc(db, 'certificates', id);
      
      // Get image details to remove from Firebase Storage if it exists
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const certData = docSnap.data();
        if (certData.imageUrl) {
          try {
            const storage = getFirebaseStorageInstance();
            const storageRef = ref(storage, `certificates/${id}_${certData.imageName || 'image.png'}`);
            await deleteObject(storageRef);
          } catch (storageErr) {
            console.warn('Could not delete image from Firebase Storage:', storageErr);
          }
        }
      }

      // Delete from Firestore
      await deleteDoc(docRef);

      // Clean up notifications linked to this certificate in Firestore
      const notifsCol = collection(db, 'notifications');
      const notifsSnapshot = await getDocs(notifsCol);
      for (const notifDoc of notifsSnapshot.docs) {
        const notifData = notifDoc.data();
        if (notifData.certificateId === id) {
          await deleteDoc(doc(db, 'notifications', notifDoc.id));
        }
      }

      // Also clean up local IndexedDB
      try {
        const localDb = await openDatabase();
        const transaction = localDb.transaction(['certificates', 'notifications'], 'readwrite');
        
        const certStore = transaction.objectStore('certificates');
        certStore.delete(id);

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
      } catch (localErr) {
        console.warn('Failed to clean up local IndexedDB cache:', localErr);
      }

      return true;
    } catch (err) {
      console.error('Error deleting from Firebase:', err);
      throw err;
    }
  }

  // Local fallback
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['certificates', 'notifications'], 'readwrite');
    
    // Delete certificate
    const certStore = transaction.objectStore('certificates');
    certStore.delete(id);

    // Delete associated notifications
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
  const notifId = 'notif_' + Math.random().toString(36).substr(2, 9);
  const notifData = { id: notifId, ...notification };

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      const docRef = doc(db, 'notifications', notifId);
      await setDoc(docRef, notifData);
      
      // Also cache locally in IndexedDB
      try {
        const localDb = await openDatabase();
        const transaction = localDb.transaction('notifications', 'readwrite');
        const store = transaction.objectStore('notifications');
        store.put(notifData);
      } catch (localErr) {
        console.warn('Could not cache notification locally:', localErr);
      }

      return notifId;
    } catch (err) {
      console.error('Error saving notification in Firebase:', err);
    }
  }

  // Local fallback
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
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      const notifsCol = collection(db, 'notifications');
      const snapshot = await getDocs(notifsCol);
      const logs = [];
      
      snapshot.forEach(docSnap => {
        logs.push(docSnap.data());
      });
      return logs.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    } catch (err) {
      console.error('Error fetching notification logs from Firebase:', err);
    }
  }

  // Local fallback
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notifications', 'readonly');
    const store = transaction.objectStore('notifications');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)));
    request.onerror = () => reject(request.error);
  });
}
