// personajes/ficha.js
// En ficha.html:
// <script type="module" src="../firebase.js"></script>
// <script type="module" src="ficha.js"></script>

import { getItemByName, saveFichaFS, loadFichaFS, storage } from "../firebase.js";

/* =========================================================================
   Utils
   =======================================================================*/
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const normKey = k => (k||'')
  .normalize('NFD').replace(/\p{Diacritic}/gu,'')
  .replace(/ñ/gi,'n'); // "sueño" -> "sueno"

/* =========================================================================
   URL / personaje
   =======================================================================*/
const params = new URLSearchParams(location.search);
const PJ_ID = params.get('id');

function getPersonajes(){ return JSON.parse(localStorage.getItem('personajes') || '[]'); }
const pj = getPersonajes().find(p => p.id === PJ_ID);

/* =========================================================================
   Bases / defaults por clase
   =======================================================================*/
const BASE_BY_CLASS = {
  cuerpo:      { fuerza:4, defensa:3, destreza:1, sabiduria:1, velocidad:2 }, // melee / guerrero
  brujo:       { fuerza:1, defensa:1, destreza:2, sabiduria:4, velocidad:2 }, // mago/clérigo
  habilidoso:  { fuerza:2, defensa:2, destreza:4, sabiduria:1, velocidad:3 }, // pícaro/arquero
};
const DEFAULT_STATE = { fuerza:2, defensa:3, destreza:1, sabiduria:2, velocidad:2 };

function baseForClass(clase){ return BASE_BY_CLASS?.[clase] || DEFAULT_STATE; }

function defaultFichaFor(meta){
  const on10 = () => Array.from({length:10}, ()=>true);
  const clase = meta?.clase || pj?.clase || "Aventurero";
  return {
    nombre: meta?.nombre || pj?.nombre || "Personaje",
    clase,
    state: {
      ...baseForClass(clase),
      elemental:{ atk:{fuego:0,agua:0,tierra:0,aire:0}, def:{fuego:0,agua:0,tierra:0,aire:0} },
      mods:{ fuerza:0, defensa:0, destreza:0, sabiduria:0, velocidad:0 }
    },
    injured: [],
    pips: { vida: on10(), mana: on10(), hambre: on10(), sueno: on10() },
    slots: {},
    counters: { noFoodTurns: 0 },
  };
}

/* =========================================================================
   Estado en memoria
   =======================================================================*/
const state = {
  ...DEFAULT_STATE,
  elemental:{ atk:{fuego:0,agua:0,tierra:0,aire:0}, def:{fuego:0,agua:0,tierra:0,aire:0} },
  mods:{ fuerza:0, defensa:0, destreza:0, sabiduria:0, velocidad:0 }
};

/* =========================================================================
   Encabezado (DOM)
   =======================================================================*/
function setHeaderFromPJ() {
  const nombreEl = $('#nombrePJ');
  const claseEl  = $('#clasePJ');
  if (!nombreEl || !claseEl) return;

  if (pj) {
    nombreEl.textContent = pj.nombre;
    claseEl.textContent  = `(${pj.clase})`;
    claseEl.dataset.clase = pj.clase;
  } else {
    nombreEl.textContent = 'Nombre del personaje';
    claseEl.textContent  = '(Tipo de personaje)';
    claseEl.dataset.clase = 'Aventurero';
  }
}
function getClaseValue(){
  const el = $('#clasePJ');
  return el?.dataset?.clase ||
         (el?.textContent || '').replace(/[()]/g,'').trim() ||
         pj?.clase || 'Aventurero';
}

/* =========================================================================
   Render de stats y elementales
   =======================================================================*/
function renderStats(){
  $$('.stat-controls').forEach(ctrl=>{
    const key = ctrl.dataset.key;
    const base = Number(state[key] || 0);
    const mod  = Number(state.mods[key] || 0);
    const out  = ctrl.querySelector('output');
    if (out) out.textContent = base + mod;
  });

  const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
  set('#atk-fuego',  state.elemental.atk.fuego);
  set('#atk-agua',   state.elemental.atk.agua);
  set('#atk-tierra', state.elemental.atk.tierra);
  set('#atk-aire',   state.elemental.atk.aire);
  set('#def-fuego',  state.elemental.def.fuego);
  set('#def-agua',   state.elemental.def.agua);
  set('#def-tierra', state.elemental.def.tierra);
  set('#def-aire',   state.elemental.def.aire);
}

