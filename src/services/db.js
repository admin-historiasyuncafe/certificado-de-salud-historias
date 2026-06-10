import { 
  getFirestoreDb, 
  isFirebaseConfigured,
  setFirebaseConnectionError
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

// ── Image helpers: compress + convert Blob <-> base64 for Firestore storage ──
async function blobToBase64(blob) {
  const mime = blob.type || '';
  const isImage = mime.startsWith('image/');

  if (isImage) {
    // For images: compress via canvas (max 1200px wide, 80% JPEG quality)
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxW = 1200;
        let { width, height } = img;
        if (width > maxW) {
          height = Math.round((height * maxW) / width);
          width = maxW;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        // Fallback to direct FileReader if canvas fails
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Image encoding failed'));
        reader.readAsDataURL(blob);
      };
      img.src = url;
    });
  } else {
    // For PDFs and other file types: encode directly without canvas
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('File encoding failed'));
      reader.readAsDataURL(blob);
    });
  }
}

function base64ToBlob(base64DataUrl) {
  const [header, data] = base64DataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

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

  // Load all local certificates first to merge local-only fields (like imageBlob)
  let localCerts = [];
  try {
    const localDb = await openDatabase();
    localCerts = await new Promise((resolve, reject) => {
      const transaction = localDb.transaction('certificates', 'readonly');
      const store = transaction.objectStore('certificates');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (localErr) {
    console.warn('Could not read local DB for merging:', localErr);
  }

  const localCertsMap = new Map(localCerts.map(c => [c.id, c]));
  console.log("getAllCertificates: localCerts keys in IndexedDB:", Array.from(localCertsMap.keys()));

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      const certsCol = collection(db, 'certificates');
      const q = query(certsCol);
      // Timeout of 8s so a hanging Firestore call falls back to local DB
      const snapshot = await withTimeout(getDocs(q), 8000, 'Firestore read timeout');
      const certs = [];
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const newStatus = getCertificateStatus(data.expirationDate, today, warningPeriod);
        if (newStatus !== data.status) {
          data.status = newStatus;
          saveCertificateStatusInBackground(data.id, newStatus);
        }

        // Reconstruct imageBlob from Firestore base64 if available
        if (data.imageBase64 && !data.imageBlob) {
          try {
            data.imageBlob = base64ToBlob(data.imageBase64);
          } catch (e) {
            console.warn('Could not convert imageBase64 to Blob:', e);
          }
        }

        // Fallback: merge imageBlob from local IndexedDB if Firestore has none
        const localCert = localCertsMap.get(data.id);
        if (!data.imageBlob && localCert) {
          if (localCert.imageBlob) {
            let blob = localCert.imageBlob;
            if (localCert.imageBlob instanceof ArrayBuffer) {
              blob = new Blob([localCert.imageBlob], { type: localCert.imageType || 'image/png' });
            }
            data.imageBlob = blob;
          }
          if (localCert.imageName && !data.imageName) data.imageName = localCert.imageName;
          if (localCert.imageType && !data.imageType) data.imageType = localCert.imageType;
        }

        certs.push(data);
      });
      setFirebaseConnectionError(null);
      return certs;
    } catch (err) {
      console.error('Firestore read failed, falling back to local DB:', err.message);
      setFirebaseConnectionError(err.message || String(err));
    }
  }

  // Local fallback
  const updatedCerts = localCerts.map(cert => {
    const newStatus = getCertificateStatus(cert.expirationDate, today, warningPeriod);
    if (newStatus !== cert.status) {
      cert.status = newStatus;
      saveCertificateStatusInBackground(cert.id, newStatus);
    }
    return cert;
  });
  return updatedCerts;
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
        const data = docSnap.data();
        // Merge local imageBlob if available
        try {
          const localDb = await openDatabase();
          const localData = await new Promise((resolve, reject) => {
            const transaction = localDb.transaction('certificates', 'readonly');
            const store = transaction.objectStore('certificates');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          // First try Firestore base64
          if (data.imageBase64 && !data.imageBlob) {
            try { data.imageBlob = base64ToBlob(data.imageBase64); } catch(e) {}
          }
          // Fallback to local IndexedDB
          if (!data.imageBlob && localData && localData.imageBlob) {
            let blob = localData.imageBlob;
            if (localData.imageBlob instanceof ArrayBuffer) {
              blob = new Blob([localData.imageBlob], { type: localData.imageType || 'image/png' });
            }
            data.imageBlob = blob;
          }
        } catch (localErr) {
          console.warn('Could not merge local data in getCertificateById:', localErr);
        }
        return data;
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

// Helper: wraps a promise with a timeout
function withTimeout(promise, ms, timeoutMsg) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMsg)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
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

  // ── STEP 1: Fetch existing and save locally first (guarantees data is never lost) ──────
  try {
    const localDb = await openDatabase();
    
    // Read the existing document first to preserve image fields if they are missing/undefined in this update
    const existing = await new Promise((resolve) => {
      const transaction = localDb.transaction('certificates', 'readonly');
      const store = transaction.objectStore('certificates');
      const req = store.get(certificate.id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (existing) {
      if (!certificate.imageBlob && existing.imageBlob) {
        let blob = existing.imageBlob;
        if (existing.imageBlob instanceof ArrayBuffer) {
          blob = new Blob([existing.imageBlob], { type: existing.imageType || 'image/png' });
        }
        certificate.imageBlob = blob;
      }
      if (!certificate.imageName && existing.imageName) {
        certificate.imageName = existing.imageName;
      }
      if (!certificate.imageType && existing.imageType) {
        certificate.imageType = existing.imageType;
      }
      if (!certificate.imageUrl && existing.imageUrl) {
        certificate.imageUrl = existing.imageUrl;
      }
    }

    const localCertificate = { ...certificate };
    if (certificate.imageBlob instanceof Blob) {
      try {
        localCertificate.imageBlob = await certificate.imageBlob.arrayBuffer();
      } catch (err) {
        console.warn('Could not convert blob to arrayBuffer:', err);
      }
    }

    const transaction = localDb.transaction('certificates', 'readwrite');
    const store = transaction.objectStore('certificates');
    const putReq = store.put(localCertificate); // includes imageBlob as ArrayBuffer for local viewing
    putReq.onsuccess = () => console.log("saveCertificate: Saved locally to IndexedDB successfully:", {
      id: certificate.id,
      hasBlob: !!localCertificate.imageBlob,
      blobSize: localCertificate.imageBlob?.byteLength || 0
    });
    putReq.onerror = (e) => console.error("saveCertificate: Failed to save to IndexedDB:", e.target.error);
  } catch (localErr) {
    console.warn('Could not save locally in IndexedDB:', localErr);
  }

  if (isFirebaseConfigured()) {
    try {
      const firestoreDb = getFirestoreDb();
      
      // ── STEP 2: Convert imageBlob to base64 and store in Firestore directly ──
      if (certificate.imageBlob) {
        try {
          let blobToEncode = certificate.imageBlob;
          if (blobToEncode instanceof ArrayBuffer) {
            blobToEncode = new Blob([blobToEncode], { type: certificate.imageType || 'image/png' });
          }
          certificate.imageBase64 = await blobToBase64(blobToEncode);
          console.log('saveCertificate: imageBase64 encoded, length:', certificate.imageBase64.length);
        } catch (encodeErr) {
          console.warn('Could not encode image to base64:', encodeErr.message);
        }
      }
      
      // ── STEP 3: Save metadata + imageBase64 to Firestore (imageBlob excluded) ──
      const firestoreData = { ...certificate };
      delete firestoreData.imageBlob; // Firestore cannot store binary blobs

      const docRef = doc(firestoreDb, 'certificates', certificate.id);
      await withTimeout(
        setDoc(docRef, firestoreData),
        15000,
        'No se pudo conectar con la base de datos en la nube (timeout).'
      );

      return certificate;
    } catch (err) {
      const msg = err?.message || err?.code || String(err) || 'Error desconocido de Firebase';
      console.error('Error saving certificate in Firebase:', msg, err);
      console.info('Certificate was saved locally. Cloud sync failed:', msg);
      throw new Error(msg);
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
  // ── STEP 1: Always delete locally first ─────────────────────────────────────
  try {
    const localDb = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = localDb.transaction(['certificates', 'notifications'], 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      transaction.objectStore('certificates').delete(id);

      const notifStore = transaction.objectStore('notifications');
      const index = notifStore.index('certificateId');
      const req = index.openCursor(IDBKeyRange.only(id));
      req.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
    });
  } catch (localErr) {
    console.warn('Local IndexedDB delete failed:', localErr);
  }

  // ── STEP 2: Try to delete from Firestore (best-effort, non-blocking) ────────
  if (isFirebaseConfigured()) {
    try {
      const firestoreDb = getFirestoreDb();
      const docRef = doc(firestoreDb, 'certificates', id);

      // Delete from Firestore (imageBase64 is stored inline — no Storage cleanup needed)
      await withTimeout(deleteDoc(docRef), 8000, 'Firestore delete timeout');

      // Clean notifications from Firestore (best-effort)
      try {
        const notifsCol = collection(firestoreDb, 'notifications');
        const notifsSnapshot = await withTimeout(getDocs(notifsCol), 8000, 'Notifications fetch timeout');
        for (const notifDoc of notifsSnapshot.docs) {
          if (notifDoc.data().certificateId === id) {
            await deleteDoc(doc(firestoreDb, 'notifications', notifDoc.id));
          }
        }
      } catch (notifErr) {
        console.warn('Could not delete notifications from Firestore:', notifErr.message);
      }
    } catch (err) {
      console.warn('Firestore delete failed (local delete succeeded):', err.message);
    }
  }

  return true;
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

// Delete a single notification log
export async function deleteNotificationLog(id) {
  // ── STEP 1: Delete locally first ──
  try {
    const localDb = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = localDb.transaction('notifications', 'readwrite');
      const store = transaction.objectStore('notifications');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (localErr) {
    console.warn('Local IndexedDB delete notification failed:', localErr);
  }

  // ── STEP 2: Try to delete from Firestore ──
  if (isFirebaseConfigured()) {
    try {
      const firestoreDb = getFirestoreDb();
      const docRef = doc(firestoreDb, 'notifications', id);
      await withTimeout(deleteDoc(docRef), 8000, 'Firestore delete notification timeout');
    } catch (err) {
      console.warn('Firestore delete notification failed (local delete succeeded):', err.message);
    }
  }

  return true;
}

