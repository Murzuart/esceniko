window.ESCENIKO_API = (function () {
  var BASE_URL = 'http://127.0.0.1:8000';
  var KEY_TOKEN = 'esceniko_token';
  var KEY_USUARIO = 'esceniko_usuario';

  function getStorage() {
    if (localStorage.getItem(KEY_TOKEN)) { return localStorage; }
    if (sessionStorage.getItem(KEY_TOKEN)) { return sessionStorage; }
    return localStorage;
  }

  function guardarSesion(token, usuario, recordar) {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USUARIO);
    sessionStorage.removeItem(KEY_TOKEN);
    sessionStorage.removeItem(KEY_USUARIO);
    var store = recordar === false ? sessionStorage : localStorage;
    store.setItem(KEY_TOKEN, token);
    store.setItem(KEY_USUARIO, JSON.stringify(usuario));
  }

  function limpiarSesion() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USUARIO);
    sessionStorage.removeItem(KEY_TOKEN);
    sessionStorage.removeItem(KEY_USUARIO);
  }

  function obtenerToken() { return getStorage().getItem(KEY_TOKEN); }

  function obtenerUsuario() {
    try {
      var raw = getStorage().getItem(KEY_USUARIO);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  async function request(ruta, opciones) {
    var opts = opciones || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    var token = obtenerToken();
    if (token) { headers['Authorization'] = 'Bearer ' + token; }

    var resp = await fetch(BASE_URL + ruta, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    var data = null;
    try { data = await resp.json(); } catch (e) { data = null; }

    if (!resp.ok) {
      if (resp.status === 401 && token) { limpiarSesion(); }
      var msg = (data && data.detail) ? data.detail : 'Error al comunicarse con el servidor';
      if (Array.isArray(msg)) { msg = msg.map(function (m) { return m.msg; }).join('. '); }
      throw new Error(msg);
    }
    return data;
  }

  async function cerrarSesion() {
    try { await request('/logout', { method: 'POST' }); } catch (e) {}
    limpiarSesion();
    window.location.href = 'index.html';
  }

  function actualizarBarraNavegacion() {
    var usuario = obtenerUsuario();
    var token = obtenerToken();
    var navCta = document.querySelector('.nav-cta');
    if (!navCta) { return; }

    if (usuario && token) {
      var primerNombre = usuario.nombre.split(' ')[0];
      var etiquetaPanel = usuario.rol === 'admin' ? 'Panel Admin' : 'Mi perfil';
      navCta.innerHTML = '';

      if (usuario.rol !== 'cliente') {
        var linkPerfil = document.createElement('a');
        linkPerfil.className = 'btn-texto';
        linkPerfil.href = 'mi-perfil.html';
        linkPerfil.textContent = etiquetaPanel;
        navCta.appendChild(linkPerfil);
      }

      var saludo = document.createElement('span');
      saludo.textContent = 'Hola, ' + primerNombre;
      navCta.appendChild(saludo);

      var btnSalir = document.createElement('button');
      btnSalir.type = 'button';
      btnSalir.className = 'btn-primario';
      btnSalir.textContent = 'Salir';
      btnSalir.addEventListener('click', cerrarSesion);
      navCta.appendChild(btnSalir);
    } else {
      navCta.innerHTML =
        '<a class="btn-texto" href="login.html">Iniciar sesión</a>' +
        '<a class="btn-primario" href="registro.html">Publicar mi perfil</a>';
    }
  }

  document.addEventListener('DOMContentLoaded', actualizarBarraNavegacion);

  return {
    BASE_URL: BASE_URL,
    request: request,
    guardarSesion: guardarSesion,
    limpiarSesion: limpiarSesion,
    obtenerToken: obtenerToken,
    obtenerUsuario: obtenerUsuario,
    cerrarSesion: cerrarSesion,
    actualizarBarraNavegacion: actualizarBarraNavegacion,
  };
})();