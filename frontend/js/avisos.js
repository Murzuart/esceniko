/* Temporal: los formularios todavía no están conectados al API (Paso 4). */
document.querySelectorAll('form[data-pendiente]').forEach(function (f) {
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!f.checkValidity()) { f.reportValidity(); return; }
    var el = f.querySelector('.auth-estado-js');
    if (!el) {
      el = document.createElement('p');
      el.className = 'auth-estado auth-estado-js';
      el.setAttribute('role', 'status');
      f.insertBefore(el, f.firstChild);
    }
    el.textContent = 'Formulario válido. Aún no está conectado al API.';
  });
});
