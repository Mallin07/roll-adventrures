// personajes.js
import { saveFichaFS } from "../firebase.js";

if (window.__PJS_INIT__) {
  console.warn("personajes.js ya estaba inicializado; se ignora carga duplicada.");
} else {
  window.__PJS_INIT__ = true;

  const contenedor = document.getElementById("contenedor-personajes");
  const btnNuevo   = document.getElementById("btn-nuevo");

  /* ========= helpers almacenamiento local ========= */
  function getPersonajes() {
    return JSON.parse(localStorage.getItem('personajes') || '[]');
  }
  function savePersonajes(pjs) {
    localStorage.setItem('personajes', JSON.stringify(pjs));
  }

  /* ========= bases / defaults ========= */
  const BASE_BY_CLASS = {
    Guerrero: { fuerza:4, defensa:3, destreza:1, sabiduria:1, velocidad:2 },
    Mago:     { fuerza:1, defensa:1, destreza:2, sabiduria:4, velocidad:2 },
    Picaro:   { fuerza:2, defensa:2, destreza:4, sabiduria:1, velocidad:3 },
  };
  const DEFAULT_STATE = { fuerza:2, defensa:3, destreza:1, sabiduria:2, velocidad:2 };

  function baseForClass(clase){
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

  /* ========= utils ========= */
  function normalizeClase(c){
    return String(c || "")
      .replace(/^\s*\(/, "")
      .replace(/\)\s*$/, "")
      .trim() || "Aventurero";
  }

  function makeId(){
    if (crypto?.randomUUID) return crypto.randomUUID();
    return 'pj_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  }

  function dedupeListaPersonajes() {
    const raw = getPersonajes();
    const seen = new Set();
    const sane = [];

    for (const p of raw) {
      const id = (p && p.id) ? String(p.id) : "";
      if (!id || id === "undefined") continue;
      if (seen.has(id)) continue;

      const nombre = (p?.nombre || "").trim() || "Personaje";
      const clase  = normalizeClase(p?.clase || "Aventurero");
      sane.push({ id, nombre, clase });
      seen.add(id);
    }

    if (JSON.stringify(raw) !== JSON.stringify(sane)) {
      savePersonajes(sane);
    }
    return sane;
  }

  /* ========= UI listado ========= */
  function mostrarPersonajes() {
    const personajes = dedupeListaPersonajes();
    if (!contenedor) return;
    contenedor.innerHTML = "";

    if (personajes.length === 0) {
      contenedor.innerHTML = "<p>No hay personajes creados aún.</p>";
      return;
    }

    personajes.forEach((p) => {
      const div = document.createElement("div");
      div.classList.add("personaje");
      div.dataset.id = p.id;

      const info = document.createElement("div");
      info.className = "info";
      info.innerHTML = `<span class="nombre">${p.nombre}</span> <small class="clase">(${p.clase})</small>`;

      // Botón borrar
      const btnBorrar = document.createElement("button");
      btnBorrar.innerHTML = "🗑️";
      btnBorrar.title = "Eliminar personaje";
      btnBorrar.className = "btn btn-borrar";
      btnBorrar.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        if (!confirm(`¿Eliminar personaje "${p.nombre}" también de Firebase?`)) return;

        const lista = getPersonajes();
        const idx = lista.findIndex(x => x.id === p.id);
        if (idx < 0) return;

        const [removed] = lista.splice(idx, 1);
        savePersonajes(lista);

        try { localStorage.removeItem(`ficha_${removed.id}`); } catch {}
        try {
          if (localStorage.getItem('active_pj') === removed.id) {
            localStorage.removeItem('active_pj');
          }
        } catch {}

        // 🔥 Eliminar también en Firestore
        try {
          const { deleteDoc, doc, getFirestore } =
            await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
          const { app } = await import("../firebase.js");
          const db = getFirestore(app);

          await deleteDoc(doc(db, "fichas", removed.id));
          try { await deleteDoc(doc(db, "bancos", removed.id)); } catch {}
          console.log(`Personaje ${removed.nombre} eliminado de Firestore.`);
        } catch (err) {
          console.warn("Error al eliminar ficha en Firebase:", err);
        }

        mostrarPersonajes();
      });

      div.append(info, btnBorrar);

      div.addEventListener('click', () => {
        try { localStorage.setItem('active_pj', p.id); } catch {}
        window.location.href = `ficha.html?id=${encodeURIComponent(p.id)}`;
      });

      contenedor.appendChild(div);
    });
  }

  /* ========= crear nuevo personaje ========= */
  let creando = false;
  btnNuevo?.addEventListener("click", async () => {
    if (creando) return;
    creando = true;
    const prevText = btnNuevo?.textContent;
    if (btnNuevo) { btnNuevo.disabled = true; btnNuevo.textContent = "Creando..."; }

    try {
      const nombre = prompt("Nombre del personaje:");
      if (!nombre) return;

      const claseInput = prompt('Clase del personaje (p.ej. "Guerrero", "Mago", "Picaro"):') || "Aventurero";
      const clase = normalizeClase(claseInput);
      const id = makeId();

      const lista = dedupeListaPersonajes();
      if (!lista.some(p => p.id === id)) {
        lista.push({ id, nombre: nombre.trim(), clase });
        savePersonajes(lista);
      }

      const ficha = defaultFichaFor({ nombre, clase });
      try { await saveFichaFS(id, ficha); } catch (e) { console.warn("No se pudo guardar la ficha inicial en Firestore:", e); }
      try { localStorage.setItem(`ficha_${id}`, JSON.stringify(ficha)); } catch {}

      try { localStorage.setItem('active_pj', id); } catch {}
      window.location.href = `ficha.html?id=${encodeURIComponent(id)}`;
    } finally {
      creando = false;
      if (btnNuevo) { btnNuevo.disabled = false; btnNuevo.textContent = prevText ?? "➕ Nuevo personaje"; }
    }
  });

  /* ========= init ========= */
  mostrarPersonajes();
}
