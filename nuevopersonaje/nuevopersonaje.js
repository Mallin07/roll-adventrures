const cards = document.querySelectorAll('.clase-card');
const info = document.getElementById('seleccion-info');
const form = document.getElementById('form-nombre');
const inputNombre = document.getElementById('nombrePJ');
const btnGuardar = document.getElementById('guardarPJ');
const err = document.getElementById('errNombre');

let claseSeleccionada = null;

// Al seleccionar una clase
cards.forEach(card => {
  const btn = card.querySelector('.btn-elegir');
  btn.addEventListener('click', () => {
    // Quitar selección previa
    cards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    claseSeleccionada = card.dataset.clase;
    const nombreClase = card.querySelector('h3').textContent;
    info.textContent = `Clase seleccionada: ${nombreClase}`;

    // Mostrar formulario
    form.classList.remove('oculto');
    err.textContent = '';
    inputNombre.value = '';
    inputNombre.focus();
  });
});

// Guardar personaje
btnGuardar.addEventListener('click', (e) => {
  e.preventDefault();
  const nombre = inputNombre.value.trim();

  if (!claseSeleccionada) {
    err.textContent = 'Primero elige una clase.';
    return;
  }
  if (!nombre) {
    err.textContent = 'Escribe un nombre para tu personaje.';
    inputNombre.focus();
    return;
  }

  const nuevo = { nombre, clase: claseSeleccionada, creadoEn: Date.now() };

  // Guardar en localStorage
  const lista = JSON.parse(localStorage.getItem('personajes') || '[]');
  lista.push(nuevo);
  localStorage.setItem('personajes', JSON.stringify(lista));

  // Redirigir a la lista
  window.location.href = '../personajes/personajes.html';
});

btnGuardar.addEventListener('click', (e) => {
  e.preventDefault();
  const nombre = inputNombre.value.trim();
  if (!claseSeleccionada) { err.textContent = 'Primero elige una clase.'; return; }
  if (!nombre) { err.textContent = 'Escribe un nombre.'; inputNombre.focus(); return; }

  const id = Date.now().toString(); // ID único simple
  const nuevo = { id, nombre, clase: claseSeleccionada, creadoEn: Date.now() };

  const lista = JSON.parse(localStorage.getItem('personajes') || '[]');
  lista.push(nuevo);
  localStorage.setItem('personajes', JSON.stringify(lista));

  // Ir a la lista (o directamente a la ficha si prefieres)
  window.location.href = '../personajes/personajes.html';
});