/**
 * .Py México · servidor en Google Apps Script
 *
 * Este código convierte tu Google Sheets en la base de datos de la app.
 * Cada hoja es una tabla: usuarios, restaurantes, ventas, compras, pagos, comunidad...
 * Las hojas se crean solas la primera vez que alguien usa la app.
 *
 * Cómo publicarlo: ver LEEME.md. En corto:
 *   Extensiones > Apps Script > pega este código > Implementar > Nueva implementación >
 *   Tipo: Aplicación web · Ejecutar como: Yo · Quién tiene acceso: Cualquier persona.
 *
 * Roles:
 *   dueno   · dueño del restaurante: ve y maneja todo su restaurante.
 *   staff   · encargado: solo ventas, caja, compras y cierres de su restaurante.
 *   asesor  · del equipo: ve, sin cambiar, solo los restaurantes que el administrador le asignó.
 *   admin   · administrador: activa planes y funciones, crea asesores y los asigna.
 *             NO puede abrir las finanzas de ningún restaurante desde la app.
 */

/* ===================== Estructura de las hojas ===================== */
// Tipos: n = número, b = sí/no, j = lista o datos (JSON). Sin letra = texto.
var COLECCIONES = {
  ventas:       ['fecha', 'monto:n', 'metodo', 'nota'],
  productos:    ['nombre', 'unidad', 'precioRef:n'],
  proveedores:  ['nombre', 'telefono', 'credito:n'],
  compras:      ['fecha', 'productId', 'cantidad:n', 'costo:n', 'supplierId'],
  cierres:      ['fecha', 'productId', 'sobrante:n', 'merma:n'],
  empleados:    ['nombre', 'puesto', 'sueldo:n', 'periodicidad', 'ingreso', 'activo:b'],
  nominas:      ['tipo', 'inicio', 'fin', 'fechaPago', 'total:n', 'estado', 'items:j'],
  gastos_fijos: ['nombre', 'categoria', 'monto:n', 'frecuencia', 'dia:n', 'diaSemana:n', 'activo:b', 'desde'],
  pagos:        ['concepto', 'categoria', 'monto:n', 'vence', 'estado', 'pagadoEl', 'proveedor', 'origen', 'key', 'estimado:b', 'payrollId'],
  reserva:      ['fecha', 'tipo', 'monto:n', 'nota'],
  movimientos:  ['fecha', 'tipo', 'monto:n', 'nota'],
  promociones:  ['nombre', 'dia:n', 'tipo', 'desc', 'precio', 'horario', 'inicio', 'activa:b'],
  cortes:       ['fecha', 'fondo:n', 'ventasEf:n', 'gastosEf:n', 'contado:n', 'nota'],
  mensajes:     ['fecha', 'de', 'autor', 'texto']
};
var SISTEMA = {
  usuarios:      ['id', 'email', 'nombre', 'rol', 'restauranteId', 'hash', 'salt', 'creado', 'activo:b', 'aviso'],
  sesiones:      ['token', 'usuarioId', 'creado', 'expira'],
  restaurantes:  ['id', 'nombre', 'ciudad', 'giro', 'plan', 'creado', 'datos:j', 'asesor:j', 'funciones:j', 'suspendido:b', 'solicitud'],
  publicaciones: ['id', 'autorId', 'autor', 'restaurante', 'ciudad', 'categoria', 'fecha', 'titulo', 'cuerpo', 'votos:j', 'denuncias:j', 'oculta:b'],
  comentarios:   ['id', 'publicacionId', 'autorId', 'autor', 'restaurante', 'fecha', 'texto']
};
// Lo que puede tocar el encargado (rol "staff")
var STAFF_PUEDE = { ventas: 1, cortes: 1, compras: 1, productos: 1, proveedores: 1, cierres: 1, pagos: 1 };
var DIAS_SESION = 30;
// Funciones que el administrador puede activar o desactivar por restaurante
var FUNCIONES = ['credito', 'simulador', 'promos', 'comunidad', 'equipo'];
// Estas empiezan apagadas: el administrador las activa cuando quiera
var FUNCIONES_APAGADAS = { credito: 1 };
var MSG_SUSP = 'La cuenta de este restaurante está suspendida. Escribe al equipo de .Py México para reactivarla.';

/* ===================== Entrada ===================== */
function doGet() {
  return ContentService.createTextOutput('El servidor de .Py México está funcionando. Copia este enlace en config.js de la app.');
}
function doPost(e) {
  var res;
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fn = ACCIONES[p.action];
    if (!fn) throw err_('Acción desconocida: ' + p.action);
    res = fn(p) || {};
    res.ok = true;
  } catch (x) {
    res = { ok: false, error: x && x.publico ? x.message : 'Error en el servidor: ' + (x && x.message ? x.message : x), code: x && x.code };
    if (!(x && x.publico)) console.error(x && x.stack ? x.stack : x);
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}
function err_(msg, code) { var e = new Error(msg); e.publico = true; e.code = code; return e; }