/* =========================================================================
   Pips (vida/mana/hambre/sueno)
   =======================================================================*/
function buildPips(){
  const containers = $$('.pips');
  if (!containers.length) return;
  containers.forEach(container=>{
    const type = normKey(container.dataset.type);
    container.innerHTML = '';
    for (let i=0;i<10;i++){
      const dot = document.createElement('button');
      dot.className = `pip ${type}`;
      dot.addEventListener('click', ()=>{
        dot.classList.toggle('active');
        saveSheet();
      });
      container.appendChild(dot);
    }
  });
}

/* =========================================================================
   Helpers imágenes/URLs
   =======================================================================*/
const EXT = ['.png','.jpg','.jpeg','.webp','.gif'];

async function resolveURL(u){
  if (!u) return null;
  const s = String(u).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("gs://")) {
    const { getDownloadURL, ref } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js");
    try { return await getDownloadURL(ref(storage, s)); }
    catch(e){ console.warn("No se pudo resolver gs://", s, e); return null; }
  }
  if (s.startsWith("../") || s.startsWith("./") || s.startsWith("/")) return s;
  return `../assets/${s}`;
}
function slugCandidates(name){
  const sinAcentos = name.normalize('NFD').replace(/\p{Diacritic}/gu,'');
  const base = [
    name, name.toLowerCase(),
    sinAcentos, sinAcentos.toLowerCase(),
    name.replace(/\s+/g,'_'), name.replace(/\s+/g,'-'),
    sinAcentos.replace(/\s+/g,'_'),
    sinAcentos.replace(/\s+/g,'-').toLowerCase(),
  ];
  return [...new Set(base)];
}
function tryLoadLocalVariants(basePathNoExts){
  return new Promise(resolve=>{
    const tries = [];
    basePathNoExts.forEach(b=> EXT.forEach(ext=> tries.push(b+ext)));
    let i=0;
    const next=()=>{
      if(i>=tries.length) return resolve(null);
      const src = tries[i++];
      const test = new Image();
      test.onload = ()=> resolve(src);
      test.onerror = next;
      test.src = src + `?v=${Date.now()}`;
    };
    next();
  });
}

/* =========================================================================
   Normalización items/mods/skills
   =======================================================================*/
function normalizeItem(item){
  if (!item) return item;
  const toNum = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const normK = k => String(k ?? '').trim().toLowerCase();
  const out = { ...item };

  if (item.mods){
    out.mods = {};
    Object.entries(item.mods).forEach(([k,v])=>{ out.mods[normK(k)] = toNum(v); });
  }
  if (item.atk){
    out.atk = {};
    Object.entries(item.atk).forEach(([k,v])=>{ out.atk[normK(k)] = toNum(v); });
  }
  if (item.def){
    out.def = {};
    Object.entries(item.def).forEach(([k,v])=>{ out.def[normK(k)] = toNum(v); });
  }
  const skills = item.skills || item.habilidades || item.abilities;
  if (Array.isArray(skills)) out.skills = skills.map(s => String(s||'').trim()).filter(Boolean);
  return out;
}

/* =========================================================================
   Tooltip de items
   =======================================================================*/
function buildItemTooltip(d){
  if (!d) return '';
  const lines = [];
  const title = d.name || 'Item';
  const tipo  = d.type || d.tipo || '';
  lines.push(`${title}${tipo ? ` — ${tipo}` : ''}`);

  const mods = d.mods || {};
  const atk  = d.atk  || {};
  const def  = d.def  || {};
  const skills = Array.isArray(d.skills) ? d.skills : [];

  const modsKeys = Object.keys(mods).filter(k=>Number.isFinite(Number(mods[k])));
  if (modsKeys.length) lines.push('Mods: ' + modsKeys.map(k=>`${k}+${mods[k]}`).join(', '));
  const atkKeys = Object.keys(atk).filter(k=>Number.isFinite(Number(atk[k])));
  if (atkKeys.length)  lines.push('ATK: ' + atkKeys.map(k=>`${k}+${atk[k]}`).join(', '));
  const defKeys = Object.keys(def).filter(k=>Number.isFinite(Number(def[k])));
  if (defKeys.length)  lines.push('DEF: ' + defKeys.map(k=>`${k}+${def[k]}`).join(', '));
  if (skills.length)   lines.push('Habilidades: ' + skills.join(', '));

  if (d.description || d.descripcion) {
    lines.push('');
    lines.push((d.description || d.descripcion).trim());
  }
  return lines.join('\n');
}

