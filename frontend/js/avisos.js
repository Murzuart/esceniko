/**
 * Manejo de formularios conectados al API:
 * - login.html (Inicio de sesión)
 * - registro.html (Registro de usuarios)
 * - mi-perfil.html (CRUD de perfil de artista y Panel de Administración)
 */
(function () {
  var API = window.ESCENIKO_API;
  if (!API) { return; }

  function mostrarAlerta(contenedor, mensaje, esError) {
    if (!contenedor) { return; }
    contenedor.hidden = false;
    contenedor.textContent = mensaje;
    if (esError) {
      contenedor.className = 'auth-error';
      contenedor.setAttribute('role', 'alert');
    } else {
      contenedor.className = 'auth-estado';
      contenedor.setAttribute('role', 'status');
    }
  }

  function escaparHTML(texto) {
    var div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
  }

  // --- 1. LOGIN (login.html) ---
  function iniciarLogin() {
    var form = document.getElementById('form-login');
    if (!form) { return; }
    var cajaError = document.getElementById('login-error');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var email = form.email.value.trim();
      var password = form.password.value;
      var recordar = form.recordar ? form.recordar.checked : true;

      try {
        var res = await API.request('/login', {
          method: 'POST',
          body: { email: email, password: password },
        });
        API.guardarSesion(res.token, res.usuario, recordar);
        window.location.href = res.usuario.rol === 'cliente' ? 'index.html' : 'mi-perfil.html';
      } catch (err) {
        mostrarAlerta(cajaError, err.message, true);
      }
    });
  }

  // --- 2. REGISTRO (registro.html) ---
  function iniciarRegistro() {
    var form = document.getElementById('form-registro');
    if (!form) { return; }
    var cajaError = document.getElementById('registro-error');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var rolSeleccionado = form.querySelector('input[name="rol"]:checked');
      var payload = {
        nombre: form.nombre.value.trim(),
        email: form.email.value.trim(),
        password: form.password.value,
        rol: rolSeleccionado ? rolSeleccionado.value : 'artista',
      };

      try {
        var res = await API.request('/registro', {
          method: 'POST',
          body: payload,
        });
        API.guardarSesion(res.token, res.usuario, true);
        window.location.href = res.usuario.rol === 'cliente' ? 'index.html' : 'mi-perfil.html';
      } catch (err) {
        mostrarAlerta(cajaError, err.message, true);
      }
    });
  }

  // --- 3. CRUD PERFIL Y PANEL ADMINISTRADOR (mi-perfil.html) ---
  async function iniciarPanelPerfil() {
    var form = document.getElementById('form-perfil');
    if (!form) { return; }

    var token = API.obtenerToken();
    var usuario = API.obtenerUsuario();
    if (!token || !usuario) {
      window.location.href = 'login.html';
      return;
    }

    // Validar sesión activa en el servidor
    try {
      usuario = await API.request('/sesion');
    } catch (e) {
      window.location.href = 'login.html';
      return;
    }

    var tarjeta = form.closest('.auth-tarjeta');
    var eyebrow = tarjeta ? tarjeta.querySelector('.eyebrow') : null;
    var titulo = document.getElementById('titulo-mi-perfil');
    var btnSubmit = form.querySelector('button[type="submit"]');

    var cajaMensaje = document.createElement('div');
    cajaMensaje.id = 'perfil-mensaje';
    cajaMensaje.hidden = true;
    form.parentNode.insertBefore(cajaMensaje, form);

    var artistaEditandoId = null;

    // Botón eliminar (para editar/borrar perfil)
    var btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'btn-texto';
    btnEliminar.textContent = 'Eliminar perfil';
    btnEliminar.style.marginLeft = '12px';
    btnEliminar.style.color = '#b91c1c';
    btnEliminar.hidden = true;
    btnSubmit.parentNode.appendChild(btnEliminar);

    // Botón cancelar edición (modo admin)
    var btnCancelarEdicion = document.createElement('button');
    btnCancelarEdicion.type = 'button';
    btnCancelarEdicion.className = 'btn-texto';
    btnCancelarEdicion.textContent = 'Nuevo registro';
    btnCancelarEdicion.style.marginLeft = '12px';
    btnCancelarEdicion.hidden = true;
    btnSubmit.parentNode.appendChild(btnCancelarEdicion);

    function cargarEnFormulario(artista) {
      if (!artista) {
        artistaEditandoId = null;
        form.reset();
        if (titulo) {
          titulo.textContent = usuario.rol === 'admin' ? 'Crear nuevo artista' : 'Publicar mi perfil';
        }
        btnSubmit.textContent = usuario.rol === 'admin' ? 'Guardar artista' : 'Enviar mi perfil';
        btnEliminar.hidden = true;
        btnCancelarEdicion.hidden = true;
        return;
      }

      artistaEditandoId = artista.id;
      form.nombre_artistico.value = artista.nombre_artistico || '';
      form.disciplina.value = artista.disciplina || '';
      form.oferta.value = artista.oferta || '';
      form.modalidad.value = artista.modalidad || '';
      form.ciudad.value = artista.ciudad || '';
      form.precio.value = artista.precio != null ? artista.precio : '';
      form.whatsapp.value = artista.whatsapp || '';
      form.descripcion_corta.value = artista.descripcion_corta || '';
      form.descripcion.value = artista.descripcion || '';

      if (titulo) {
        titulo.textContent = usuario.rol === 'admin'
          ? 'Editando artista #' + artista.id + ': ' + artista.nombre_artistico
          : 'Editar mi perfil';
      }
      btnSubmit.textContent = 'Actualizar cambios';
      btnEliminar.hidden = false;
      btnCancelarEdicion.hidden = usuario.rol !== 'admin';
    }

    btnCancelarEdicion.addEventListener('click', function () {
      cajaMensaje.hidden = true;
      cargarEnFormulario(null);
    });

    btnEliminar.addEventListener('click', async function () {
      if (!artistaEditandoId) { return; }
      if (!confirm('¿Seguro que deseas eliminar este perfil artístico de la base de datos?')) { return; }

      try {
        await API.request('/artistas/' + artistaEditandoId, { method: 'DELETE' });
        mostrarAlerta(cajaMensaje, 'Perfil eliminado correctamente de la base de datos.', false);
        cargarEnFormulario(null);
        if (usuario.rol === 'admin') { await cargarTablaAdmin(); }
      } catch (err) {
        mostrarAlerta(cajaMensaje, err.message, true);
      }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var precioVal = form.precio.value.trim();
      var payload = {
        nombre_artistico: form.nombre_artistico.value.trim(),
        disciplina: form.disciplina.value,
        oferta: form.oferta.value,
        modalidad: form.modalidad.value,
        ciudad: form.ciudad.value.trim(),
        precio: precioVal !== '' ? parseInt(precioVal, 10) : null,
        whatsapp: form.whatsapp.value.trim(),
        descripcion_corta: form.descripcion_corta.value.trim(),
        descripcion: form.descripcion.value.trim(),
        estado: 'aprobado',
      };

      try {
        if (artistaEditandoId) {
          var actualizado = await API.request('/artistas/' + artistaEditandoId, {
            method: 'PUT',
            body: payload,
          });
          mostrarAlerta(cajaMensaje, 'Perfil actualizado correctamente en SQLite.', false);
          if (usuario.rol === 'admin') {
            cargarEnFormulario(null);
            await cargarTablaAdmin();
          } else {
            cargarEnFormulario(actualizado);
          }
        } else {
          var creado = await API.request('/artistas', {
            method: 'POST',
            body: payload,
          });
          mostrarAlerta(cajaMensaje, 'Perfil publicado correctamente en SQLite.', false);
          if (usuario.rol === 'admin') {
            cargarEnFormulario(null);
            await cargarTablaAdmin();
          } else {
            cargarEnFormulario(creado);
          }
        }
      } catch (err) {
        mostrarAlerta(cajaMensaje, err.message, true);
      }
    });

    // --- MODO ADMINISTRADOR: Tabla completa de CRUD ---
    var contenedorAdmin = null;
    async function cargarTablaAdmin() {
      if (!contenedorAdmin) {
        contenedorAdmin = document.createElement('div');
        contenedorAdmin.style.marginTop = '2.5rem';
        contenedorAdmin.style.borderTop = '1px solid rgba(0,0,0,0.12)';
        contenedorAdmin.style.paddingTop = '1.5rem';
        tarjeta.appendChild(contenedorAdmin);
      }

      try {
        var lista = await API.request('/admin/artistas');
        var filasHTML = lista.map(function (a) {
          return (
            '<tr style="border-bottom:1px solid rgba(0,0,0,0.08);">' +
              '<td style="padding:10px 8px;">' + a.id + '</td>' +
              '<td style="padding:10px 8px;"><strong>' + escaparHTML(a.emoji + ' ' + a.nombre_artistico) + '</strong><br><small>' + escaparHTML(a.ciudad) + '</small></td>' +
              '<td style="padding:10px 8px;">' + escaparHTML(a.disciplina_nombre) + '</td>' +
              '<td style="padding:10px 8px;">' + escaparHTML(a.modalidad_texto) + '</td>' +
              '<td style="padding:10px 8px; white-space:nowrap;">' +
                '<button type="button" class="btn-texto btn-editar-admin" data-id="' + a.id + '">Editar</button> ' +
                '<button type="button" class="btn-texto btn-borrar-admin" data-id="' + a.id + '" style="color:#b91c1c;">Eliminar</button>' +
              '</td>' +
            '</tr>'
          );
        }).join('');

        contenedorAdmin.innerHTML =
          '<h2 style="margin-bottom:0.75rem;">Artistas registrados en Base de Datos (' + lista.length + ')</h2>' +
          '<div style="overflow-x:auto;">' +
            '<table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.95rem;">' +
              '<thead>' +
                '<tr style="border-bottom:2px solid rgba(0,0,0,0.15);">' +
                  '<th style="padding:8px;">ID</th>' +
                  '<th style="padding:8px;">Artista</th>' +
                  '<th style="padding:8px;">Disciplina</th>' +
                  '<th style="padding:8px;">Modalidad</th>' +
                  '<th style="padding:8px;">Acciones CRUD</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' + filasHTML + '</tbody>' +
            '</table>' +
          '</div>';

        contenedorAdmin.querySelectorAll('.btn-editar-admin').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idObj = Number(btn.dataset.id);
            var encontrado = lista.find(function (x) { return x.id === idObj; });
            if (encontrado) {
              cargarEnFormulario(encontrado);
              tarjeta.scrollIntoView({ behavior: 'smooth' });
            }
          });
        });

        contenedorAdmin.querySelectorAll('.btn-borrar-admin').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            var idObj = Number(btn.dataset.id);
            if (!confirm('¿Eliminar el artista #' + idObj + ' de la base de datos?')) { return; }
            try {
              await API.request('/artistas/' + idObj, { method: 'DELETE' });
              mostrarAlerta(cajaMensaje, 'Artista #' + idObj + ' eliminado de SQLite.', false);
              if (artistaEditandoId === idObj) { cargarEnFormulario(null); }
              await cargarTablaAdmin();
            } catch (err) {
              mostrarAlerta(cajaMensaje, err.message, true);
            }
          });
        });
      } catch (err) {
        contenedorAdmin.innerHTML = '<p role="alert">Error cargando artistas: ' + escaparHTML(err.message) + '</p>';
      }
    }

    if (usuario.rol === 'admin') {
      if (eyebrow) { eyebrow.textContent = 'Panel de administración'; }
      cargarEnFormulario(null);
      await cargarTablaAdmin();
    } else {
      try {
        var miArtista = await API.request('/mi-artista');
        cargarEnFormulario(miArtista);
      } catch (e) {
        cargarEnFormulario(null);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    iniciarLogin();
    iniciarRegistro();
    iniciarPanelPerfil();
  });
})();