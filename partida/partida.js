document.addEventListener('DOMContentLoaded', () => {

  const btnDado    = document.getElementById('btn-dado');
  const btnLimpiar = document.getElementById('btn-limpiar-dados');
  const cantidad   = document.getElementById('cantidadDados');
  const difSel     = document.getElementById('dificultad');
  const slots      = [...document.querySelectorAll('.dado-slot')];

  // --- Limpia los slots ---
  function limpiarSlots() {
    slots.forEach(s => {
      s.textContent = '';
      s.classList.remove('filled', 'roll-red', 'roll-orange', 'roll-green', 'roll-purple');
      s.style.transform = 'scale(1)';
    });
  }

  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', limpiarSlots);
  }

  // --- Determina color según dificultad y valor ---
  function classForRoll(roll, diff) {
    switch (diff) {
      case 'facil':
        if (roll === 1) return 'roll-red';
        if (roll === 2) return 'roll-orange';
        if (roll >= 3 && roll <= 9) return 'roll-green';
        return 'roll-purple'; // 10-12

      case 'normal':
        if (roll === 1) return 'roll-red';
        if (roll >= 2 && roll <= 3) return 'roll-orange';
        if (roll >= 4 && roll <= 10) return 'roll-green';
        return 'roll-purple'; // 11-12

      case 'dificil':
        if (roll >= 1 && roll <= 2) return 'roll-red';
        if (roll >= 3 && roll <= 5) return 'roll-orange';
        if (roll >= 6 && roll <= 11) return 'roll-green';
        return 'roll-purple'; // 12

      case 'imposible':
        if (roll >= 1 && roll <= 3) return 'roll-red';
        if (roll >= 4 && roll <= 8) return 'roll-orange';
        if (roll >= 9 && roll <= 11) return 'roll-green';
        return 'roll-purple'; // 12
    }
  }

  // --- Botón Tirar ---
  btnDado.addEventListener('click', () => {

    limpiarSlots(); // 🔥 limpamos antes de tirar

    const n = Number(cantidad.value) || 1;
    const diff = difSel.value.toLowerCase();

    for (let i = 0; i < n && i < slots.length; i++) {
      const roll = Math.floor(Math.random() * 12) + 1;
      const target = slots[i];

      target.textContent = roll;
      target.classList.add('filled');
      target.classList.add(classForRoll(roll, diff));

      // Animación
      target.style.transform = 'scale(1.4)';
      setTimeout(() => { target.style.transform = 'scale(1)'; }, 200);
    }
  });

  // ----- Reloj: Rotación 1/12 por turno -----
let relojPaso = Number(localStorage.getItem('relojPaso') || 0);

function actualizarReloj() {
  const flecha = document.querySelector('.flecha');
  if (!flecha) return;
  const grados = relojPaso * 30; // 360° / 12 = 30°
  flecha.style.transform = `translate(-50%, -100%) rotate(${grados}deg)`;
}

// Llamar una vez al cargar la página
document.addEventListener('DOMContentLoaded', actualizarReloj);

// Integrar dentro del botón Pasar Turno
const btnTurno = document.getElementById('pasarTurno');
if (btnTurno) {
  btnTurno.addEventListener('click', () => {
    relojPaso = (relojPaso + 1) % 12; // rota y vuelve a 0 tras 12 pasos
    localStorage.setItem('relojPaso', relojPaso);
    actualizarReloj();
  });
}

});