/* =========================================================================
   Índice de personajes (local)
   =======================================================================*/
function getListaPersonajes(){ return JSON.parse(localStorage.getItem('personajes') || '[]'); }
function setListaPersonajes(arr){ localStorage.setItem('personajes', JSON.stringify(arr)); }
function upsertPersonajeEnIndice(id, nombre, clase){
  if (!id) return;
  const lista = getListaPersonajes();
  const i = lista.findIndex(p => p.id === id);
  if (i >= 0) {
    lista[i].nombre = nombre || lista[i].nombre || 'Personaje';
    lista[i].clase  = clase  || lista[i].clase  || 'Aventurero';
  } else {
    lista.push({ id, nombre: nombre || 'Personaje', clase: clase || 'Aventurero' });
  }
  setListaPersonajes(lista);
}

/* =========================================================================
   SLOTS: estado global en memoria
   =======================================================================*/
const slotData = {};

/* =========================================================================
   Reglas de slots (mods/auto-skills)
   =======================================================================*/
function isWeaponSlot(slotKey){ return slotKey === 'arma1' || slotKey === 'arma2'; }

/** True si este slot debe aplicar mods/elementales al state */
function shouldAffectStats(el, slotKey){
  if (!el) return false;

  if (typeof el.dataset.applyMods !== 'undefined') {
    return el.dataset.applyMods === 'true';
  }

  const container = el.closest('.slots, .bag, [class*="slots--"]');
  const cls = container?.className || '';

  if (/\bslots--(purple|orange)\b/.test(cls)) return true;
  if (/\bslots--blue\b/.test(cls)) return false;
  if (/\bbag\b/.test(cls)) return false;

  return isWeaponSlot(slotKey);
}

/** True si el slot debe autoequipar habilidades del item (purple/orange) */
function shouldAutoEquipSkills(el){
  if (!el) return false;
  if (typeof el.dataset.autoSkills !== 'undefined') {
    return el.dataset.autoSkills === 'true';
  }
  const container = el.closest('.slots, .bag, [class*="slots--"]');
  const cls = container?.className || '';
  return /\bslots--(purple|orange)\b/.test(cls);
}

/* =========================================================================
   Cargar / Guardar ficha
   =======================================================================*/
async function loadSheet(){
  if (PJ_ID) {
    try {
      const fs = await loadFichaFS(PJ_ID);
      if (fs) { await applyLoaded(fs); return; }
    } catch (e) { console.warn('No se pudo cargar desde Firestore:', e); }
  }

  const key = PJ_ID ? `ficha_${PJ_ID}` : 'ficha_actual';
  const raw = localStorage.getItem(key);
  if (raw) {
    try { await applyLoaded(JSON.parse(raw)); return; }
    catch(e){ console.warn('No se pudo parsear localStorage:', e); }
  }

  const defaults = defaultFichaFor({ nombre: pj?.nombre, clase: pj?.clase });
  await applyLoaded(defaults);

  if (PJ_ID) {
    try {
      await saveFichaFS(PJ_ID, defaults);
      localStorage.setItem(key, JSON.stringify(defaults));
      upsertPersonajeEnIndice(PJ_ID, defaults.nombre, defaults.clase);
    } catch(e){ console.warn('No se pudo guardar defaults en Firestore:', e); }
  }
}

/* =========================================================================
   stripUndefined (util por si limpias antes de subir a FS)
   =======================================================================*/