/* ===================== Acciones ===================== */
var ACCIONES = {
  registro: function (p) {
    var email = limpiaEmail_(p.email); validaPass_(p.pass);
    if (!p.nombre || !p.restaurante) throw err_('Escribe tu nombre y el nombre del restaurante.');
    if (!p.aviso) throw err_('Para crear tu cuenta necesitas aceptar el aviso de privacidad.');
    return conCandado_(function () {
      if (buscaUsuario_(email)) throw err_('Ya existe una cuenta con ese correo. Entra con tu contraseña o recupérala.');
      var rid = Utilities.getUuid(), ahora = new Date().toISOString();
      var config = { saldoInicial: Number(p.saldo) || 0, diasCompromisos: 7, umbralVerde: 20000, impuestoPct: 4, cuotasPct: 12, fondoCaja: 1500 };
      // Todos empiezan en Autogestión; Acompañamiento lo activa el administrador cuando se confirma el pago.
      agrega_('restaurantes', [{ id: rid, nombre: String(p.restaurante).slice(0, 80), ciudad: String(p.ciudad || '').slice(0, 60), giro: '', plan: 'autogestion', creado: ahora, datos: { config: config, reservaMeta: 0 }, asesor: {}, funciones: {}, suspendido: false, solicitud: p.plan === 'acompanamiento' ? 'acompanamiento' : '' }]);
      var u = creaUsuario_(email, String(p.nombre).slice(0, 60), String(p.pass), 'dueno', rid, ahora);
      return sesionPara_(u);
    });
  },
  entrar: function (p) {
    var email = limpiaEmail_(p.email);
    var u = buscaUsuario_(email);
    if (!u || !u.activo || hash_(String(p.pass || ''), u.salt) !== u.hash) throw err_('El correo o la contraseña no coinciden. Revisa e intenta de nuevo.');
    if (u.rol === 'dueno' || u.rol === 'staff') restauranteActivo_(u);
    return conCandado_(function () { return sesionPara_(u); });
  },
  salir: function (p) {
    var u = auth_(p);
    conCandado_(function () { borraFilas_('sesiones', function (r) { return r.token === p.token; }); });
    CacheService.getScriptCache().remove('ses_' + p.token);
    return {};
  },
  recuperar: function (p) {
    var email = limpiaEmail_(p.email); var u = buscaUsuario_(email);
    if (u && u.activo) {
      var code = String(Math.floor(100000 + Math.random() * 900000));
      CacheService.getScriptCache().put('rec_' + email, code, 900);
      MailApp.sendEmail(email, 'Tu código para entrar a .Py México', 'Hola, ' + u.nombre + '.\n\nTu código para cambiar tu contraseña es: ' + code + '\n\nVence en 15 minutos. Si tú no lo pediste, ignora este correo.\n\n.Py México');
    }
    return {};
  },
  restablecer: function (p) {
    var email = limpiaEmail_(p.email); validaPass_(p.pass);
    var cache = CacheService.getScriptCache(); var code = cache.get('rec_' + email);
    if (!code || code !== String(p.code || '').trim()) throw err_('El código no es correcto o ya venció. Pide uno nuevo.');
    conCandado_(function () {
      var salt = Utilities.getUuid();
      actualiza_('usuarios', function (r) { return r.email === email; }, function (r) { r.salt = salt; r.hash = hash_(String(p.pass), salt); return r; });
    });
    cache.remove('rec_' + email);
    return {};
  },
  cargar: function (p) {
    var u = auth_(p); var rid = restauranteDe_(u, p.restauranteId);
    var R = buscaPor_('restaurantes', 'id', rid); if (!R) throw err_('No encontramos ese restaurante.');
    if (R.suspendido && u.rol !== 'asesor') throw err_(MSG_SUSP, 'suspendida');
    var cols = {};
    for (var c in COLECCIONES) {
      if (u.rol === 'staff' && !STAFF_PUEDE[c]) { cols[c] = []; continue; }
      var arr = leeColeccion_(c, rid);
      if (u.rol === 'staff' && c === 'pagos') arr = arr.filter(function (x) { return x.categoria === 'Proveedores'; });
      cols[c] = arr;
    }
    var datos = R.datos || {};
    if (u.rol === 'staff') datos = { config: { fondoCaja: (datos.config || {}).fondoCaja || 1500 } };
    return { restaurante: { id: R.id, nombre: R.nombre, ciudad: R.ciudad, giro: R.giro, plan: R.plan, datos: datos, asesor: asesorPublico_(R), funciones: funcionesDe_(R), solicitud: R.solicitud || '' }, cols: cols };
  },
  sync: function (p) {
    var u = auth_(p); if (u.rol === 'asesor' || u.rol === 'admin') throw err_('Tu cuenta no puede cambiar los datos de un restaurante.');
    restauranteActivo_(u);
    var rid = u.restauranteId; var n = 0;
    conCandado_(function () {
      var cols = {}; var k;
      for (k in (p.upserts || {})) cols[k] = 1;
      for (k in (p.deletes || {})) cols[k] = 1;
      for (var c in cols) {
        if (!COLECCIONES[c]) continue;
        if (u.rol === 'staff' && !STAFF_PUEDE[c]) throw err_('Tu usuario no tiene permiso para cambiar ' + c + '.');
        var ups = (p.upserts && p.upserts[c]) || [], dels = (p.deletes && p.deletes[c]) || [];
        if (u.rol === 'staff' && c === 'pagos') { ups = ups.filter(function (x) { return x.categoria === 'Proveedores'; }); dels = dels.filter(function (id) { return String(id).indexOf('k_comp_') === 0; }); }
        n += aplica_(c, rid, ups, dels);
      }
      if (p.restaurante && u.rol === 'dueno') guardaRestaurante_(rid, p.restaurante);
    });
    return { guardados: n };
  },
  reemplazar: function (p) {
    var u = auth_(p); if (u.rol !== 'dueno') throw err_('Solo el dueño puede reemplazar todos los datos.');
    restauranteActivo_(u);
    var rid = u.restauranteId;
    conCandado_(function () {
      for (var c in COLECCIONES) {
        if (c === 'mensajes') continue; // la conversación con el asesor se conserva
        var sh = hoja_(c, encabezado_(c)); var n = encabezado_(c).length; var last = sh.getLastRow();
        var data = last > 1 ? sh.getRange(2, 1, last - 1, n).getValues() : [];
        var keep = data.filter(function (r) { return String(r[1]) !== rid; });
        var nuevos = ((p.cols || {})[c] || []).map(function (rec) { return aFila_(c, rid, rec); });
        reescribe_(sh, n, keep.concat(nuevos), data.length, formatos_(c));
      }
      if (p.restaurante) guardaRestaurante_(rid, p.restaurante);
    });
    return {};
  },
  mensajes: function (p) {
    var u = auth_(p); if (u.rol === 'staff') throw err_('Esta sección es solo para el dueño.');
    if (u.rol === 'dueno') restauranteActivo_(u);
    var rid = restauranteDe_(u, p.restauranteId);
    var R = buscaPor_('restaurantes', 'id', rid);
    return { mensajes: leeColeccion_('mensajes', rid), asesor: asesorPublico_(R) };
  },
  asesorMsg: function (p) {
    var u = auth_(p); if (u.rol !== 'asesor') throw err_('Solo los asesores pueden usar esta opción.');
    var rid = restauranteDe_(u, p.restauranteId);
    var texto = String(p.texto || '').trim().slice(0, 2000); if (!texto) throw err_('Escribe un mensaje.');
    var m = { id: Utilities.getUuid(), fecha: new Date().toISOString(), de: 'asesor', autor: u.nombre, texto: texto };
    conCandado_(function () {
      aplica_('mensajes', rid, [m], []);
    });
    return { mensaje: m };
  },
  asesorSesion: function (p) {
    var u = auth_(p); if (u.rol !== 'asesor') throw err_('Solo los asesores pueden usar esta opción.');
    var rid = restauranteDe_(u, p.restauranteId); var out = {};
    conCandado_(function () {
      actualiza_('restaurantes', function (r) { return r.id === rid; }, function (r) { r.asesor = r.asesor || {}; r.asesor.proxima = String(p.proxima || ''); out = asesorPublico_(r); return r; });
    });
    return { asesor: out };
  },
  clientes: function (p) {
    var u = auth_(p); if (u.rol !== 'asesor') throw err_('Solo los asesores pueden ver la lista de clientes.');
    var rs = leeTabla_('restaurantes');
    var msgs = leeTodaColeccion_('mensajes'); var ult = {};
    msgs.forEach(function (m) { var r = m.__rid; if (!ult[r] || String(m.fecha) > String(ult[r].fecha)) ult[r] = m; });
    return { clientes: rs.filter(function (r) { return asignado_(r, u); }).map(function (r) {
      var m = ult[r.id];
      return { id: r.id, nombre: r.nombre, ciudad: r.ciudad, plan: r.plan, proxima: (r.asesor || {}).proxima || '', ultimo: m ? { fecha: m.fecha, texto: m.texto, de: m.de } : null };
    }) };
  },
  equipo: function (p) {
    var u = auth_(p); if (u.rol !== 'dueno') throw err_('Solo el dueño puede ver al equipo.');
    restauranteActivo_(u);
    return { equipo: leeTabla_('usuarios').filter(function (x) { return x.restauranteId === u.restauranteId && x.activo; }).map(function (x) { return { id: x.id, nombre: x.nombre, email: x.email, rol: x.rol }; }) };
  },
  invitar: function (p) {
    var u = auth_(p); if (u.rol !== 'dueno') throw err_('Solo el dueño puede dar acceso a su equipo.');
    var R = restauranteActivo_(u); if (!funcionesDe_(R).equipo) throw err_('Esta función no está activa para tu restaurante.');
    var email = limpiaEmail_(p.email); validaPass_(p.pass);
    return conCandado_(function () {
      if (buscaUsuario_(email)) throw err_('Ese correo ya tiene una cuenta en .Py México.');
      var n = creaUsuario_(email, String(p.nombre || '').slice(0, 60), String(p.pass), 'staff', u.restauranteId);
      return { usuario: { id: n.id, nombre: n.nombre, email: n.email, rol: n.rol } };
    });
  },
  quitar: function (p) {
    var u = auth_(p); if (u.rol !== 'dueno') throw err_('Solo el dueño puede quitar accesos.');
    conCandado_(function () {
      var n = actualiza_('usuarios', function (r) { return r.id === p.userId && r.restauranteId === u.restauranteId && r.rol === 'staff'; }, function (r) { r.activo = false; return r; });
      if (n) cierraSesiones_([p.userId]);
    });
    return {};
  },
  feed: function (p) {
    var u = auth_(p); comunidadOk_(u); var adm = u.rol === 'admin';
    var posts = leeTabla_('publicaciones').filter(function (x) { return adm || !x.oculta; });
    posts.sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
    posts = posts.slice(0, 150);
    var ids = {}; posts.forEach(function (x) { ids[x.id] = []; });
    leeTabla_('comentarios').forEach(function (c) { if (ids[c.publicacionId]) ids[c.publicacionId].push({ id: c.id, autor: c.autor, restaurante: c.restaurante, fecha: c.fecha, texto: c.texto }); });
    return { posts: posts.map(function (x) {
      var votos = x.votos || [];
      return { id: x.id, autor: x.autor, restaurante: x.restaurante, ciudad: x.ciudad, categoria: x.categoria, fecha: x.fecha, titulo: x.titulo, cuerpo: x.cuerpo, utiles: votos.length, miUtil: votos.indexOf(u.id) >= 0, mio: x.autorId === u.id, oculta: adm ? !!x.oculta : undefined, denuncias: adm ? (x.denuncias || []).length : undefined,
        comentarios: ids[x.id].sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); }) };
    }) };
  },
  publicar: function (p) {
    var u = auth_(p); comunidadOk_(u);
    var titulo = String(p.titulo || '').trim().slice(0, 140), cuerpo = String(p.cuerpo || '').trim().slice(0, 4000);
    if (!titulo || !cuerpo) throw err_('Escribe un título y tu pregunta o experiencia.');
    var R = (u.rol === 'asesor' || u.rol === 'admin') ? null : buscaPor_('restaurantes', 'id', u.restauranteId);
    conCandado_(function () {
      agrega_('publicaciones', [{ id: Utilities.getUuid(), autorId: u.id, autor: u.nombre, restaurante: R ? R.nombre : 'Equipo .Py México', ciudad: R ? R.ciudad : '', categoria: String(p.categoria || 'General'), fecha: new Date().toISOString(), titulo: titulo, cuerpo: cuerpo, votos: [], denuncias: [], oculta: false }]);
    });
    return {};
  },
  comentar: function (p) {
    var u = auth_(p); comunidadOk_(u); var texto = String(p.texto || '').trim().slice(0, 2000); if (!texto) throw err_('Escribe tu comentario.');
    if (!buscaPor_('publicaciones', 'id', p.postId)) throw err_('Esa publicación ya no existe.');
    var R = (u.rol === 'asesor' || u.rol === 'admin') ? null : buscaPor_('restaurantes', 'id', u.restauranteId);
    conCandado_(function () {
      agrega_('comentarios', [{ id: Utilities.getUuid(), publicacionId: p.postId, autorId: u.id, autor: u.nombre, restaurante: R ? R.nombre : 'Equipo .Py México', fecha: new Date().toISOString(), texto: texto }]);
    });
    return {};
  },
  votar: function (p) {
    var u = auth_(p); comunidadOk_(u);
    conCandado_(function () {
      actualiza_('publicaciones', function (r) { return r.id === p.postId; }, function (r) { var v = r.votos || []; var i = v.indexOf(u.id); if (i >= 0) v.splice(i, 1); else v.push(u.id); r.votos = v; return r; });
    });
    return {};
  },
  reportar: function (p) {
    var u = auth_(p); comunidadOk_(u);
    conCandado_(function () {
      actualiza_('publicaciones', function (r) { return r.id === p.postId; }, function (r) { var d = r.denuncias || []; if (d.indexOf(u.id) < 0) d.push(u.id); r.denuncias = d; if (d.length >= 3) r.oculta = true; return r; });
    });
    return {};
  },

  /* ----- Dueño: pedir plan y borrar su cuenta ----- */
  solicitarPlan: function (p) {
    var u = auth_(p); if (u.rol !== 'dueno') throw err_('Solo el dueño puede pedir un cambio de plan.');
    restauranteActivo_(u);
    var s = p.cancelar ? '' : 'acompanamiento';
    conCandado_(function () { actualiza_('restaurantes', function (r) { return r.id === u.restauranteId; }, function (r) { r.solicitud = r.plan === 'acompanamiento' ? '' : s; return r; }); });
    return { solicitud: s };
  },
  borrarCuenta: function (p) {
    var u = auth_(p); if (u.rol !== 'dueno') throw err_('Solo el dueño puede borrar la cuenta del restaurante.');
    var full = buscaPor_('usuarios', 'id', u.id);
    if (!full || hash_(String(p.pass || ''), full.salt) !== full.hash) throw err_('La contraseña no es correcta.');
    conCandado_(function () { borraRestaurante_(u.restauranteId); });
    return {};
  },

  /* ----- Administrador: sin acceso a finanzas ----- */
  adminResumen: function (p) {
    var u = soloAdmin_(p);
    var us = leeTabla_('usuarios');
    var duenos = {}, cuantos = {}, asesores = [];
    us.forEach(function (x) {
      if (x.rol === 'dueno') duenos[x.restauranteId] = x;
      if ((x.rol === 'dueno' || x.rol === 'staff') && x.activo) cuantos[x.restauranteId] = (cuantos[x.restauranteId] || 0) + 1;
      if (x.rol === 'asesor') asesores.push({ id: x.id, nombre: x.nombre, email: x.email, activo: x.activo, creado: x.creado });
    });
    var rs = leeTabla_('restaurantes').filter(function (r) { return duenos[r.id]; }).map(function (r) {
      var d = duenos[r.id]; var a = r.asesor || {};
      return { id: r.id, nombre: r.nombre, ciudad: r.ciudad, giro: r.giro, plan: r.plan, creado: r.creado, solicitud: r.solicitud || '', suspendido: !!r.suspendido, funciones: funcionesDe_(r), asesorId: a.asesorId || '', usuarios: cuantos[r.id] || 0, dueno: { nombre: d.nombre, email: d.email } };
    });
    return { restaurantes: rs, asesores: asesores, funciones: FUNCIONES };
  },
  adminRestaurante: function (p) {
    var u = soloAdmin_(p); var rid = String(p.restauranteId || ''); var out = null;
    var asesor = null;
    if (p.asesorId) { asesor = buscaPor_('usuarios', 'id', p.asesorId); if (!asesor || asesor.rol !== 'asesor' || !asesor.activo) throw err_('Ese asesor no existe o está desactivado.'); }
    conCandado_(function () {
      var n = actualiza_('restaurantes', function (r) { return r.id === rid; }, function (r) {
        if (p.plan) {
          r.plan = p.plan === 'acompanamiento' ? 'acompanamiento' : 'autogestion';
          if (r.plan === 'acompanamiento') r.solicitud = '';
        }
        if (p.rechazarSolicitud) r.solicitud = '';
        r.asesor = r.asesor || {};
        if (r.plan !== 'acompanamiento') { r.asesor.asesorId = ''; r.asesor.nombre = ''; }
        else if (p.asesorId !== undefined) { r.asesor.asesorId = asesor ? asesor.id : ''; r.asesor.nombre = asesor ? asesor.nombre : ''; }
        if (p.funciones) { var f = {}; FUNCIONES.forEach(function (k) { f[k] = FUNCIONES_APAGADAS[k] ? p.funciones[k] === true : p.funciones[k] !== false; }); r.funciones = f; }
        if (p.suspendido !== undefined) r.suspendido = !!p.suspendido;
        out = r; return r;
      });
      if (!n) throw err_('No encontramos ese restaurante.');
      // No se cierran las sesiones: cada acción revisa si la cuenta está suspendida y explica el motivo.
    });
    return {};
  },
  adminBorrar: function (p) {
    soloAdmin_(p); var rid = String(p.restauranteId || '');
    var R = buscaPor_('restaurantes', 'id', rid); if (!R) throw err_('No encontramos ese restaurante.');
    if (String(p.confirmar || '').trim().toLowerCase() !== String(R.nombre || '').trim().toLowerCase()) throw err_('El nombre no coincide. Escríbelo igual que aparece.');
    conCandado_(function () { borraRestaurante_(rid); });
    return {};
  },
  adminCrearAsesor: function (p) {
    soloAdmin_(p);
    var email = limpiaEmail_(p.email); validaPass_(p.pass);
    if (!String(p.nombre || '').trim()) throw err_('Escribe el nombre del asesor.');
    return conCandado_(function () {
      if (buscaUsuario_(email)) throw err_('Ese correo ya tiene una cuenta en .Py México.');
      var n = creaUsuario_(email, String(p.nombre).trim().slice(0, 60), String(p.pass), 'asesor', '');
      return { asesor: { id: n.id, nombre: n.nombre, email: n.email, activo: true } };
    });
  },
  adminAsesorActivo: function (p) {
    soloAdmin_(p); var activo = !!p.activo;
    conCandado_(function () {
      var n = actualiza_('usuarios', function (r) { return r.id === p.userId && r.rol === 'asesor'; }, function (r) { r.activo = activo; return r; });
      if (!n) throw err_('No encontramos a ese asesor.');
      if (!activo) {
        cierraSesiones_([p.userId]);
        actualiza_('restaurantes', function (r) { return (r.asesor || {}).asesorId === p.userId; }, function (r) { r.asesor.asesorId = ''; r.asesor.nombre = ''; return r; });
      }
    });
    return {};
  },
  adminPost: function (p) {
    soloAdmin_(p);
    conCandado_(function () {
      if (p.accion === 'borrar') {
        borraFilas_('comentarios', function (c) { return c.publicacionId === p.postId; });
        borraFilas_('publicaciones', function (r) { return r.id === p.postId; });
      } else {
        actualiza_('publicaciones', function (r) { return r.id === p.postId; }, function (r) { r.oculta = p.accion === 'ocultar'; if (!r.oculta) r.denuncias = []; return r; });
      }
    });
    return {};
  }
};

