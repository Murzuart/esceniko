/**
 * Consulta dinámica al API REST para index.html y artista.html.
 */
(function () {
  var API = window.ESCENIKO_API;
  if (!API) { return; }

  function escaparHTML(texto) {
    var div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
  }

  function formatearCOP(valor) {
    if (valor == null || valor === '') { return 'Precio a convenir'; }
    return 'Desde $' + Number(valor).toLocaleString('es-CO') + ' COP';
  }

  // --- VISTA INICIO (index.html) ---
  async function iniciarHome() {
    var grid = document.querySelector('.escenario-grid');
    if (!grid) { return; }

    var params = new URLSearchParams(location.search);
    var discActual = params.get('disciplina') || '';
    var qActual = params.get('s') || '';

    var campoBuscar = document.getElementById('buscar');
    if (campoBuscar) { campoBuscar.value = qActual; }

    // 1. Cargar estadísticas reales desde SQLite
    try {
      var stats = await API.request('/estadisticas');
      var fuertes = document.querySelectorAll('.estelas .estela strong');
      if (fuertes.length >= 3) {
        fuertes[0].textContent = stats.talentos;
        fuertes[1].textContent = stats.disciplinas;
        fuertes[2].textContent = stats.artistas;
      }
    } catch (e) { /* mantiene cifras por defecto si falla */ }

    // 2. Cargar disciplinas desde SQLite y activar chips sin recargar
    var chipFila = document.querySelector('.chip-fila');
    if (chipFila) {
      try {
        var disciplinas = await API.request('/disciplinas');
        var htmlChips = '<li><a class="chip ' + (!discActual ? 'activo' : '') + '" ' +
          (!discActual ? 'aria-current="true" ' : '') +
          'href="index.html#explorar" data-disc="">Todos</a></li>';

        disciplinas.forEach(function (d) {
          var activo = d.slug === discActual;
          htmlChips += '<li><a class="chip ' + (activo ? 'activo' : '') + '" ' +
            (activo ? 'aria-current="true" ' : '') +
            'href="index.html?disciplina=' + encodeURIComponent(d.slug) + '#explorar" ' +
            'data-disc="' + escaparHTML(d.slug) + '">' + escaparHTML(d.nombre) + '</a></li>';
        });
        chipFila.innerHTML = htmlChips;

        chipFila.addEventListener('click', function (e) {
          var enlace = e.target.closest('a.chip');
          if (!enlace) { return; }
          e.preventDefault();
          discActual = enlace.dataset.disc || '';
          chipFila.querySelectorAll('a.chip').forEach(function (c) {
            var esAct = (c.dataset.disc || '') === discActual;
            c.classList.toggle('activo', esAct);
            if (esAct) { c.setAttribute('aria-current', 'true'); }
            else { c.removeAttribute('aria-current'); }
          });
          cargarArtistas(discActual, qActual);
        });
      } catch (e) { /* mantiene chips del HTML */ }
    }

    // 3. Buscador conectado al API
    var formBuscar = document.querySelector('form.buscador');
    if (formBuscar) {
      formBuscar.addEventListener('submit', function (e) {
        e.preventDefault();
        qActual = campoBuscar ? campoBuscar.value.trim() : '';
        cargarArtistas(discActual, qActual);
        var secExplorar = document.getElementById('explorar');
        if (secExplorar) { secExplorar.scrollIntoView({ behavior: 'smooth' }); }
      });
    }

    var verTodo = document.querySelector('a.ver-todo');
    if (verTodo) {
      verTodo.addEventListener('click', function (e) {
        e.preventDefault();
        discActual = '';
        qActual = '';
        if (campoBuscar) { campoBuscar.value = ''; }
        if (chipFila) {
          chipFila.querySelectorAll('a.chip').forEach(function (c) {
            var esTodos = (c.dataset.disc || '') === '';
            c.classList.toggle('activo', esTodos);
            if (esTodos) { c.setAttribute('aria-current', 'true'); }
            else { c.removeAttribute('aria-current'); }
          });
        }
        cargarArtistas('', '');
      });
    }

    async function cargarArtistas(disciplina, q) {
      var query = new URLSearchParams();
      if (disciplina) { query.set('disciplina', disciplina); }
      if (q) { query.set('q', q); }
      var ruta = '/artistas' + (query.toString() ? '?' + query.toString() : '');

      try {
        var artistas = await API.request(ruta);
        if (!artistas.length) {
          grid.innerHTML =
            '<p class="sin-resultados" role="status">No se encontraron talentos para esta búsqueda.</p>';
          return;
        }

        grid.innerHTML = artistas.map(function (a, idx) {
          var num = String(idx + 1).padStart(2, '0');
          return (
            '<article class="acto" data-id="' + a.id + '" data-disciplina="' + escaparHTML(a.disciplina) + '">' +
              '<div class="foco">' +
                '<span class="numero-acto" aria-hidden="true">ACTO ' + num + '</span>' +
                '<span class="portada-ejemplo" aria-hidden="true">' + escaparHTML(a.emoji) + '</span>' +
              '</div>' +
              '<div class="info">' +
                '<span class="categoria-tag">' + escaparHTML(a.disciplina_nombre) + '</span>' +
                '<h3><a href="artista.html?id=' + a.id + '">' + escaparHTML(a.nombre_artistico) + '</a></h3>' +
                '<p class="meta-linea">' + escaparHTML(a.ciudad) + ' · ' + escaparHTML(a.modalidad_texto) + '</p>' +
                '<div class="extracto"><p>' + escaparHTML(a.descripcion_corta) + '</p></div>' +
              '</div>' +
            '</article>'
          );
        }).join('');
      } catch (err) {
        grid.innerHTML =
          '<p class="sin-resultados" role="alert">No se pudo conectar con el servidor API (' +
          escaparHTML(err.message) + ').</p>';
      }
    }

    await cargarArtistas(discActual, qActual);
  }

  // --- VISTA DETALLE DE ARTISTA (artista.html) ---
  async function iniciarDetalleArtista() {
    var contenedor = document.querySelector('article.perfil .wrap');
    if (!contenedor) { return; }

    var params = new URLSearchParams(location.search);
    var id = params.get('id') || '1';

    try {
      var a = await API.request('/artistas/' + encodeURIComponent(id));
      document.title = a.nombre_artistico + ' – Esceniko';

      var parrafos = (a.descripcion || a.descripcion_corta || '')
        .split(/\n+/)
        .filter(function (p) { return p.trim().length > 0; })
        .map(function (p) { return '<p>' + escaparHTML(p) + '</p>'; })
        .join('');

      var telLimpio = (a.whatsapp || '').replace(/\D/g, '');
      var mensajeWa = encodeURIComponent('Hola ' + a.nombre_artistico + ', vi tu perfil en Esceniko.');

      contenedor.innerHTML =
        '<div class="portada"><span class="portada-ejemplo" aria-hidden="true">' + escaparHTML(a.emoji) + '</span></div>' +
        '<span class="categoria-tag">' + escaparHTML(a.disciplina_nombre) + '</span>' +
        '<h1 id="titulo-artista">' + escaparHTML(a.nombre_artistico) + '</h1>' +
        '<ul class="perfil-datos" aria-label="Datos del artista">' +
          '<li><span aria-hidden="true">📍</span> ' + escaparHTML(a.ciudad) + '</li>' +
          '<li><span aria-hidden="true">🎤</span> ' + escaparHTML(a.modalidad_texto) + '</li>' +
          '<li><span aria-hidden="true">🎨</span> ' + escaparHTML(a.oferta_texto) + '</li>' +
          '<li><span aria-hidden="true">💰</span> ' + escaparHTML(formatearCOP(a.precio)) + '</li>' +
        '</ul>' +
        '<div class="descripcion">' + parrafos + '</div>' +
        '<a class="btn-primario btn-contacto" href="https://wa.me/' + telLimpio + '?text=' + mensajeWa + '" target="_blank" rel="noopener">Contactar por WhatsApp</a>';
    } catch (err) {
      contenedor.innerHTML =
        '<h1 id="titulo-artista">Artista no encontrado</h1>' +
        '<p>El perfil solicitado no existe o no está disponible.</p>' +
        '<a class="btn-primario" href="index.html#explorar">Volver al catálogo</a>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    iniciarHome();
    iniciarDetalleArtista();
  });
})();