function stripUndefinedDeep(val){
  if (Array.isArray(val)) {
    return val.map(stripUndefinedDeep).filter(v => v !== undefined);
  }
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      const cleaned = stripUndefinedDeep(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return val === undefined ? undefined : val;
}

/* =========================================================================
   Guardar ficha
   =======================================================================*/
async function saveSheet(){
  const pipsPayload = {};
  $$('.pips').forEach(c=>{
    const tipo = normKey(c.dataset.type);
    pipsPayload[tipo] = [...c.children].map(d=>d.classList.contains('active'));
  });

  const nombreEl = $('#nombrePJ');
  const payload = {
    nombre: nombreEl ? nombreEl.textContent.trim() : (pj?.nombre || 'Personaje'),
    clase:  getClaseValue(),
    state,
    injured: $$('.part').filter(p=>p.classList.contains('injured')).map(p=>p.dataset.part),
    pips: pipsPayload,
    slots: Object.fromEntries(
      Object.entries(slotData || {}).map(([k, v]) => {
        if (!v) return [k, null];
        const s = {
          name:   v.name || '',
          url:    v.url  || '',
          mods:   v.mods || {},
          atk:    v.atk  || {},
          def:    v.def  || {},
          source: v.source ?? null,
        };
        if (Array.isArray(v.skills) && v.skills.length) {
          s.skills = v.skills.slice();
        }
        return [k, s];
      })
    )
  };

  const key = PJ_ID ? `ficha_${PJ_ID}` : 'ficha_actual';
  localStorage.setItem(key, JSON.stringify(payload));

  if (PJ_ID) {
    try { await saveFichaFS(PJ_ID, payload); }
    catch(e){ console.warn('No se pudo guardar en Firestore:', e); }
    upsertPersonajeEnIndice(PJ_ID, payload.nombre, payload.clase);
  }
}

/* =========================================================================
   Aplicar datos cargados al DOM
   =======================================================================*/
async function applyLoaded(d){
  const nombreEl = $('#nombrePJ');
  const claseEl  = $('#clasePJ');
  if (d.nombre && nombreEl) nombreEl.textContent = d.nombre;
  if (d.clase && claseEl)  { claseEl.textContent = `(${d.clase})`; claseEl.dataset.clase = d.clase; }

  if (d.state) Object.assign(state, d.state);
  renderStats();

  // lesiones
  $$('.part').forEach(p=>p.classList.remove('injured'));
  (d.injured||[]).forEach(id=>{
    const el = document.querySelector(`.part[data-part="${id}"]`);
    if (el) el.classList.add('injured');
  });

  // pips
  const groups = $$('.pips');
  if (d.pips && !Array.isArray(d.pips)) {
    ['vida','mana','hambre','sueno'].forEach((tipo, gi)=>{
      const arr = d.pips[tipo] ?? d.pips[normKey(tipo)] ?? [];
      if(!groups[gi]) return;
      [...groups[gi].children].forEach((dot,i)=> dot.classList.toggle('active', !!arr[i]));
    });
  } else if (Array.isArray(d.pips)) {
    (d.pips||[]).forEach((arr,gi)=>{
      if(!groups[gi]) return;
      [...groups[gi].children].forEach((dot,i)=> dot.classList.toggle('active', !!arr[i]));
    });
  }

  // slots
  if (d.slots){
    for (const [slotKey, item] of Object.entries(d.slots)){
      const el = document.querySelector(`.slot[data-slot="${slotKey}"]`);
      if (!el || !item) continue;

      const norm = normalizeItem(item);
      const resolved = await resolveURL(norm.url);
      if (resolved) {
        el.style.backgroundImage = `url("${resolved}")`;
        el.textContent = '';
      } else {
        el.style.backgroundImage = 'none';
        el.textContent = (norm.name || '').slice(0,12);
      }
      el.title = buildItemTooltip(norm);

      const affects = shouldAffectStats(el, slotKey);
      const autoSkills = shouldAutoEquipSkills(el);
      slotData[slotKey] = {
        ...norm, url: resolved, source: item.source || null,
        _affectsStats: affects, _autoSkills: autoSkills
      };

      if (affects) applyItemMods(norm, /*apply=*/true);
    }
  }
}

/* =========================================================================
   Lesiones (wiring)
   =======================================================================*/
function wireParts(){
  $$('.part').forEach(b=>{
    b.addEventListener('click', ()=>{
      b.classList.toggle('injured');
      saveSheet();
    });
  });
}

/* =========================================================================
   SLOTS: lógica
   =======================================================================*/
function applyItemMods(data, apply = true){
  if (!data) return;
  const sign   = apply ? 1 : -1;
  const toNum  = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const normK  = k => String(k ?? '').trim().toLowerCase();

  if (data.mods && typeof data.mods === 'object'){
    Object.entries(data.mods).forEach(([k,v])=>{
      const key = normK(k), val = toNum(v);
      if (!(key in state.mods)) state.mods[key] = 0;
      state.mods[key] += sign * val;
    });
  }
  if (data.atk && typeof data.atk === 'object'){
    Object.entries(data.atk).forEach(([k,v])=>{
      const key = normK(k), val = toNum(v);
      if (!(key in state.elemental.atk)) state.elemental.atk[key] = 0;
      state.elemental.atk[key] += sign * val;
    });
  }
  if (data.def && typeof data.def === 'object'){
    Object.entries(data.def).forEach(([k,v])=>{
      const key = normK(k), val = toNum(v);
      if (!(key in state.elemental.def)) state.elemental.def[key] = 0;
      state.elemental.def[key] += sign * val;
    });
  }
  renderStats();
}

/** Slots azules (destino de habilidades autoequipadas) */
function getAbilitySlots(){ return [...document.querySelectorAll('.slots--blue .slot')]; }
function firstFreeAbilitySlotKey(){
  for (const el of getAbilitySlots()){
    const key = el.dataset.slot;
    if (!slotData[key]) return key;
  }
  return null;
}
function removeAbilitiesFromSource(sourceSlotKey){
  for (const el of getAbilitySlots()){
    const key = el.dataset.slot;
    const sd = slotData[key];
    if (sd && sd.source === sourceSlotKey){
      if (sd._affectsStats) applyItemMods(sd, /*apply=*/false);
      slotData[key] = null;
      el.style.backgroundImage = 'none';
      el.textContent = '';
      el.title = '';
    }
  }
  saveSheet();
}

/** Auto-equip genérico (para purple y orange) */
async function autoEquipSkillsFromSource(sourceSlotKey, skills){
  for (const skillName of skills){
    const freeKey = firstFreeAbilitySlotKey();
    if (!freeKey) break;
    await equipItemToSlot(freeKey, skillName, { source: sourceSlotKey });
  }
}

/** Equipar un item a un slot (con revert y tooltip) */
async function equipItemToSlot(slotKey, nombre, options = {}){
  const el = document.querySelector(`.slot[data-slot="${slotKey}"]`);
  if (!el) return false;

  if (slotData[slotKey]) {
    if (slotData[slotKey]._autoSkills) removeAbilitiesFromSource(slotKey);
    if (slotData[slotKey]._affectsStats) applyItemMods(slotData[slotKey], /*apply=*/false);
    slotData[slotKey] = null;
    el.style.backgroundImage = 'none';
    el.textContent = '';
    el.title = '';
  }

  if (!nombre || nombre.trim().toLowerCase() === 'clear') {
    saveSheet();
    return true;
  }

  const raw = await getItemData(nombre.trim());
  if (!raw) { alert(`No se encontró "${nombre}" en items ni como imagen local.`); return false; }

  const data = normalizeItem(raw);
  const finalURL = await resolveURL(data.url);

  if (finalURL) { el.style.backgroundImage = `url("${finalURL}")`; el.textContent = ''; }
  else { el.style.backgroundImage = 'none'; el.textContent = (data.name || nombre).slice(0,12); }

  el.title = buildItemTooltip(data);

  const affects    = shouldAffectStats(el, slotKey);
  const autoSkills = shouldAutoEquipSkills(el);

  slotData[slotKey] = {
    ...data, url: finalURL, source: options.source || null,
    _affectsStats: affects, _autoSkills: autoSkills
  };

  if (affects) applyItemMods(data, /*apply=*/true);
  saveSheet();

  if (autoSkills && Array.isArray(data.skills) && data.skills.length){
    await autoEquipSkillsFromSource(slotKey, data.skills);
  }
  return true;
}

/* =========================================================================
   Menú contextual + Modal + Mover/Swap
   =======================================================================*/
let moveState = { active:false, sourceKey:null };

function isAbilitySlotEl(el){
  return !!el.closest('.slots--blue');
}

/* ------- Modal ------- */
function openModalForSlot(slotKey){
  const d = slotData[slotKey];
  if (!d) return;
  const m = $('#itemModal');
  const t = $('#itemModalText');
  const h = $('#itemModalTitle');
  const img = $('#itemModalImg');
  if (!m || !t || !h || !img) return;

  h.textContent = d.name || 'Objeto';
  t.textContent = buildItemTooltip(d);
  if (d.url){ img.src = d.url; img.style.display = 'block'; }
  else { img.removeAttribute('src'); img.style.display = 'none'; }
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden','false');
}
function closeModal(){
  const m = $('#itemModal');
  if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden','true');
}
document.addEventListener('click', (e)=>{
  if (e.target?.matches?.('[data-close-modal]')) closeModal();
});
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') { closeModal(); removeCtxMenu(); cancelMoveMode(); }
});

