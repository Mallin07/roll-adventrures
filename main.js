// main.js

// Referencias
const btnPersonajes = document.getElementById('btn-personajes');
const btnJuego = document.getElementById('btn-juego');
const contenido = document.getElementById('contenido');

// Acciones
btnPersonajes.addEventListener('click', () => {
  contenido.innerHTML = `<h2>Sección de Personajes</h2><p>Aquí podrás ver y editar tus personajes.</p>`;
});

btnJuego.addEventListener('click', () => {
  contenido.innerHTML = `<h2>Modo de Juego</h2><p>Aquí cargaremos el tablero y las fichas.</p>`;
});