/* ===================== Usuarios y sesiones ===================== */
function limpiaEmail_(e) { e = String(e || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw err_('Escribe un correo válido.'); return e; }
function validaPass_(p) { if (!p || String(p).length < 6) throw err_('La contraseña debe tener al menos 6 caracteres.'); }
function hash_(pass, salt) {
  var h = salt + '|' + pass;
  for (var i = 0; i < 300; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}
function creaUsuario_(email, nombre, pass, rol, rid, aviso) {
  var salt = Utilities.getUuid();
  var u = { id: Utilities.getUuid(), email: email, nombre: nombre, rol: rol, restauranteId: rid, hash: hash_(pass, salt), salt: salt, creado: new Date().toISOString(), activo: true, aviso: aviso || '' };
  agrega_('usuarios', [u]); return u;
}
function buscaUsuario_(email) { return buscaPor_('usuarios', 'email', email); }
function publico_(u) { return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, restauranteId: u.restauranteId }; }
function sesionPara_(u) {
  var token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8); var ahora = new Date();
  var exp = new Date(ahora.getTime() + DIAS_SESION * 864e5).toISOString();
  agrega_('sesiones', [{ token: token, usuarioId: u.id, creado: ahora.toISOString(), expira: exp }]); // quien llama ya tiene el candado
  CacheService.getScriptCache().put('ses_' + token, JSON.stringify(publico_(u)), 21600);
  return { token: token, user: publico_(u) };
}
function auth_(p) {
  var t = String(p.token || ''); if (!t) throw err_('Tu sesión terminó. Vuelve a entrar.', 'sesion');
  var cache = CacheService.getScriptCache(); var c = cache.get('ses_' + t);
  if (c) return JSON.parse(c);
  var s = buscaPor_('sesiones', 'token', t);
  if (!s || String(s.expira) < new Date().toISOString()) throw err_('Tu sesión terminó. Vuelve a entrar.', 'sesion');
  var u = buscaPor_('usuarios', 'id', s.usuarioId);
  if (!u || !u.activo) throw err_('Tu sesión terminó. Vuelve a entrar.', 'sesion');
  var pu = publico_(u); cache.put('ses_' + t, JSON.stringify(pu), 21600); return pu;
}
function restauranteDe_(u, pedido) {
  if (u.rol === 'admin') throw err_('La cuenta de administrador no tiene acceso a las finanzas de los restaurantes.');
  if (u.rol === 'asesor') {
    var R = pedido ? buscaPor_('restaurantes', 'id', String(pedido)) : null;
    if (!R || !asignado_(R, u)) throw err_('Ese restaurante no está asignado a ti.');
    return R.id;
  }
  return u.restauranteId;
}
function asignado_(R, u) { return R.plan === 'acompanamiento' && (R.asesor || {}).asesorId === u.id; }
function asesorPublico_(R) { var a = (R && R.asesor) || {}; return R && R.plan === 'acompanamiento' && a.asesorId ? { nombre: a.nombre || '', proxima: a.proxima || '' } : { nombre: '', proxima: a.proxima || '' }; }
/* Borra un restaurante con todo: registros, usuarios, sesiones, publicaciones. Quien llama ya tiene el candado. */
function borraRestaurante_(rid) {
  for (var c in COLECCIONES) {
    var enc = encabezado_(c); var sh = hoja_(c, enc); var n = enc.length; var last = sh.getLastRow();
    var data = last > 1 ? sh.getRange(2, 1, last - 1, n).getValues() : [];
    var keep = data.filter(function (r) { return r[0] !== '' && String(r[1]) !== rid; });
    if (keep.length !== data.filter(function (r) { return r[0] !== ''; }).length) reescribe_(sh, n, keep, data.length, formatos_(c));
  }
  var ids = leeTabla_('usuarios').filter(function (x) { return x.restauranteId === rid; }).map(function (x) { return x.id; });
  cierraSesiones_(ids);
  var esDe = {}; ids.forEach(function (i) { esDe[i] = 1; });
  var postsDe = {}; leeTabla_('publicaciones').forEach(function (x) { if (esDe[x.autorId]) postsDe[x.id] = 1; });
  borraFilas_('comentarios', function (x) { return esDe[x.autorId] || postsDe[x.publicacionId]; });
  borraFilas_('publicaciones', function (x) { return esDe[x.autorId]; });
  borraFilas_('usuarios', function (x) { return esDe[x.id]; });
  borraFilas_('restaurantes', function (x) { return x.id === rid; });
}
function funcionesDe_(R) { var f = (R && R.funciones) || {}; var o = {}; FUNCIONES.forEach(function (k) { o[k] = FUNCIONES_APAGADAS[k] ? f[k] === true : f[k] !== false; }); return o; }
function restauranteActivo_(u) {
  var R = buscaPor_('restaurantes', 'id', u.restauranteId);
  if (!R) throw err_('No encontramos tu restaurante.', 'sesion');
  if (R.suspendido) throw err_(MSG_SUSP, 'suspendida');
  return R;
}
function comunidadOk_(u) {
  if (u.rol !== 'dueno' && u.rol !== 'staff') return;
  if (!funcionesDe_(restauranteActivo_(u)).comunidad) throw err_('La comunidad no está activa para tu restaurante.');
}
function soloAdmin_(p) { var u = auth_(p); if (u.rol !== 'admin') throw err_('Solo el administrador puede hacer esto.'); return u; }
function cierraSesiones_(ids) {
  if (!ids || !ids.length) return; var es = {}; ids.forEach(function (i) { es[i] = 1; });
  var cache = CacheService.getScriptCache();
  leeTabla_('sesiones').forEach(function (s) { if (es[s.usuarioId]) cache.remove('ses_' + s.token); });
  borraFilas_('sesiones', function (s) { return es[s.usuarioId]; });
}
function guardaRestaurante_(rid, r) {
  actualiza_('restaurantes', function (x) { return x.id === rid; }, function (x) {
    if (r.nombre) x.nombre = String(r.nombre).slice(0, 80);
    if (r.ciudad != null) x.ciudad = String(r.ciudad).slice(0, 60);
    if (r.giro != null) x.giro = String(r.giro).slice(0, 60);
    if (r.datos) x.datos = r.datos;
    return x;
  });
}