/* ------- Context Menu ------- */
function removeCtxMenu(){
  document.querySelectorAll('.ctxmenu').forEach(n=>n.remove());
  document.removeEventListener('click', handleCtxOutsideClick, { capture:true });
}
function handleCtxOutsideClick(e){
  if (!e.target.closest('.ctxmenu')) removeCtxMenu();
}
function showCtxMenu(x, y, slotKey){
  removeCtxMenu();
  const menu = document.createElement('div');
  menu.className = 'ctxmenu';
  menu.style.left = Math.max(6, Math.min(window.innerWidth-200, x)) + 'px';
  menu.style.top  = Math.max(6, Math.min(window.innerHeight-160, y)) + 'px';

  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', ()=>{ removeCtxMenu(); fn(); });
    return b;
  };

  menu.appendChild(mkBtn('Ver', ()=> openModalForSlot(slotKey)));
  menu.appendChild(mkBtn('Mover', ()=> startMoveMode(slotKey)));
  menu.appendChild(mkBtn('Eliminar', ()=> clearSlot(slotKey)));

  document.body.appendChild(menu);
  setTimeout(()=> document.addEventListener('click', handleCtxOutsideClick, { capture:true }), 0);
}

/* ------- Clear / Remove ------- */
function clearSlot(slotKey){
  const el = document.querySelector(`.slot[data-slot="${slotKey}"]`);
  const sd = slotData[slotKey];
  if (!el || !sd) return;

  if (sd._autoSkills) removeAbilitiesFromSource(slotKey);
  if (sd._affectsStats) applyItemMods(sd, /*apply=*/false);

  slotData[slotKey] = null;
  el.style.backgroundImage = 'none';
  el.textContent = '';
  el.title = '';
  saveSheet();
}

