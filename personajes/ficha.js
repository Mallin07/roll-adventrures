// ===== util =====
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));

// ===== leer id de la URL =====
const params = new URLSearchParams(location.search);
const PJ_ID = params.get('id'); // puede ser null si entras directo

// ===== cargar personaje (nombre y clase) =====
function getPersonajes(){ return JSON.parse(localStorage.getItem('personajes') || '[]'); }
const pj = getPersonajes().find(p => p.id === PJ_ID);

// ===== defaults por clase (si no había ficha guardada) =====
const BASE_BY_CLASS = {
  cuerpo:     { nivel:1, fuerza:9, defensa:9, destreza:6, sabiduria:4, velocidad:7 },
  habilidoso: { nivel:1, fuerza:7, defensa:4, destreza:9, sabiduria:5, velocidad:9 },
  brujo:      { nivel:1, fuerza:3, defensa:3, destreza:7, sabiduria:10, velocidad:8 },
};

const state = {
  nivel: 1, fuerza:2, defensa:3, destreza:1, sabiduria:2, velocidad:2,
  elemental:{ atk:{fuego:0,agua:0,tierra:0,aire:0}, def:{fuego:0,agua:0,tierra:0,aire:0} },
  mods:{ fuerza:0, defensa:0, destreza:0, sabiduria:0, velocidad:0 }
};

// ===== rellenar cabecera con datos del personaje =====
if (pj) {
  $('#nombrePJ').textContent = pj.nombre;
  $('#clasePJ').textContent  = `(${pj.clase})`;
} else {
  // si no hay id, muestra genérico
  $('#nombrePJ').textContent = 'Nombre del personaje';
  $('#clasePJ').textContent  = '(Tipo de personaje)';
}

// ===== funciones de render =====
function renderStats(){
  $$('.stat-controls').forEach(ctrl=>{
    const key = ctrl.dataset.key;
    ctrl.querySelector('output').textContent = (state[key] || 0) + (state.mods[key]||0);
  });
  $('#atk-fuego').textContent   = state.elemental.atk.fuego;
  $('#atk-agua').textContent    = state.elemental.atk.agua;
  $('#atk-tierra').textContent  = state.elemental.atk.tierra;
  $('#atk-aire').textContent    = state.elemental.atk.aire;
  $('#def-fuego').textContent   = state.elemental.def.fuego;
  $('#def-agua').textContent    = state.elemental.def.agua;
  $('#def-tierra').textContent  = state.elemental.def.tierra;
  $('#def-aire').textContent    = state.elemental.def.aire;
}

// ===== construir pips =====
function buildPips(){
  $$('.pips').forEach(container=>{
    const type = container.dataset.type;
    container.innerHTML = '';
    for(let i=0;i<10;i++){
      const dot = document.createElement('button');
      dot.className = `pip ${type}`;
      dot.addEventListener('click', ()=> dot.classList.toggle('active'));
      container.appendChild(dot);
    }
  });
}

// ===== cargar ficha previa o defaults por clase =====
function loadSheet(){
  const key = PJ_ID ? `ficha_${PJ_ID}` : 'ficha_actual';
  const raw = localStorage.getItem(key);
  if (raw) {
    try{
      const d = JSON.parse(raw);
      Object.assign(state, d.state||state);
      renderStats();
      // lesiones
      $$('.part').forEach(p=>p.classList.remove('injured'));
      (d.injured||[]).forEach(id=>{
        const el = document.querySelector(`.part[data-part="${id}"]`);
        if(el) el.classList.add('injured');
      });
      // pips
      const groups = $$('.pips');
      (d.pips||[]).forEach((arr,gi)=>{
        if(!groups[gi]) return;
        [...groups[gi].children].forEach((dot,i)=> dot.classList.toggle('active', !!arr[i]));
      });
      return;
    }catch(e){ console.warn('No se pudo cargar ficha:', e); }
  }
  // si no había ficha guardada, aplicar base por clase
  if (pj && BASE_BY_CLASS[pj.clase]) {
    Object.assign(state, BASE_BY_CLASS[pj.clase]);
  }
  renderStats();
}

// ===== guardar ficha =====
function saveSheet(){
  const payload = {
    nombre: $('#nombrePJ').textContent.trim(),
    clase:  $('#clasePJ').textContent.trim(),
    state,
    injured: $$('.part').filter(p=>p.classList.contains('injured')).map(p=>p.dataset.part),
    pips: $$('.pips').map(c=>[...c.children].map(dot=>dot.classList.contains('active')))
  };
  const key = PJ_ID ? `ficha_${PJ_ID}` : 'ficha_actual';
  localStorage.setItem(key, JSON.stringify(payload));
}

// ===== eventos de + / - =====
function wireStatButtons(){
  $$('.stat-controls').forEach(ctrl=>{
    const key = ctrl.dataset.key;
    ctrl.querySelector('.minus').addEventListener('click', ()=>{
      state[key] = clamp((state[key]||0)-1, 0, 99);
      renderStats(); saveSheet();
    });
    ctrl.querySelector('.plus').addEventListener('click', ()=>{
      state[key] = clamp((state[key]||0)+1, 0, 99);
      renderStats(); saveSheet();
    });
  });
}

// ===== lesiones clic =====
function wireParts(){
  $$('.part').forEach(b=>{
    b.addEventListener('click', ()=>{ b.classList.toggle('injured'); saveSheet(); });
  });
}

// ===== slots (idéntico a la versión anterior; aplican mods y guardan) =====
// ... (puedes mantener exactamente el mismo código de slots/tryLoadLocal/getItemData/applyItemMods)
// Solo añade al final de cada cambio: saveSheet();

buildPips();
loadSheet();
renderStats();
wireStatButtons();
wireParts();
window.addEventListener('beforeunload', saveSheet);
