import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref as sRef, getDownloadURL, uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
// 👇 NUEVO: Auth
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// TU CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAwAGqnbQUHZej6xoltfzjJp2svsHZ3rYU",
  authDomain: "roll-adventures.firebaseapp.com",
  databaseURL: "https://roll-adventures-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "roll-adventures",
  storageBucket: "roll-adventures.firebasestorage.app",
  messagingSenderId: "277923155977",
  appId: "1:277923155977:web:4ba0d494ac0ce395e128d8",
  measurementId: "G-QE5BYBJ8XN"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

// 👇 NUEVO: instancia de Auth
export const auth = getAuth(app);

// ====== Helpers FIRESTORE ======

export async function getItemByName(nombre) {
  const q = query(collection(db, "items"), where("name", "==", nombre.toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  return data;
}

export async function saveFichaFS(personajeId, payload) {
  if (!personajeId) throw new Error("saveFichaFS: personajeId requerido");
  await setDoc(doc(db, "fichas", personajeId), payload, { merge: true });
}

export async function loadFichaFS(personajeId) {
  if (!personajeId) throw new Error("loadFichaFS: personajeId requerido");
  const d = await getDoc(doc(db, "fichas", personajeId));
  return d.exists() ? d.data() : null;
}

// ====== Helpers STORAGE (opcional) ======
export async function uploadItemImage(file, nombreArchivo) {
  const ref = sRef(storage, `items/${nombreArchivo}`);
  await uploadBytes(ref, file);
  return await getDownloadURL(ref);
}

export async function saveBancoFS(personajeId, payload) {
  if (!personajeId) throw new Error("saveBancoFS: personajeId requerido");
  await setDoc(doc(db, "bancos", personajeId), payload, { merge: true });
}

export async function loadBancoFS(personajeId) {
  if (!personajeId) throw new Error("loadBancoFS: personajeId requerido");
  const d = await getDoc(doc(db, "bancos", personajeId));
  return d.exists() ? d.data() : null;
}

// 👇 OPCIONAL: re-exportar helpers de auth por comodidad
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
};