/* ------- Equip con objeto ya normalizado ------- */
async function equipItemObjectToSlot(slotKey, data, options = {}){
  const el = document.querySelector(`.slot[data-slot="${slotKey}"]`);
  if (!el) return false;

  if (slotData[slotKey]) clearSlot(slotKey);
  if (!data) { saveSheet(); return true; }

  const norm = normalizeItem(data);
  const finalURL = await resolveURL(norm.url);

  if (finalURL) { el.style.backgroundImage = `url("${finalURL}")`; el.textContent = ''; }
  else { el.style.backgroundImage = 'none'; el.textContent = (norm.name || '').slice(0,12); }

  el.title = buildItemTooltip(norm);

  const affects    = shouldAffectStats(el, slotKey);
  const autoSkills = shouldAutoEquipSkills(el);

  slotData[slotKey] = {
    ...norm, url: finalURL, source: options.source || null,
    _affectsStats: affects, _autoSkills: autoSkills
  };

  if (affects) applyItemMods(norm, /*apply=*/true);
  saveSheet();

  if (autoSkills && Array.isArray(norm.skills) && norm.skills.length){
    await autoEquipSkillsFromSource(slotKey, norm.skills);
  }
  return true;
}

/* ------- Modo mover / swap ------- */
function startMoveMode(sourceKey){
  cancelMoveMode();
  moveState.active = true;
  moveState.sourceKey = sourceKey;

  const srcEl = document.querySelector(`.slot[data-slot="${sourceKey}"]`);
  if (srcEl) srcEl.classList.add('is-move-source');

  $$('.slot').forEach(el=>{
    const key = el.dataset.slot;
    if (key !== sourceKey) el.classList.add('is-move-target');
  });
}
function cancelMoveMode(){
  moveState = { active:false, sourceKey:null };
  $$('.slot').forEach(el=> el.classList.remove('is-move-source','is-move-target'));
}
async function performMoveOrSwap(targetKey){
  const sourceKey = moveState.sourceKey;
  if (!sourceKey || sourceKey === targetKey) { cancelMoveMode(); return; }

  const src = slotData[sourceKey] ? { ...slotData[sourceKey] } : null;
  const tgt = slotData[targetKey] ? { ...slotData[targetKey] } : null;

  if (!src){ cancelMoveMode(); return; }

  clearSlot(sourceKey);
  if (tgt) clearSlot(targetKey);

  await equipItemObjectToSlot(targetKey, src, { source: src.source || null });
  if (tgt) await equipItemObjectToSlot(sourceKey, tgt, { source: tgt.source || null });

  cancelMoveMode();
}

