
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref as sRef, getDownloadURL, uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// TU CONFIG (copia/pega la de la consola Firebase)
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

// ====== Helpers FIRESTORE ======

// Buscar item por nombre (colección 'items')
export async function getItemByName(nombre) {
  const q = query(collection(db, "items"), where("name", "==", nombre.toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  return data; // { name, imageURL, mods, atk, def, ... }
}

// Guardar ficha por personaje (colección 'fichas', doc id = personajeId)
export async function saveFichaFS(personajeId, payload) {
  if (!personajeId) throw new Error("saveFichaFS: personajeId requerido");
  await setDoc(doc(db, "fichas", personajeId), payload, { merge: true });
}

// Cargar ficha por personaje
export async function loadFichaFS(personajeId) {
  if (!personajeId) throw new Error("loadFichaFS: personajeId requerido");
  const d = await getDoc(doc(db, "fichas", personajeId));
  return d.exists() ? d.data() : null;
}

// ====== Helpers STORAGE (opcional) ======
// Subir un archivo de imagen (Blob/File) a 'items/<nombreArchivo>'
export async function uploadItemImage(file, nombreArchivo) {
  const ref = sRef(storage, `items/${nombreArchivo}`);
  await uploadBytes(ref, file);
  return await getDownloadURL(ref);
}

// Guarda el banco del personaje en 'bancos/{personajeId}'
export async function saveBancoFS(personajeId, payload) {
  if (!personajeId) throw new Error("saveBancoFS: personajeId requerido");
  await setDoc(doc(db, "bancos", personajeId), payload, { merge: true });
}

// Carga el banco del personaje
export async function loadBancoFS(personajeId) {
  if (!personajeId) throw new Error("loadBancoFS: personajeId requerido");
  const d = await getDoc(doc(db, "bancos", personajeId));
  return d.exists() ? d.data() : null; // { slots: { bank1: {...}, bank2: null, ... } }
}
