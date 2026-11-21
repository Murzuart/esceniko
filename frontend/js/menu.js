/**
 * Menú adaptable de Esceniko.
 * Botón con aria-expanded: se abre con clic, Enter o Espacio y se cierra con Escape.
 */
(function () {
  var cabecera = document.querySelector('header.top');
  if (!cabecera) { return; }
  var boton = cabecera.querySelector('.menu-toggle');
  var menu = document.getElementById('menu-principal');
  if (!boton || !menu) { return; }
  var consulta = window.matchMedia('(max-width: 820px)');

  function abrir(abierto) {
    cabecera.classList.toggle('abierto', abierto);
    boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  }

  boton.addEventListener('click', function () {
    abrir(boton.getAttribute('aria-expanded') !== 'true');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && boton.getAttribute('aria-expanded') === 'true') {
      abrir(false);
      boton.focus();
    }
  });

  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) { abrir(false); }
  });

  function alCambiar() { if (!consulta.matches) { abrir(false); } }
  if (consulta.addEventListener) { consulta.addEventListener('change', alCambiar); }
  else { consulta.addListener(alCambiar); }
})();