/* =========================================================================
   Click inteligente por slot
   =======================================================================*/
function enhancedSlotClickHandler(el){
  const slotKey = el.dataset.slot;
  const sd = slotData[slotKey] || null;

  if (moveState.active){
    performMoveOrSwap(slotKey);
    return;
  }

  const isAbility = isAbilitySlotEl(el);

  if (sd){
    if (isAbility){
      openModalForSlot(slotKey);
    } else {
      const rect = el.getBoundingClientRect();
      showCtxMenu(rect.left + rect.width/2, rect.top + rect.height + 8, slotKey);
    }
  } else {
    (async ()=>{
      const nombre = prompt('Nombre del objeto/imagen (p. ej. "daga de madera")\nEscribe "clear" para vaciar');
      if (nombre === null) return;
      await equipItemToSlot(slotKey, nombre);
    })();
  }
}

/* (opcional) Menú con botón derecho si hay contenido */
function enhancedSlotContextMenu(el){
  el.addEventListener('contextmenu', (ev)=>{
    const slotKey = el.dataset.slot;
    const sd = slotData[slotKey] || null;
    if (!sd) return;
    ev.preventDefault();
    showCtxMenu(ev.clientX, ev.clientY, slotKey);
  });
}

/* =========================================================================
   Búsqueda de ítems (Firestore → local)
   =======================================================================*/
async function getItemData(nombre){
  const n = (nombre||'').trim();
  if(!n) return null;
  try{
    const fsItem = await getItemByName(n);
    if (fsItem){
      const u = await resolveURL(fsItem.imageURL || null);
      return { url: u || null, ...fsItem };
    }
  }catch(e){ console.warn('getItemByName error', e); }

  const bases = slugCandidates(`../assets/${n}`);
  const localURL = await tryLoadLocalVariants(bases);
  if (localURL) return { url: localURL, name:n, mods:{} };
  return null;
}

/* =========================================================================
   === SISTEMA DE PASAR TURNO ==============================================
   =======================================================================*/

// Asegura un array de 10 booleans
function ensurePips(arr){
  const out = Array(10).fill(false);
  if (Array.isArray(arr)) for (let i = 0; i < 10; i++) out[i] = !!arr[i];
  return out;
}

// Quita 1 pip (de derecha a izquierda)
function decOne(pips){
  const a = ensurePips(pips).slice();
  for (let i = a.length - 1; i >= 0; i--) {
    if (a[i]) { a[i] = false; return { changed: true, pips: a }; }
  }
  return { changed: false, pips: a };
}
function anyOn(pips){ return ensurePips(pips).some(Boolean); }

// Construye una ficha mínima si falta
function makeMinimalFicha(meta = {}){
  const on10 = () => Array.from({length:10}, ()=>true);
  const clase = meta.clase || 'Aventurero';
  return {
    nombre: meta.nombre || 'Personaje',
    clase,
    state: {
      ...(BASE_BY_CLASS?.[clase] || DEFAULT_STATE),
      elemental:{ atk:{fuego:0,agua:0,tierra:0,aire:0}, def:{fuego:0,agua:0,tierra:0,aire:0} },
      mods:{ fuerza:0, defensa:0, destreza:0, sabiduria:0, velocidad:0 }
    },
    injured: [],
    pips: { vida: on10(), mana: on10(), hambre: on10(), sueno: on10() },
    slots: {},
    counters: { noFoodTurns: 0, noSleepTurns: 0 },
  };
}

// Aplica la lógica de reducción de hambre o sueno
function procesarNecesidad(ficha, tipo, counterKey){
  ficha.pips[tipo] = ensurePips(ficha.pips[tipo]);
  ficha.counters[counterKey] = Number(ficha.counters[counterKey] || 0);

  if (anyOn(ficha.pips[tipo])) {
    const r = decOne(ficha.pips[tipo]);
    ficha.pips[tipo] = r.pips;
    ficha.counters[counterKey] = 0;
  } else {
    ficha.counters[counterKey] += 1;
    if (ficha.counters[counterKey] >= 2) {
      const rv = decOne(ficha.pips.vida);
      ficha.pips.vida = rv.pips;
      ficha.counters[counterKey] = 0;
    }
  }
}

