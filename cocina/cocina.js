// cocina/cocina.js
import {
  loadFichaFS, saveFichaFS,
  loadBancoFS, saveBancoFS,
  storage, getItemByName
} from "../firebase.js";

/* ===== utils DOM ===== */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ===== personaje activo (igual que banco.js) ===== */
function getPersonajesLocal() {
  try { return JSON.parse(localStorage.getItem('personajes') || '[]'); } catch { return []; }
}
const urlParams = new URLSearchParams(location.search);
let PJ_ID = urlParams.get('id') || localStorage.getItem('active_pj') || null;

if (!PJ_ID) {
  const lista = getPersonajesLocal();
  if (lista.length === 1) PJ_ID = lista[0].id;
  else if (lista.length > 1) {
    const msg = 'Selecciona personaje activo:\n' +
      lista.map((p,i)=> `${i+1}. ${p.nombre} (${p.clase})`).join('\n');
    const sel = prompt(msg);
    const idx = Number(sel) - 1;
    if (Number.isInteger(idx) && lista[idx]) PJ_ID = lista[idx].id;
  }
}
if (PJ_ID) { try { localStorage.setItem('active_pj', PJ_ID); } catch {} }
else {
  alert('No hay personaje activo. Ve a "Personajes" y abre una ficha para activarlo.');
  window.location.href = '../personajes/personajes.html';
  throw new Error('No active character');
}

/* ===== título con nombre ===== */
(function setNombrePJ(){
  const h = $('#pj-name');
  const lista = getPersonajesLocal();
  const pj = lista.find(x=>x.id===PJ_ID);
  if (h && pj?.nombre) h.textContent = pj.nombre;
})();

/* ===== build grid ===== */
function buildGrid(container){
  if (!container) return [];
  const rows = Number(container.dataset.rows || 1);
  const cols = Number(container.dataset.cols || 1);
  const prefix = (container.dataset.prefix || 'slot').trim();

  container.style.setProperty('--rows', rows);
  container.style.setProperty('--cols', cols);

  const els = [];
  const frag = document.createDocumentFragment();
  let idx = 1;
  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      const d = document.createElement('div');
      d.className = 'slot';
      d.dataset.slot = `${prefix}${idx++}`; // bank1.., cook1.., cook_out1
      d.title = '';
      frag.appendChild(d);
      els.push(d);
    }
  }
  container.innerHTML = '';
  container.appendChild(frag);
  return els;
}

/* ===== resolver URL ===== */
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