/* ===================== Hojas ===================== */
function libro_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function conCandado_(fn) { var l = LockService.getScriptLock(); l.waitLock(25000); try { return fn(); } finally { l.releaseLock(); } }
function encabezado_(c) { return ['id', 'restauranteId'].concat(COLECCIONES[c].map(function (f) { return f.split(':')[0]; })).concat(['extra', 'actualizado']); }
function tipos_(campos) { var t = {}; campos.forEach(function (f) { var a = f.split(':'); t[a[0]] = a[1] || 's'; }); return t; }
function formatos_(c) { var t = tipos_(COLECCIONES[c]); return encabezado_(c).map(function (k) { return t[k] === 'n' ? '#,##0.##' : '@'; }); }
var _hojas = {};
function hoja_(nombre, encabezado) {
  if (_hojas[nombre]) return _hojas[nombre];
  var ss = libro_(); var sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, encabezado.length).setValues([encabezado]).setFontWeight('bold').setBackground('#143D34').setFontColor('#F4F1E8');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, sh.getMaxRows() - 1, encabezado.length).setNumberFormat('@');
  } else if (sh.getRange(1, 1, 1, encabezado.length).getValues()[0].join('|') !== encabezado.join('|')) {
    // Se agregaron columnas nuevas: se actualiza el encabezado (los datos no se mueven)
    sh.getRange(1, 1, 1, encabezado.length).setValues([encabezado]).setFontWeight('bold').setBackground('#143D34').setFontColor('#F4F1E8');
  }
  _hojas[nombre] = sh; return sh;
}
function asegFilas_(sh, hasta) { var m = sh.getMaxRows(); if (hasta > m) sh.insertRowsAfter(m, hasta - m + 200); }
function escribe_(sh, fila, n, rows, fmts) {
  if (!rows.length) return; asegFilas_(sh, fila + rows.length - 1);
  var rg = sh.getRange(fila, 1, rows.length, n);
  if (fmts) rg.setNumberFormats(rows.map(function () { return fmts; }));
  rg.setValues(rows);
}
function reescribe_(sh, n, rows, antes, fmts) {
  escribe_(sh, 2, n, rows, fmts);
  if (antes > rows.length) sh.getRange(2 + rows.length, 1, antes - rows.length, n).clearContent();
}
/* Tablas del sistema (usuarios, restaurantes, comunidad) */
function decodifica_(campos, encab, fila) {
  var t = tipos_(campos), o = {};
  encab.forEach(function (k, i) { o[k] = convierte_(t[k], fila[i]); });
  return o;
}
function convierte_(t, v) {
  if (t === 'n') return Number(v) || 0;
  if (t === 'b') return v === true || String(v).toLowerCase() === 'true';
  if (t === 'j') { if (v === '' || v == null) return null; try { return JSON.parse(v); } catch (e) { return null; } }
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}
function codifica_(t, v) {
  if (v === undefined || v === null) return '';
  if (t === 'n') return Number(v) || 0;
  if (t === 'b') return v ? 'true' : 'false';
  if (t === 'j') return JSON.stringify(v);
  return String(v);
}
function leeTabla_(nombre) {
  var campos = SISTEMA[nombre]; var encab = campos.map(function (f) { return f.split(':')[0]; });
  var sh = hoja_(nombre, encab); var last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, encab.length).getValues().filter(function (r) { return r[0] !== ''; }).map(function (r) { return decodifica_(campos, encab, r); });
}
function buscaPor_(nombre, campo, valor) { var a = leeTabla_(nombre); for (var i = 0; i < a.length; i++) if (String(a[i][campo]) === String(valor)) return a[i]; return null; }
function agrega_(nombre, objs) {
  var campos = SISTEMA[nombre]; var encab = campos.map(function (f) { return f.split(':')[0]; }); var t = tipos_(campos);
  var sh = hoja_(nombre, encab);
  var fmts = encab.map(function (k) { return t[k] === 'n' ? '#,##0.##' : '@'; });
  escribe_(sh, sh.getLastRow() + 1, encab.length, objs.map(function (o) { return encab.map(function (k) { return codifica_(t[k], o[k]); }); }), fmts);
}
function actualiza_(nombre, cond, fn) {
  var campos = SISTEMA[nombre]; var encab = campos.map(function (f) { return f.split(':')[0]; }); var t = tipos_(campos);
  var sh = hoja_(nombre, encab); var last = sh.getLastRow(); if (last < 2) return 0;
  var data = sh.getRange(2, 1, last - 1, encab.length).getValues(); var n = 0;
  var fmts = encab.map(function (k) { return t[k] === 'n' ? '#,##0.##' : '@'; });
  data.forEach(function (r, i) {
    if (r[0] === '') return;
    var o = decodifica_(campos, encab, r); if (!cond(o)) return;
    var nuevo = fn(o); escribe_(sh, i + 2, encab.length, [encab.map(function (k) { return codifica_(t[k], nuevo[k]); })], fmts); n++;
  });
  return n;
}
function borraFilas_(nombre, cond) {
  var campos = SISTEMA[nombre]; var encab = campos.map(function (f) { return f.split(':')[0]; });
  var sh = hoja_(nombre, encab); var last = sh.getLastRow(); if (last < 2) return;
  var data = sh.getRange(2, 1, last - 1, encab.length).getValues();
  for (var i = data.length - 1; i >= 0; i--) if (data[i][0] !== '' && cond(decodifica_(campos, encab, data[i]))) sh.deleteRow(i + 2);
}
/* Colecciones de cada restaurante */
function aFila_(c, rid, rec) {
  var t = tipos_(COLECCIONES[c]); var extra = {};
  for (var k in rec) if (k !== 'id' && k !== 'virtual' && !(k in t)) extra[k] = rec[k];
  return [String(rec.id), rid].concat(COLECCIONES[c].map(function (f) { var k = f.split(':')[0]; return codifica_(t[k], rec[k]); }))
    .concat([Object.keys(extra).length ? JSON.stringify(extra) : '', new Date().toISOString()]);
}
function deFila_(c, fila) {
  var t = tipos_(COLECCIONES[c]); var o = { id: String(fila[0]) }; var i = 2;
  COLECCIONES[c].forEach(function (f) { var k = f.split(':')[0]; var v = convierte_(t[k], fila[i++]); if (!(t[k] === 's' && v === '')) o[k] = v; });
  var ex = fila[i]; if (ex) { try { var e = JSON.parse(ex); for (var k in e) o[k] = e[k]; } catch (x) { } }
  return o;
}
function leeColeccion_(c, rid) {
  var enc = encabezado_(c); var sh = hoja_(c, enc); var last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, enc.length).getValues().filter(function (r) { return r[0] !== '' && String(r[1]) === rid; }).map(function (r) { return deFila_(c, r); });
}
function leeTodaColeccion_(c) {
  var enc = encabezado_(c); var sh = hoja_(c, enc); var last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, enc.length).getValues().filter(function (r) { return r[0] !== ''; }).map(function (r) { var o = deFila_(c, r); o.__rid = String(r[1]); return o; });
}
function aplica_(c, rid, ups, dels) {
  var enc = encabezado_(c); var n = enc.length; var sh = hoja_(c, enc); var fmts = formatos_(c);
  var last = sh.getLastRow(); var data = last > 1 ? sh.getRange(2, 1, last - 1, n).getValues() : [];
  var idx = {}; data.forEach(function (r, i) { if (r[0] !== '') idx[String(r[0])] = i; });
  var nuevos = [], posNuevo = {}, cambiadas = {}, borrar = [];
  ups.forEach(function (rec) {
    if (!rec || !rec.id) return; var id = String(rec.id); var fila = aFila_(c, rid, rec);
    if (id in idx) { if (String(data[idx[id]][1]) !== rid) throw err_('No tienes permiso para cambiar ese registro.'); data[idx[id]] = fila; cambiadas[idx[id]] = 1; }
    else if (id in posNuevo) nuevos[posNuevo[id]] = fila;
    else { posNuevo[id] = nuevos.length; nuevos.push(fila); }
  });
  dels.forEach(function (id) { id = String(id); if (id in idx) { if (String(data[idx[id]][1]) !== rid) throw err_('No tienes permiso para borrar ese registro.'); borrar.push(idx[id]); delete cambiadas[idx[id]]; } });
  var nCamb = Object.keys(cambiadas).length;
  if (borrar.length > 10 || nCamb > 25) {
    var quita = {}; borrar.forEach(function (i) { quita[i] = 1; });
    reescribe_(sh, n, data.filter(function (r, i) { return !quita[i] && r[0] !== ''; }).concat(nuevos), data.length, fmts);
  } else {
    Object.keys(cambiadas).forEach(function (i) { escribe_(sh, Number(i) + 2, n, [data[i]], fmts); });
    borrar.sort(function (a, b) { return b - a; }).forEach(function (i) { sh.deleteRow(i + 2); });
    escribe_(sh, sh.getLastRow() + 1, n, nuevos, fmts);
  }
  return ups.length + dels.length;
}