// Aplica el turno a UN personaje
async function pasarTurnoDePersonaje(pMeta){
  const key = pMeta?.id ? `ficha_${pMeta.id}` : 'ficha_actual';
  let ficha = null;

  if (pMeta?.id) {
    try { ficha = await loadFichaFS(pMeta.id); } catch(e){ console.warn('FS load error', e); }
  }
  if (!ficha) {
    const raw = localStorage.getItem(key);
    if (raw) { try { ficha = JSON.parse(raw); } catch(e){ console.warn('local parse error', e); } }
  }
  if (!ficha) ficha = makeMinimalFicha(pMeta);

  ficha.pips = ficha.pips || {};
  ficha.counters = ficha.counters || {};
  ficha.pips.hambre = ensurePips(ficha.pips.hambre);
  ficha.pips.sueno  = ensurePips(ficha.pips.sueno);
  ficha.pips.vida   = ensurePips(ficha.pips.vida);
  ficha.counters.noFoodTurns = Number(ficha.counters.noFoodTurns || 0);
  ficha.counters.noSleepTurns = Number(ficha.counters.noSleepTurns || 0);

  procesarNecesidad(ficha, "hambre", "noFoodTurns");
  procesarNecesidad(ficha, "sueno", "noSleepTurns");

  localStorage.setItem(key, JSON.stringify(ficha));
  if (pMeta?.id) {
    try { await saveFichaFS(pMeta.id, ficha); } catch(e){ console.warn('FS save error', e); }
  }

  if (PJ_ID && pMeta?.id === PJ_ID) {
    await applyLoaded(ficha);
  }

  return ficha;
}

// Aplica el turno a TODOS los personajes del índice local
async function pasarTurnoTodos(){
  const lista = JSON.parse(localStorage.getItem('personajes') || '[]');
  for (const p of lista) {
    await pasarTurnoDePersonaje(p);
  }
  console.log('Turno aplicado a', lista.length, 'personajes');
}

/* =========================================================================
   Wiring de slots
   =======================================================================*/
function wireSlots(){
  $$('.slot').forEach(el=>{
    el.addEventListener('click', ()=> enhancedSlotClickHandler(el));
    enhancedSlotContextMenu(el);

    el.addEventListener('mouseenter', ()=>{
      if (moveState.active) el.classList.add('is-move-target');
    });
    el.addEventListener('mouseleave', ()=>{
      el.classList.remove('is-move-target');
    });
  });

  document.addEventListener('click', (e)=>{
    if (moveState.active && !e.target.closest('.slot') && !e.target.closest('.ctxmenu')){
      cancelMoveMode();
    }
  });
}

/* =========================================================================
   Init
   =======================================================================*/
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.sheet')) {
    setHeaderFromPJ();
    buildPips();
    renderStats();
    wireParts();
    wireSlots();
    loadSheet();
    window.addEventListener('beforeunload', saveSheet);
  }

  // Botón "Pasar turno" (si existe en la página)
  const btnTurno = document.getElementById('pasarTurno');
  if (btnTurno) {
  btnTurno.addEventListener('click', async ()=>{
    btnTurno.disabled = true;
    try {
      await pasarTurnoTodos();
      if (PJ_ID) {
        const raw = localStorage.getItem(`ficha_${PJ_ID}`);
        if (raw) {
          const ficha = JSON.parse(raw);
          await applyLoaded(ficha); // refresca los pips en pantalla 🔥
        }
      }
    } finally {
      btnTurno.disabled = false;
    }
  });
}

// Refresca automáticamente la ficha abierta si otra pestaña la modifica (partida.html)
window.addEventListener('storage', (e) => {
  if (!PJ_ID) return; // solo nos importa en ficha.html (donde sí hay un PJ_ID en la URL)
  const key = `ficha_${PJ_ID}`;
  if (e.key === key && e.newValue) {
    try {
      const ficha = JSON.parse(e.newValue);
      applyLoaded(ficha); // 🔥 refresca pips y todo al instante
    } catch (err) {
      console.warn('No se pudo parsear ficha desde storage', err);
    }
  }
});

});
