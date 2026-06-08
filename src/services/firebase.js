import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

let app = null;
let db = null;
let storage = null;

export function getFirebaseConfig() {
  const localConfig = localStorage.getItem('firebase_config');
  if (localConfig) {
    try {
      return JSON.parse(localConfig);
    } catch (e) {
      console.error('Error al decodificar la configuración de Firebase en localStorage:', e);
    }
  }
  // Configuración predeterminada proporcionada por el usuario
  return {
    apiKey: "AIzaSyARgNWxgx6l5OWRzKRam-xrbOh94XXrlMM",
    authDomain: "docuhistorias-db.firebaseapp.com",
    projectId: "docuhistorias-db",
    storageBucket: "docuhistorias-db.firebasestorage.app",
    messagingSenderId: "512184671483",
    appId: "1:512184671483:web:5352e8eddfdf97124d645e",
    measurementId: "G-8JM1DQ26ZS"
  };
}

export function initFirebase() {
  const config = getFirebaseConfig();
  if (!config || !config.projectId || !config.apiKey) {
    app = null;
    db = null;
    storage = null;
    return null;
  }
  
  try {
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    db = getFirestore(app);
    storage = getStorage(app);
    return { app, db, storage };
  } catch (error) {
    console.error('Error al inicializar Firebase:', error);
    app = null;
    db = null;
    storage = null;
    return null;
  }
}

// Inicialización inicial
initFirebase();

export function getFirestoreDb() {
  if (!db) {
    initFirebase();
  }
  return db;
}

export function getFirebaseStorageInstance() {
  if (!storage) {
    initFirebase();
  }
  return storage;
}

let connectionError = null;

export function setFirebaseConnectionError(err) {
  connectionError = err;
}

export function getFirebaseConnectionError() {
  return connectionError;
}

export function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return config && config.projectId && config.apiKey && db !== null;
}