/* ===================== Utilidades para el equipo =====================
   Ejecútalas desde el editor (menú de funciones arriba) cuando lo necesites. */

// Crea todas las hojas de una vez para que puedas verlas antes de usar la app.
function prepararHojas() {
  for (var c in COLECCIONES) hoja_(c, encabezado_(c));
  for (var s in SISTEMA) hoja_(s, SISTEMA[s].map(function (f) { return f.split(':')[0]; }));
  var h = libro_().getSheetByName('Hoja 1') || libro_().getSheetByName('Sheet1');
  if (h && libro_().getSheets().length > 1 && h.getLastRow() === 0) libro_().deleteSheet(h);
}
// Crea la cuenta de ADMINISTRADOR. Llena los tres datos, guarda, elige "crearAdmin" y toca Ejecutar.
// Después borra la contraseña de aquí y guarda otra vez.
function crearAdmin() {
  var NOMBRE = 'Administrador';
  var CORREO = 'escribe.aqui@correo.com';
  var CONTRASENA = '';
  var email = limpiaEmail_(CORREO); validaPass_(CONTRASENA);
  conCandado_(function () {
    if (buscaUsuario_(email)) { Logger.log('Ya existe una cuenta con ' + email + '. Usa otro correo para el administrador.'); return; }
    creaUsuario_(email, NOMBRE, CONTRASENA, 'admin', '');
    Logger.log('Listo: ' + email + ' ya es administrador. Entra a la app con ese correo. Ahora borra la contraseña de este código y guarda.');
  });
}
