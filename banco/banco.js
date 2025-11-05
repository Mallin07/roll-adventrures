// banco.js
import { loadFichaFS, saveFichaFS, loadBancoFS, saveBancoFS, storage } from "../firebase.js";

/* ========= utils DOM ========= */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ========= resolver personaje activo ========= */
function getPersonajesLocal() {
  try { return JSON.parse(localStorage.getItem('personajes') || '[]'); }
  catch { return []; }
}

const urlParams = new URLSearchParams(location.search);
let PJ_ID = urlParams.get('id') || localStorage.getItem('active_pj') || null;

if (!PJ_ID) {
  const lista = getPersonajesLocal();
  if (lista.length === 1) {
    PJ_ID = lista[0].id;
  } else if (lista.length > 1) {
    const msg = 'Selecciona personaje activo:\n' +
      lista.map((p,i)=> `${i+1}. ${p.nombre} (${p.clase})`).join('\n');
    const sel = prompt(msg);
    const idx = Number(sel) - 1;
    if (Number.isInteger(idx) && lista[idx]) PJ_ID = lista[idx].id;
  }
}

if (PJ_ID) {
  try { localStorage.setItem('active_pj', PJ_ID); } catch {}
} else {
  alert('No hay personaje activo. Ve a "Personajes" y abre una ficha para activarlo.');
  window.location.href = '../personajes/personajes.html';
  throw new Error('No active character');
}

/* ========= util: título “Mochila de …” ========= */
function setMochilaTitle(nombre){
  const h2 = document.querySelector('section:nth-of-type(2) h2');
  if (h2 && nombre) h2.textContent = `Mochila de ${nombre}`;
}
async function loadNombrePJ() {
  const lista = getPersonajesLocal();
  const pj = lista.find(x => x.id === PJ_ID);
  if (pj?.nombre) { setMochilaTitle(pj.nombre); return; }
  try {
    const ficha = await loadFichaFS(PJ_ID);
    if (ficha?.nombre) setMochilaTitle(ficha.nombre);
  } catch {}
}

/* ========= build grid (única) ========= */
function buildGrid(container){
  if (!container) return [];
  const rows = Number(container.dataset.rows || 4);
  const cols = Number(container.dataset.cols || 20);
  const prefix = (container.dataset.prefix || 'slot').trim();

  // Exponer filas/columnas al CSS para que la caja se adapte
  container.style.setProperty('--rows', rows);
  container.style.setProperty('--cols', cols);

  const els = [];
  let idx = 1;
  const frag = document.createDocumentFragment();
  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      const d = document.createElement('div');
      d.className = 'slot';
      d.dataset.slot = `${prefix}${idx++}`; // bank1.., bag1..
      d.title = '';
      frag.appendChild(d);
      els.push(d);
    }
  }
  container.innerHTML = '';
  container.appendChild(frag);
  return els;
}

/* ========= resolve URL (igual que ficha) ========= */
async function resolveURL(u){
  if (!u) return null;
  const s = String(u).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("gs://")){
    const { getDownloadURL, ref } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js");
    try { return await getDownloadURL(ref(storage, s)); }
    catch(e){ console.warn("No se pudo resolver gs://", s, e); return null; }
  }
  return s;
}

/* ========= tooltip ========= */
function buildItemTooltip(d){
  if (!d) return '';
  const lines = [];
  const title = d.name || 'Item';
  const tipo  = d.type || d.tipo || '';
  lines.push(`${title}${tipo ? ` — ${tipo}` : ''}`);
  const mods = d.mods || {}, atk = d.atk || {}, def = d.def || {};
  const skills = Array.isArray(d.skills) ? d.skills : [];
  const mk = Object.keys(mods).filter(k=>Number.isFinite(Number(mods[k])));
  if (mk.length) lines.push('Mods: ' + mk.map(k=>`${k}+${mods[k]}`).join(', '));
  const ak = Object.keys(atk).filter(k=>Number.isFinite(Number(atk[k])));
  if (ak.length) lines.push('ATK: ' + ak.map(k=>`${k}+${atk[k]}`).join(', '));
  const dk = Object.keys(def).filter(k=>Number.isFinite(Number(def[k])));
  if (dk.length) lines.push('DEF: ' + dk.map(k=>`${k}+${def[k]}`).join(', '));
  if (skills.length) lines.push('Habilidades: ' + skills.join(', '));
  if (d.description || d.descripcion) { lines.push(''); lines.push((d.description || d.descripcion).trim()); }
  return lines.join('\n');
}

/* ========= estado ========= */
const bankSlots = {}; // bank1..bank80 => item|null
const bagSlots  = {}; // bag1..bag9    => item|null (3x3)

