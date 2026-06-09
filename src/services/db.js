import { 
  getFirestoreDb, 
  getFirebaseStorageInstance, 
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

        // Merge local data (especially imageBlob) into the Firestore data
        const localCert = localCertsMap.get(data.id);
        console.log(`getAllCertificates merging diagnostic for ${data.id} (${data.employeeName}):`, {
          hasLocalCert: !!localCert,
          localHasBlob: localCert ? !!localCert.imageBlob : false,
          localBlobSize: localCert?.imageBlob ? (localCert.imageBlob instanceof ArrayBuffer ? localCert.imageBlob.byteLength : localCert.imageBlob.size) : 0,
          dataHasBlob: !!data.imageBlob,
          dataHasImageUrl: !!data.imageUrl
        });

        if (localCert) {
          if (localCert.imageBlob && !data.imageBlob) {
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
          if (localData && localData.imageBlob) {
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
      
      // ── STEP 2: Try uploading image to Firebase Storage (with 8s timeout) ──
      if (certificate.imageBlob) {
        try {
          const storage = getFirebaseStorageInstance();
          const storageRef = ref(storage, `certificates/${certificate.id}_${certificate.imageName || 'image.png'}`);
          await withTimeout(
            uploadBytes(storageRef, certificate.imageBlob),
            8000,
            'El tiempo de subida de la imagen expiró. Se guardará el registro sin imagen en la nube.'
          );
          const downloadUrl = await withTimeout(
            getDownloadURL(storageRef),
            5000,
            'No se pudo obtener la URL de la imagen.'
          );
          certificate.imageUrl = downloadUrl;

          // Write updated certificate (with imageUrl) back to IndexedDB
          try {
            const localDb = await openDatabase();
            const transaction = localDb.transaction('certificates', 'readwrite');
            const store = transaction.objectStore('certificates');
            const localCertificateUpdate = { ...certificate };
            if (certificate.imageBlob instanceof Blob) {
              localCertificateUpdate.imageBlob = await certificate.imageBlob.arrayBuffer();
            }
            store.put(localCertificateUpdate);
          } catch (localErr) {
            console.warn('Could not update local IndexedDB with imageUrl:', localErr);
          }
        } catch (storageErr) {
          // Storage failed or timed out — log and continue without remote image
          console.warn('Storage skipped:', storageErr.message);
          // If we already have a remote imageUrl (e.g. from previous upload), keep it!
          // Only reset to null if we don't have one.
          if (!certificate.imageUrl) {
            certificate.imageUrl = null;
          }
        }
      }
      
      // ── STEP 3: Save metadata to Firestore (imageBlob excluded) ──────────
      const firestoreData = { ...certificate };
      delete firestoreData.imageBlob; // Firestore cannot store binary blobs
      console.log("saveCertificate: saving metadata to Firestore:", JSON.stringify(firestoreData, null, 2));

      const docRef = doc(firestoreDb, 'certificates', certificate.id);
      await withTimeout(
        setDoc(docRef, firestoreData),
        10000,
        'No se pudo conectar con la base de datos en la nube (timeout).'
      );

      return certificate;
    } catch (err) {
      const msg = err?.message || err?.code || String(err) || 'Error desconocido de Firebase';
      console.error('Error saving certificate in Firebase:', msg, err);
      // Even if Firestore failed, the record IS saved locally — don't block the user
      console.info('Certificate was saved locally. Cloud sync failed:', msg);
      // Re-throw so the UI can show the specific error
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

      // Try to get the doc to find its image URL (8s timeout)
      try {
        const docSnap = await withTimeout(getDoc(docRef), 8000, 'getDoc timeout');
        if (docSnap.exists()) {
          const certData = docSnap.data();
          if (certData.imageUrl) {
            try {
              const storage = getFirebaseStorageInstance();
              const storageRef = ref(storage, `certificates/${id}_${certData.imageName || 'image.png'}`);
              await withTimeout(deleteObject(storageRef), 8000, 'Storage delete timeout');
            } catch (storageErr) {
              console.warn('Storage delete skipped:', storageErr.message);
            }
          }
        }
      } catch (getErr) {
        console.warn('Could not fetch doc before delete (skipping Storage cleanup):', getErr.message);
      }

      // Delete from Firestore
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
      // Firestore failed (permission, timeout, network) — local delete already done
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
