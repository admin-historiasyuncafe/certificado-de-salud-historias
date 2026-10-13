import { 
  getFirestoreDb, 
  isFirebaseConfigured 
} from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';

export const DEFAULT_PASSWORD_KEY = 'docu_app_password';
export const DEFAULT_PASSWORD     = 'Paboncosme01!!';

const SETTINGS_COLLECTION = 'app_settings';
const AUTH_DOC_ID = 'auth';

function sanitizePassword(pwd) {
  if (!pwd || pwd === 'Pabonscosme01!!') {
    return DEFAULT_PASSWORD;
  }
  return pwd;
}

// Helper: timeout wrapper
function withTimeout(promise, ms, errorMsg) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Returns current locally cached password (fast, synchronous fallback)
 */
export function getLocalPassword() {
  try {
    const stored = localStorage.getItem(DEFAULT_PASSWORD_KEY);
    return sanitizePassword(stored);
  } catch (e) {
    return DEFAULT_PASSWORD;
  }
}

/**
 * Fetches the master password from Firestore and updates localStorage.
 * If the doc does not exist yet, initializes it in Firestore with the current password.
 */
export async function getAppPassword() {
  const localPwd = getLocalPassword();

  if (!isFirebaseConfigured()) {
    return localPwd;
  }

  try {
    const db = getFirestoreDb();
    if (!db) return localPwd;

    const authRef = doc(db, SETTINGS_COLLECTION, AUTH_DOC_ID);
    const snap = await withTimeout(getDoc(authRef), 6000, 'Firestore auth fetch timeout');

    if (snap.exists() && snap.data()?.password) {
      const cloudPwd = sanitizePassword(snap.data().password);
      try {
        localStorage.setItem(DEFAULT_PASSWORD_KEY, cloudPwd);
      } catch (e) {}
      return cloudPwd;
    }

    // Doc does not exist yet in Firestore — initialize it with current password
    try {
      await withTimeout(
        setDoc(authRef, {
          password: localPwd,
          updatedAt: new Date().toISOString(),
          initialSetup: true
        }, { merge: true }),
        6000,
        'Firestore init auth timeout'
      );
    } catch (initErr) {
      console.warn('Could not initialize cloud password doc:', initErr);
    }

    return localPwd;
  } catch (err) {
    console.warn('Error reading cloud password, using local fallback:', err?.message || err);
    return localPwd;
  }
}

/**
 * Saves a new password to both Firestore (cloud) and localStorage (local).
 * All devices subscribed or querying Firestore will receive the new password.
 */
export async function saveAppPassword(newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }

  // 1. Save to local storage immediately
  try {
    localStorage.setItem(DEFAULT_PASSWORD_KEY, newPassword);
  } catch (e) {}

  // 2. Sync to Firestore in the cloud
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        const authRef = doc(db, SETTINGS_COLLECTION, AUTH_DOC_ID);
        await withTimeout(
          setDoc(authRef, {
            password: newPassword,
            updatedAt: new Date().toISOString()
          }, { merge: true }),
          8000,
          'Tiempo de espera agotado al guardar en la nube (Firestore)'
        );
      }
    } catch (err) {
      console.error('Error saving password to cloud:', err);
      throw new Error(`Se guardó localmente, pero falló la sincronización en la nube: ${err.message || 'Error de red'}`);
    }
  }

  return true;
}

/**
 * Verifies entered password against local cached and, if needed, directly against Firestore.
 */
export async function verifyAppPassword(enteredPassword) {
  const localPwd = getLocalPassword();
  if (enteredPassword === localPwd) {
    return true;
  }

  // If local check failed, another device may have changed it recently.
  // Refresh from cloud before concluding it is wrong:
  try {
    const cloudPwd = await getAppPassword();
    if (enteredPassword === cloudPwd) {
      return true;
    }
  } catch (e) {}

  return false;
}

/**
 * Real-time listener for password changes across devices.
 * Calls callback(password) whenever the cloud password updates.
 * Returns unsubscribe function.
 */
export function subscribeToAppPassword(callback) {
  if (!isFirebaseConfigured()) {
    return () => {};
  }

  try {
    const db = getFirestoreDb();
    if (!db) return () => {};

    const authRef = doc(db, SETTINGS_COLLECTION, AUTH_DOC_ID);
    return onSnapshot(
      authRef,
      (docSnap) => {
        if (docSnap.exists() && docSnap.data()?.password) {
          const cloudPwd = sanitizePassword(docSnap.data().password);
          try {
            localStorage.setItem(DEFAULT_PASSWORD_KEY, cloudPwd);
          } catch (e) {}
          if (typeof callback === 'function') {
            callback(cloudPwd);
          }
        }
      },
      (error) => {
        console.warn('Real-time password listener warning:', error?.message || error);
      }
    );
  } catch (err) {
    console.warn('Could not establish real-time password listener:', err);
    return () => {};
  }
}
