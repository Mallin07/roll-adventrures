// crear-personaje.js (selección de clase → Firestore)
import { saveFichaFS } from "../firebase.js";

const cards = document.querySelectorAll('.clase-card');
const info = document.getElementById('seleccion-info');
const form = document.getElementById('form-nombre');
const inputNombre = document.getElementById('nombrePJ');
const btnGuardar = document.getElementById('guardarPJ');
const err = document.getElementById('errNombre');

let claseSeleccionada = null;

/* ===== helpers ===== */
function normalizeClase(c){
  return String(c || "")
    .replace(/^\s*\(/, "")
    .replace(/\)\s*$/, "")
    .trim() || "Aventurero";
}
function baseForClass(clase){
  const BASE_BY_CLASS = {
    Guerrero: { fuerza:4, defensa:3, destreza:1, sabiduria:1, velocidad:2 },
    Mago:     { fuerza:1, defensa:1, destreza:2, sabiduria:4, velocidad:2 },
    Picaro:   { fuerza:2, defensa:2, destreza:4, sabiduria:1, velocidad:3 },
  };
  const DEFAULT_STATE = { fuerza:2, defensa:3, destreza:1, sabiduria:2, velocidad:2 };
  return BASE_BY_CLASS?.[clase] || DEFAULT_STATE;
}
function defaultFichaFor(pj){
  const off10 = () => Array.from({length:10}, ()=>false);
  const clase = normalizeClase(pj?.clase || "Aventurero");
  return {
    nombre: (pj?.nombre || "Personaje").trim(),
    clase,
    state: {
      ...baseForClass(clase),
      elemental:{ atk:{fuego:0,agua:0,tierra:0,aire:0}, def:{fuego:0,agua:0,tierra:0,aire:0} },
      mods:{ fuerza:0, defensa:0, destreza:0, sabiduria:0, velocidad:0 }
    },
    injured: [],
    pips: { vida: off10(), mana: off10(), hambre: off10() },
    slots: {}
  };
}
function makeId(){
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'pj_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
}

/* ===== UI selección de clase ===== */
cards.forEach(card => {
  const btn = card.querySelector('.btn-elegir');
  btn.addEventListener('click', () => {
    cards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    claseSeleccionada = normalizeClase(card.dataset.clase || card.querySelector('h3')?.textContent);
    const nombreClase = card.querySelector('h3')?.textContent || claseSeleccionada;
    info.textContent = `Clase seleccionada: ${nombreClase}`;

    form.classList.remove('oculto');
    err.textContent = '';
    inputNombre.value = '';
    inputNombre.focus();
  });
});

/* ===== Guardar personaje (único listener) ===== */
btnGuardar.addEventListener('click', async (e) => {
  e.preventDefault();
  const nombre = inputNombre.value.trim();

  if (!claseSeleccionada) { err.textContent = 'Primero elige una clase.'; return; }
  if (!nombre) { err.textContent = 'Escribe un nombre para tu personaje.'; inputNombre.focus(); return; }

  const id = makeId();
  const ficha = defaultFichaFor({ nombre, clase: claseSeleccionada });

  try {
    await saveFichaFS(id, ficha);           // ✅ crea/actualiza documento en "fichas/{id}"
    try { localStorage.setItem('active_pj', id); } catch {}
    window.location.href = '../personajes/personajes.html';
  } catch (e) {
    console.error('Error guardando ficha en Firestore:', e);
    err.textContent = 'No se pudo guardar la ficha en Firestore.';
  }
});
