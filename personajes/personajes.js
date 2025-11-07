// personajes.js (lista desde Firestore)
import { saveFichaFS } from "../firebase.js";

if (window.__PJS_INIT__) {
  console.warn("personajes.js ya estaba inicializado; se ignora carga duplicada.");
} else {
  window.__PJS_INIT__ = true;

  const contenedor = document.getElementById("contenedor-personajes");
  const btnNuevo   = document.getElementById("btn-nuevo");

  /* ========= Firestore ========= */
  async function getDB() {
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const { app } = await import("../firebase.js");
    return getFirestore(app);
  }

  async function fetchPersonajesFS() {
    // Lee documentos de la colección "fichas" y los convierte en {id, nombre, clase}
    const { collection, getDocs, query, orderBy } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const db = await getDB();
    const q = query(collection(db, "fichas"), orderBy("nombre", "asc"));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      list.push({
        id: docSnap.id,
        nombre: (data.nombre || "Personaje").toString(),
        clase: (data.clase || "Aventurero").toString(),
      });
    });
    return list;
  }

  /* ========= cache offline opcional ========= */
  function getCache() {
    try { return JSON.parse(localStorage.getItem("personajes_cache") || "[]"); } catch { return []; }
  }
  function setCache(list) {
    try { localStorage.setItem("personajes_cache", JSON.stringify(list)); } catch {}
  }

  /* ========= UI listado ========= */
  async function mostrarPersonajes() {
    if (!contenedor) return;

    // Pintado inicial (cache opcional) mientras llega Firestore
    const pinta = (arr) => {
      contenedor.innerHTML = "";
      if (!arr || arr.length === 0) {
        contenedor.innerHTML = "<p>No hay personajes creados aún.</p>";
        return;
      }
      arr.forEach((p) => {
        const div = document.createElement("div");
        div.classList.add("personaje");
        div.dataset.id = p.id;

        const info = document.createElement("div");
        info.className = "info";
        info.innerHTML = `<span class="nombre">${p.nombre}</span> <small class="clase">(${p.clase})</small>`;

        const btnBorrar = document.createElement("button");
        btnBorrar.innerHTML = "🗑️";
        btnBorrar.title = "Eliminar personaje";
        btnBorrar.className = "btn btn-borrar";
        btnBorrar.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          if (!confirm(`¿Eliminar personaje "${p.nombre}" también de Firebase?`)) return;

          // 🔥 Eliminar en Firestore
          try {
            const { deleteDoc, doc } =
              await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const db = await getDB();
            await deleteDoc(doc(db, "fichas", p.id));
            try { await deleteDoc(doc(db, "bancos", p.id)); } catch {}
          } catch (err) {
            console.warn("Error al eliminar ficha en Firebase:", err);
          }

          // Limpiar active si era este
          try {
            if (localStorage.getItem("active_pj") === p.id) localStorage.removeItem("active_pj");
          } catch {}

          // Refrescar lista
          await recargarDesdeFS();
        });

        div.append(info, btnBorrar);

        div.addEventListener("click", () => {
          try { localStorage.setItem("active_pj", p.id); } catch {}
          window.location.href = `ficha.html?id=${encodeURIComponent(p.id)}`;
        });

        contenedor.appendChild(div);
      });
    };

    // pinta cache si hay
    const cached = getCache();
    if (cached.length) pinta(cached);
    else contenedor.innerHTML = "<p>Cargando personajes…</p>";

    // luego trae FS y repinta
    await recargarDesdeFS();

    async function recargarDesdeFS() {
      try {
        const list = await fetchPersonajesFS();
        setCache(list);
        pinta(list);
      } catch (e) {
        console.warn("No se pudo cargar lista desde Firestore:", e);
        if (!cached.length) contenedor.innerHTML = "<p>No se pudo cargar la lista (sin conexión).</p>";
      }
    }
  }

  /* ========= creación (opcional con prompts) ========= */
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

      // Guarda la ficha completa en Firestore (la lista se leerá de allí)
      const ficha = defaultFichaFor({ nombre, clase });
      try { await saveFichaFS(id, ficha); } catch (e) {
        alert("No se pudo guardar la ficha en Firestore.");
        console.warn("saveFichaFS error:", e);
        return;
      }

      // Marca activo y abre ficha
      try { localStorage.setItem("active_pj", id); } catch {}
      window.location.href = `ficha.html?id=${encodeURIComponent(id)}`;
    } finally {
      creando = false;
      if (btnNuevo) { btnNuevo.disabled = false; btnNuevo.textContent = prevText ?? "➕ Nuevo personaje"; }
    }
  });

  /* ========= init ========= */
  mostrarPersonajes();
}
