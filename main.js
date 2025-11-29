// main.js
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
  // Referencias del menú (por si las necesitas después)
  const btnPersonajes = document.getElementById('btn-personajes');
  const btnJuego = document.getElementById('btn-juego');
  const btnPoblado = document.getElementById('btn-poblado');
  const btnPartida = document.getElementById('btn-partida');
  const contenido = document.getElementById('contenido');

  // Referencias del login (solo existen en index.html)
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const loginSuccess = document.getElementById('login-success');
  const btnRegister = document.getElementById('btn-register');
  const loginContainer = document.getElementById('login-container');

  // Saber si estamos en index (solo ahí hay formulario de login)
  const esIndex = !!loginForm;

  // Botón de cerrar sesión (está en el header en todas las páginas)
  const btnLogout = document.getElementById('btn-logout');

  // ----------------- LOGIN (solo en index) -----------------
  if (esIndex && loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.textContent = '';
      loginSuccess.textContent = '';

      const email = loginEmail.value.trim();
      const password = loginPassword.value.trim();

      try {
        await signInWithEmailAndPassword(auth, email, password);
        loginSuccess.textContent = 'Has iniciado sesión correctamente.';
        loginForm.reset();
      } catch (err) {
        console.error(err);
        loginError.textContent = traducirErrorAuth(err.code);
      }
    });
  }

  if (esIndex && btnRegister) {
    btnRegister.addEventListener('click', async () => {
      loginError.textContent = '';
      loginSuccess.textContent = '';

      const email = loginEmail.value.trim();
      const password = loginPassword.value.trim();

      if (!email || !password) {
        loginError.textContent = 'Introduce correo y contraseña para registrarte.';
        return;
      }

      try {
        await createUserWithEmailAndPassword(auth, email, password);
        loginSuccess.textContent = 'Usuario creado correctamente. Ya has iniciado sesión.';
        loginForm.reset();
      } catch (err) {
        console.error(err);
        loginError.textContent = traducirErrorAuth(err.code);
      }
    });
  }

  // ----------------- CAMBIOS DE SESIÓN -----------------
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Mostrar botón de logout en cualquier página
      if (btnLogout) btnLogout.style.display = 'inline-block';

      // Solo en index: ocultar login y mostrar mensaje de bienvenida
      if (esIndex) {
        if (loginContainer) loginContainer.style.display = 'none';
        if (contenido) {
          contenido.innerHTML = `
          <h3 class="mensaje-bienvenida">Bienvenido, ${user.email}</h3>
          `;
        }
      }
    } else {
      // Usuario deslogeado
      if (btnLogout) btnLogout.style.display = 'none';

      // Solo en index: mostrar formulario de login
      if (esIndex && loginContainer) {
        loginContainer.style.display = 'block';
      }
    }
  });

  // ----------------- CERRAR SESIÓN -----------------
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await signOut(auth);
        // Al cerrar sesión, recargamos para que en index reaparezca el formulario
        location.reload();
      } catch (err) {
        console.error('Error al cerrar sesión', err);
      }
    });
  }
}); // 👈 aquí cerramos el DOMContentLoaded

// Función para traducir algunos errores típicos de Firebase Auth
function traducirErrorAuth(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'El correo no tiene un formato válido.';
    case 'auth/user-disabled':
      return 'Este usuario ha sido deshabilitado.';
    case 'auth/user-not-found':
      return 'No existe ningún usuario con ese correo.';
    case 'auth/wrong-password':
      return 'Contraseña incorrecta.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con ese correo.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil (mínimo 6 caracteres).';
    default:
      return 'Ha ocurrido un error al autenticar. Inténtalo de nuevo.';
  }
}