/* ========= pintar slot ========= */
async function paintSlot(el, item){
  if (!el) return;
  if (!item) {
    el.style.backgroundImage = 'none';
    el.textContent = '';
    el.title = '';
    return;
  }
  const url = await resolveURL(item.url || null);
  if (url) { el.style.backgroundImage = `url("${url}")`; el.textContent = ''; }
  else { el.style.backgroundImage = 'none'; el.textContent = (item.name || '').slice(0,12); }
  el.title = buildItemTooltip(item);
}

/* ========= cargar datos ========= */
async function loadAll(){
  // Banco
  const bankDoc = await loadBancoFS(PJ_ID);
  if (bankDoc && bankDoc.slots) {
    Object.entries(bankDoc.slots).forEach(([k,v])=>{ bankSlots[k] = v || null; });
  }
  // Mochila: leer ficha y quedarnos con keys bag*
  const ficha = await loadFichaFS(PJ_ID);
  const allSlots = (ficha && ficha.slots) ? ficha.slots : {};
  Object.keys(allSlots).forEach(k=>{
    if (/^bag\d+$/i.test(k)) bagSlots[k] = allSlots[k] || null;
  });
}

/* ========= guardar ========= */
function stripUndefinedDeep(val){
  if (Array.isArray(val)) return val.map(stripUndefinedDeep).filter(v => v !== undefined);
  if (val && typeof val === 'object'){
    const out = {};
    for (const [k,v] of Object.entries(val)){
      const c = stripUndefinedDeep(v);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return val === undefined ? undefined : val;
}

async function saveBank(){
  const slots = {};
  for (const [k,v] of Object.entries(bankSlots)) slots[k] = v ? stripUndefinedDeep(v) : null;
  await saveBancoFS(PJ_ID, { slots });
}
async function saveBagMergeToFicha(){
  const ficha = await loadFichaFS(PJ_ID);
  const current = (ficha && ficha.slots) ? { ...ficha.slots } : {};
  for (const [k,v] of Object.entries(bagSlots)) {
    current[k] = v ? stripUndefinedDeep(v) : null;
  }
  await saveFichaFS(PJ_ID, { slots: current });
}

/* ========= UI selección/movimiento ========= */
let selectedEl = null;
function clearSelection(){
  if (selectedEl) selectedEl.classList.remove('is-selected');
  selectedEl = null;
}
function getStoreForEl(el){
  const key = el?.dataset?.slot || '';
  if (key.startsWith('bank')) return { store: bankSlots, type:'bank' };
  if (key.startsWith('bag'))  return { store: bagSlots,  type:'bag'  };
  return null;
}
async function onSlotClick(ev){
  const el = ev.currentTarget;
  const ctx = getStoreForEl(el);
  if (!ctx) return;

  // 1er clic: seleccionar
  if (!selectedEl){
    selectedEl = el;
    el.classList.add('is-selected');
    return;
  }

  // 2º clic: mover/intercambiar
  const fromEl = selectedEl;
  const toEl = el;
  clearSelection();

  const fromCtx = getStoreForEl(fromEl);
  const toCtx   = getStoreForEl(toEl);

  const fromKey = fromEl.dataset.slot;
  const toKey   = toEl.dataset.slot;

  const fromItem = fromCtx.store[fromKey] || null;
  const toItem   = toCtx.store[toKey] || null;

  // swap
  fromCtx.store[fromKey] = toItem || null;
  toCtx.store[toKey]     = fromItem || null;

  await paintSlot(fromEl, fromCtx.store[fromKey]);
  await paintSlot(toEl,   toCtx.store[toKey]);

  // Guardar lo mínimo necesario
  if (fromCtx.type === 'bank' || toCtx.type === 'bank') await saveBank();
  if (fromCtx.type === 'bag'  || toCtx.type === 'bag')  await saveBagMergeToFicha();
}

/* ========= init ========= */
(async function init(){
  const elsBank = buildGrid($('#grid-banco')); // bank1..bank80 (4x20)
  const elsBag  = buildGrid($('#grid-bag'));   // bag1..bag9 (3x3)

  await loadNombrePJ();
  await loadAll();

  // Pintar estado inicial
  await Promise.all(elsBank.map(el => paintSlot(el, bankSlots[el.dataset.slot] || null)));
  await Promise.all(elsBag.map(el  => paintSlot(el, bagSlots[el.dataset.slot]  || null)));

  // Enlazar clics
  [...elsBank, ...elsBag].forEach(el => el.addEventListener('click', onSlotClick));
})();