/* ===== tooltip ===== */
function buildItemTooltip(d){
  if (!d) return '';
  const lines = [];
  const title = d.name || 'Item';
  const tipo  = d.type || d.tipo || '';
  const food  = foodClassOf(d);
  lines.push(`${title}${tipo ? ` — ${tipo}` : ''}${food ? ` [${food}]` : ''}`);
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

/* ===== estado ===== */
const bankSlots = {};     // bank*
const cookSlots = {};     // cook1..cook4
const outSlot   = {};     // { cook_out1: item|null }

/* ===== pintar ===== */
async function paintSlot(el, item){
  if (!el) return;
  if (!item) {
    el.style.backgroundImage = 'none';
    el.textContent = '';
    el.title = el.classList.contains('is-locked') ? (el.title || 'Bloqueado') : '';
    return;
  }
  const url = await resolveURL(item.url || item.imageURL || null);
  if (url) { el.style.backgroundImage = `url("${url}")`; el.textContent = ''; }
  else { el.style.backgroundImage = 'none'; el.textContent = (item.name || '').slice(0,12); }
  el.title = buildItemTooltip(item);
}

/* ===== helpers alimento ===== */
function norm(str){ return String(str||'').trim().toLowerCase(); }

/** Devuelve 'carne' | 'pescado' | 'condimento' | null */
function foodClassOf(item){
  const cands = [
    item?.foodClass, item?.food_class, item?.food, item?.categoria,
    item?.category, item?.clase, item?.tipo, item?.type
  ].map(norm);

  for (const v of cands){
    if (v === 'carne' || v === 'pescado' || v === 'condimento') return v;
    // por si guardas 'meat', 'fish', 'seasoning'
    if (v === 'meat') return 'carne';
    if (v === 'fish') return 'pescado';
    if (v === 'seasoning' || v === 'spice') return 'condimento';
  }
  return null;
}

/** Si el item no trae foodClass, intenta recuperarlo de Firestore por nombre */
async function ensureFoodMeta(item){
  if (!item) return item;
  if (foodClassOf(item)) return item;
  const name = item.name || item.namelower || '';
  if (!name) return item;
  try {
    const fsItem = await getItemByName(name);
    if (fsItem) return { ...item, ...fsItem }; // merge metadata (foodClass, etc.)
  } catch(e){ console.warn('getItemByName error', e); }
  return item;
}

/* ===== reglas de desbloqueo/validación ===== */
function cookRuleState(){
  const s1 = cookSlots.cook1 || null;
  const s2 = cookSlots.cook2 || null;
  const s3 = cookSlots.cook3 || null;
  const s4 = cookSlots.cook4 || null;

  const f1 = foodClassOf(s1); // carne/pescado o null
  const ok1 = !!(s1 && (f1 === 'carne' || f1 === 'pescado'));

  const unlocked2 = ok1;
  const ok2 = unlocked2 && s2 && foodClassOf(s2) === 'condimento';

  const unlocked3 = ok2;
  const f3 = foodClassOf(s3);
  const ok3 = unlocked3 && s3 && (f3 === 'condimento' || f3 === f1);

  const unlocked4 = ok3;
  const f4 = foodClassOf(s4);
  const ok4 = unlocked4 && s4 && (f4 === 'condimento' || f4 === f1);

  return { f1, ok1, unlocked2, ok2, unlocked3, ok3, unlocked4, ok4 };
}

function allowedForSlot(slotKey){
  const st = cookRuleState();
  switch (slotKey) {
    case 'cook1': return { unlocked: true,  allow: ['carne','pescado'], reason: 'Primero: carne o pescado' };
    case 'cook2': return { unlocked: st.unlocked2, allow: ['condimento'], reason: 'Segundo: condimento' };
    case 'cook3':
      if (!st.unlocked3) return { unlocked:false, allow:[], reason:'Bloqueado hasta poner condimento en 2' };
      return { unlocked:true, allow: ['condimento', st.f1].filter(Boolean), reason:`Tercero: condimento o ${st.f1}` };
    case 'cook4':
      if (!st.unlocked4) return { unlocked:false, allow:[], reason:'Bloqueado hasta llenar el 3' };
      return { unlocked:true, allow: ['condimento', st.f1].filter(Boolean), reason:`Cuarto: condimento o ${st.f1}` };
    default:
      return { unlocked:true, allow:[], reason:'' };
  }
}

/** Valida si item puede colocarse en slot de cocina */
async function canPlaceInCook(slotKey, item){
  const meta = await ensureFoodMeta(item);
  const cls  = foodClassOf(meta);
  const rule = allowedForSlot(slotKey);
  if (!rule.unlocked) return { ok:false, reason: rule.reason };
  if (!cls) return { ok:false, reason: 'No es un alimento válido (carne/pescado/condimento).' };
  if (rule.allow.length && !rule.allow.includes(cls)) {
    return { ok:false, reason: `Aquí solo puedes: ${rule.allow.join(' o ')}` };
  }
  return { ok:true, item: meta };
}

/** Bloquea/desbloquea visualmente y pone tooltips */
function updateCookLocksUI(){
  ['cook1','cook2','cook3','cook4'].forEach(k=>{
    const el = document.querySelector(`.slot[data-slot="${k}"]`);
    if (!el) return;
    const rule = allowedForSlot(k);
    el.classList.toggle('is-locked', !rule.unlocked);
    if (!rule.unlocked) el.title = `Bloqueado: ${rule.reason}`;
    else if (!cookSlots[k]) el.title = rule.reason;
  });
}

/** Si las reglas quedan rotas (p.ej. cambias cook1), limpia slots posteriores inválidos */
async function enforceCookConsistency(){
  const st = cookRuleState();

  // cook2 inválido
  if (!st.unlocked2 || (cookSlots.cook2 && foodClassOf(cookSlots.cook2) !== 'condimento')){
    cookSlots.cook2 = null;
    await paintSlot(document.querySelector('[data-slot="cook2"]'), null);
  }

  // Recalcular después de posibles cambios
  const st2 = cookRuleState();

  // cook3 inválido
  const allowed3 = ['condimento', st2.f1].filter(Boolean);
  if (!st2.unlocked3 || (cookSlots.cook3 && !allowed3.includes(foodClassOf(cookSlots.cook3)||''))){
    cookSlots.cook3 = null;
    await paintSlot(document.querySelector('[data-slot="cook3"]'), null);
  }

  // Recalcular otra vez
  const st3 = cookRuleState();

  // cook4 inválido
  const allowed4 = ['condimento', st3.f1].filter(Boolean);
  if (!st3.unlocked4 || (cookSlots.cook4 && !allowed4.includes(foodClassOf(cookSlots.cook4)||''))){
    cookSlots.cook4 = null;
    await paintSlot(document.querySelector('[data-slot="cook4"]'), null);
  }

  updateCookLocksUI();
}

/* ===== recetas (RESULTADO) ===== */

/** Devuelve nombre del plato según ingredientes; null si no hay receta válida */
function computeRecipeName(){
  const st = cookRuleState();
  if (!st.ok1 || !st.ok2) return null; // falta base + condimento
  const base = st.f1; // 'carne' o 'pescado'

  // cuántos extras válidos hay en 3 y 4
  let extras = 0;
  if (st.ok3) extras += 1;
  if (st.ok4) extras += 1;

  if (base === 'carne'){
    if (extras === 0) return 'brocheta de carne';
    if (extras === 1) return 'estofado de carne';
    return 'atracón de carne';
  }
  if (base === 'pescado'){
    if (extras === 0) return 'pescado plancha';
    if (extras === 1) return 'plato de pescado';
    return 'caldereta de pescado';
  }
  return null;
}

async function getFSItemAsSlotItem(name){
  try{
    const fsItem = await getItemByName(name);
    if (!fsItem) return null;
    const url = await resolveURL(fsItem.imageURL || fsItem.url || null);
    return { ...fsItem, url: url || null, name: fsItem.name || name };
  }catch(e){
    console.warn('getItemByName error for result', name, e);
    return null;
  }
}

/** Recalcula y pinta el resultado en cook_out1 */
async function updateCookResult(){
  const resultName = computeRecipeName();
  const outEl = document.querySelector('[data-slot="cook_out1"]');

  if (!resultName){
    outSlot['cook_out1'] = null;
    await paintSlot(outEl, null);
    return;
  }

  const item = await getFSItemAsSlotItem(resultName);
  if (!item){
    console.warn('No se encontró el item en Firebase para', resultName);
    outSlot['cook_out1'] = null;
    await paintSlot(outEl, null);
    return;
  }

  outSlot['cook_out1'] = item;
  await paintSlot(outEl, item);
}

/** Limpia ingredientes de cocina (se consumen) */
async function clearIngredients(){
  for (let i=1;i<=4;i++){
    const k = `cook${i}`;
    cookSlots[k] = null;
    await paintSlot(document.querySelector(`[data-slot="${k}"]`), null);
  }
  updateCookLocksUI();
}

/* ===== cargar ===== */
async function loadAll(){
  // Banco
  const bankDoc = await loadBancoFS(PJ_ID);
  if (bankDoc && bankDoc.slots) {
    Object.entries(bankDoc.slots).forEach(([k,v]) => bankSlots[k] = v || null);
  }
  // Cocina (desde ficha)
  const ficha = await loadFichaFS(PJ_ID);
  const allSlots = (ficha && ficha.slots) ? ficha.slots : {};
  for (let i=1;i<=4;i++){
    const k = `cook${i}`;
    cookSlots[k] = allSlots[k] || null;
  }
  outSlot['cook_out1'] = allSlots['cook_out1'] || null;
}

/* ===== guardar ===== */
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
async function saveCocinaMergeToFicha(){
  const ficha = await loadFichaFS(PJ_ID);
  const current = (ficha && ficha.slots) ? { ...ficha.slots } : {};
  for (let i=1;i<=4;i++){
    const k = `cook${i}`;
    current[k] = cookSlots[k] ? stripUndefinedDeep(cookSlots[k]) : null;
  }
  current['cook_out1'] = outSlot['cook_out1'] ? stripUndefinedDeep(outSlot['cook_out1']) : null;
  await saveFichaFS(PJ_ID, { slots: current });
}

/* ===== click/mover ===== */
let selectedEl = null;
function clearSelection(){
  if (selectedEl) selectedEl.classList.remove('is-selected');
  selectedEl = null;
}
function getStoreForEl(el){
  const key = el?.dataset?.slot || '';
  if (key.startsWith('bank')) return { store: bankSlots, type:'bank' };
  if (/^cook\d+$/.test(key))  return { store: cookSlots, type:'cook' };
  if (key === 'cook_out1')    return { store: outSlot,   type:'out'  };
  return null;
}

async function onSlotClick(ev){
  const el = ev.currentTarget;
  const ctx = getStoreForEl(el);
  if (!ctx) return;

  // 1º clic: seleccionar
  if (!selectedEl){
    selectedEl = el;
    el.classList.add('is-selected');
    return;
  }

  // 2º clic: mover/intercambiar
  const fromEl = selectedEl;
  const toEl   = el;
  clearSelection();

  const fromCtx = getStoreForEl(fromEl);
  const toCtx   = getStoreForEl(toEl);
  const fromKey = fromEl.dataset.slot;
  const toKey   = toEl.dataset.slot;

  let fromItem = fromCtx.store[fromKey] || null;
  let toItem   = toCtx.store[toKey] || null;

  // Reglas especiales del resultado (outSlot):
  // - No se puede soltar nada en cook_out1
  if (toCtx.type === 'out') {
    alert('El slot de resultado es solo de salida.');
    return;
  }
  // - El resultado solo puede moverse a banco, a un hueco vacío
  if (fromCtx.type === 'out') {
    if (toCtx.type !== 'bank') {
      alert('Coloca el plato final en un hueco del banco/inventario.');
      return;
    }
    if (toItem) {
      alert('Elige un hueco vacío del banco para guardar el plato.');
      return;
    }

    // Movimiento: resultado -> banco (consumir ingredientes)
    toCtx.store[toKey] = fromItem;           // Guarda plato en banco
    fromCtx.store[fromKey] = null;           // Vacía slot de salida
    await paintSlot(toEl,   toCtx.store[toKey]);
    await paintSlot(fromEl, null);

    // Consumir ingredientes
    await clearIngredients();
    await updateCookResult();                // debería quedar vacío tras limpiar
    await saveBank();
    await saveCocinaMergeToFicha();
    return;
  }

  // Si el destino es cocina, validar antes de soltar
  if (toCtx.type === 'cook') {
    if (!allowedForSlot(toKey).unlocked){
      alert(allowedForSlot(toKey).reason || 'Slot bloqueado');
      return;
    }
    if (fromItem){
      fromItem = await ensureFoodMeta(fromItem);
      const v = await canPlaceInCook(toKey, fromItem);
      if (!v.ok) { alert(v.reason); return; }
      fromItem = v.item; // ya enriquecido
    }
  }

  // Si ambos son cocina, validar el "swap" para el otro lado
  if (fromCtx.type === 'cook' && toCtx.type === 'cook' && toItem){
    const v2 = await canPlaceInCook(fromKey, toItem);
    if (!v2.ok) { alert(`No puedes mover ese item al ${fromKey}: ${v2.reason}`); return; }
  }

  // swap genérico
  fromCtx.store[fromKey] = toItem || null;
  toCtx.store[toKey]     = fromItem || null;

  await paintSlot(fromEl, fromCtx.store[fromKey]);
  await paintSlot(toEl,   toCtx.store[toKey]);

  // Reforzar reglas (puede limpiar posteriores) + actualizar locks + resultado
  await enforceCookConsistency();
  await updateCookResult();

  // Guardar
  if (fromCtx.type === 'bank' || toCtx.type === 'bank') await saveBank();
  await saveCocinaMergeToFicha();
}

/* ===== init ===== */
(async function init(){
  const elsBank = buildGrid($('#grid-banco'));            // 20x4
  const elsIngr = buildGrid($('#grid-ingredientes'));     // 1x4 → cook1..cook4
  const elsOut  = buildGrid($('#slot-resultado'));        // 1x1 → cook_out1

  await loadAll();

  // Pintar
  await Promise.all(elsBank.map(el => paintSlot(el, bankSlots[el.dataset.slot] || null)));
  await Promise.all(elsIngr.map(el => paintSlot(el, cookSlots[el.dataset.slot] || null)));
  await Promise.all(elsOut.map(el  => paintSlot(el, outSlot[el.dataset.slot]  || null)));

  updateCookLocksUI();
  await updateCookResult(); // calcula/ajusta el resultado a partir de los ingredientes actuales

  // Eventos
  [...elsBank, ...elsIngr, ...elsOut].forEach(el => el.addEventListener('click', onSlotClick));
})();
