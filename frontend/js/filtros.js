/* Filtros temporales del inicio (búsqueda y disciplina) hechos en el navegador.
   En el Paso 4 se reemplazan por llamadas al API: GET /artistas?disciplina=&q= */
(function () {
  var params = new URLSearchParams(location.search);
  var tarjetas = document.querySelectorAll('.acto');
  if (!tarjetas.length) { return; }
  var disc = params.get('disciplina') || '';
  var q = (params.get('s') || '').toLowerCase().trim();
  var visibles = 0;
  var campo = document.getElementById('buscar');
  if (campo) { campo.value = params.get('s') || ''; }

  tarjetas.forEach(function (t) {
    var ok = (!disc || t.dataset.disciplina === disc) &&
             (!q || t.textContent.toLowerCase().indexOf(q) !== -1);
    t.hidden = !ok;
    if (ok) { visibles++; }
  });

  document.querySelectorAll('.chip').forEach(function (c) {
    var d = new URL(c.href, location.href).searchParams.get('disciplina') || '';
    var activo = d === disc;
    c.classList.toggle('activo', activo);
    if (activo) { c.setAttribute('aria-current', 'true'); }
    else { c.removeAttribute('aria-current'); }
  });

  var grid = document.querySelector('.escenario-grid');
  if (grid && !visibles) {
    var p = document.createElement('p');
    p.className = 'sin-resultados';
    p.setAttribute('role', 'status');
    p.textContent = 'No se encontraron talentos para esta búsqueda.';
    grid.appendChild(p);
  }
})();
