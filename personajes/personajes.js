const contenedor = document.getElementById("contenedor-personajes");

function getPersonajes() {
  return JSON.parse(localStorage.getItem('personajes') || '[]');
}
function savePersonajes(pjs) {
  localStorage.setItem('personajes', JSON.stringify(pjs));
}

function mostrarPersonajes() {
  const personajes = getPersonajes();
  contenedor.innerHTML = "";

  if (personajes.length === 0) {
    contenedor.innerHTML = "<p>No hay personajes creados aún.</p>";
    return;
  }

  personajes.forEach((p, i) => {
    const div = document.createElement("div");
    div.classList.add("personaje");
    div.dataset.id = p.id;
    div.innerHTML = `<span>${p.nombre}</span> <small>(${p.clase})</small>`;

    div.style.cursor = 'pointer';
    div.addEventListener('click', () => {
      // Abrir la ficha con el id del personaje
      window.location.href = `ficha.html?id=${encodeURIComponent(p.id)}`;
    });

    // (opcional) botón borrar
    const btnBorrar = document.createElement("button");
    btnBorrar.textContent = "🗑️";
    btnBorrar.classList.add("btn-borrar");
    btnBorrar.addEventListener("click", (ev) => {
      ev.stopPropagation(); // no abrir la ficha
      if (!confirm("¿Eliminar personaje?")) return;
      const lista = getPersonajes();
      const idx = lista.findIndex(x => x.id === p.id);
      if (idx >= 0) {
        lista.splice(idx, 1);
        savePersonajes(lista);
        mostrarPersonajes();
      }
    });

    div.appendChild(btnBorrar);
    contenedor.appendChild(div);
  });
}

mostrarPersonajes();
