// banco.js (actualizado)
// Banco paginado en 3 páginas de 4x4 (48 slots), con flechas y swipe.
// La Mochila sigue centrada debajo y mantiene su grid 3x3.

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

/* ========= Config Banco paginado ========= */
const BANK_PAGES = 3;
const PAGE_ROWS  = 4;
const PAGE_COLS  = 4;
const SLOTS_PER_PAGE = PAGE_ROWS * PAGE_COLS; // 16
const BANK_MAX = BANK_PAGES * SLOTS_PER_PAGE; // 48

/* ========= build grid (para Mochila) ========= */
function buildGrid(container){
  if (!container) return [];
  const rows = Number(container.dataset.rows || 4);
  const cols = Number(container.dataset.cols || 20);
  const prefix = (container.dataset.prefix || 'slot').trim();

  container.style.setProperty('--rows', rows);
  container.style.setProperty('--cols', cols);

  const els = [];
  let idx = 1;
  const frag = document.createDocumentFragment();
  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      const d = document.createElement('div');
      d.className = 'slot';
      d.dataset.slot = `${prefix}${idx++}`; // bank1.. o bag1..
      d.title = '';
      frag.appendChild(d);
      els.push(d);
    }
  }
  container.innerHTML = '';
  container.appendChild(frag);
  return els;
}

/* ========= build grid con offset (para Banco paginado) ========= */
function buildGridWithOffset(container, prefix, rows, cols, startIndex){
  const els = [];
  const frag = document.createDocumentFragment();
  let idx = startIndex;
  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      const d = document.createElement('div');
      d.className = 'slot';
      d.dataset.slot = `${prefix}${idx++}`;
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
const bankSlots = {}; // bank1..bankN => item|null
const bagSlots  = {}; // bag1..bag9   => item|null (3x3)

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
  // Mochila
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

/* ========= Banco paginado: UI ========= */
function setupBankPager(){
  const viewport = $('.bank-viewport');
  const track    = $('.bank-track');
  const btnPrev  = $('.pager-btn.prev');
  const btnNext  = $('.pager-btn.next');
  const dotsWrap = $('.pager-dots');

  // construir páginas
  const pagesEls = [];
  const allSlotEls = [];
  for (let p=0; p<BANK_PAGES; p++){
    const page = document.createElement('div');
    page.className = 'bank-page';
    const grid = document.createElement('div');
    grid.className = 'slots';
    grid.classList.add('slots--bank');
    page.appendChild(grid);
    track.appendChild(page);
    pagesEls.push(page);

    const start = (p * SLOTS_PER_PAGE) + 1; // bank1, bank17, etc.
    const els = buildGridWithOffset(grid, 'bank', PAGE_ROWS, PAGE_COLS, start);
    allSlotEls.push(...els);
  }

  // Dots
  dotsWrap.innerHTML = '';
  const dots = [];
  for (let i=0; i<BANK_PAGES; i++){
    const b = document.createElement('button');
    if (i===0) b.classList.add('is-active');
    b.addEventListener('click', ()=> goPage(i));
    dotsWrap.appendChild(b);
    dots.push(b);
  }

  let page = 0;
  function updateButtons(){
    btnPrev.disabled = (page === 0);
    btnNext.disabled = (page === BANK_PAGES - 1);
    dots.forEach((d,i)=> d.classList.toggle('is-active', i===page));
  }
  function goPage(n){
    page = Math.max(0, Math.min(BANK_PAGES-1, n));
    track.style.transform = `translateX(${page * -100}%)`;
    track.dataset.page = String(page);
    updateButtons();
  }

  btnPrev.addEventListener('click', ()=> goPage(page-1));
  btnNext.addEventListener('click', ()=> goPage(page+1));

  // Swipe táctil
  let startX = 0, startY = 0, swiping = false;
  track.addEventListener('touchstart', e=>{
    const t = e.touches[0]; startX = t.clientX; startY = t.clientY; swiping = false;
  }, { passive: true });
  track.addEventListener('touchmove', e=>{
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (!swiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) swiping = true;
    if (swiping) e.preventDefault();
  }, { passive: false });
  track.addEventListener('touchend', e=>{
    if (!swiping) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -40) goPage(page+1);
    else if (dx > 40) goPage(page-1);
  });

  updateButtons();

  return { allSlotEls, goPage };
}

/* ========= init ========= */
(async function init(){
  // --- BANCO paginado ---
  const pager = setupBankPager();
  const allBankEls = pager.allSlotEls;

  await loadNombrePJ();
  await loadAll();

  // Pintar los 48 slots visibles (3 páginas 4x4)
  await Promise.all(allBankEls.map(el => paintSlot(el, bankSlots[el.dataset.slot] || null)));

  // Enlazar clics en banco
  allBankEls.forEach(el => el.addEventListener('click', onSlotClick));

  // --- MOCHILA (3x3) ---
  const elsBag  = buildGrid($('#grid-bag'));   // bag1..bag9
  await Promise.all(elsBag.map(el  => paintSlot(el, bagSlots[el.dataset.slot]  || null)));
  elsBag.forEach(el => el.addEventListener('click', onSlotClick));

  // Abrir página que contenga el primer item del banco (opcional)
  const filledIdx = Object.keys(bankSlots)
    .filter(k=>/^bank\d+$/i.test(k) && bankSlots[k])
    .map(k=>parseInt(k.replace(/\D/g,''),10))
    .filter(n=>n>=1 && n<=BANK_MAX)
    .sort((a,b)=>a-b)[0];
  if (filledIdx){
    const targetPage = Math.floor((filledIdx-1)/SLOTS_PER_PAGE);
    pager.goPage(targetPage);
  }
})();
