/* .Py México · app. Archivo generado: lógica + vistas. */
"use strict";
/* ============ Utilidades ============ */
const pad = n => String(n).padStart(2, '0');
const ds = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ds(new Date());
const addD = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ds(d); };
const diffD = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
const fd = s => { const d = pd(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
const fds = s => { const d = pd(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); };
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fdl = s => { const d = pd(s); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; };
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
const monthKey = s => s.slice(0, 7);
const monthName = k => { const [y, m] = k.split('-').map(Number); return MESES[m - 1] + ' ' + y; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const MX = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const money = n => MX.format(Math.round(n || 0));
const num = (n, d = 1) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: d }).format(n || 0);
const sum = (arr, f) => arr.reduce((a, x) => a + (typeof f === 'function' ? f(x) : x[f]), 0);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = s => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
function ago(s) { const d = diffD(s, today()); if (d <= 0) return 'hoy'; if (d === 1) return 'ayer'; if (d < 7) return 'hace ' + d + ' días'; if (d < 14) return 'hace una semana'; return fd(s); }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const CATS_PAGO = ['Proveedores', 'Nómina', 'Renta', 'Servicios', 'Impuestos', 'Créditos', 'Mantenimiento', 'Retiro del dueño', 'Otros'];
const CATS_COM = ['Administración', 'Finanzas', 'Proveedores', 'Marketing', 'General'];
const METODOS = ['Efectivo', 'Tarjeta', 'Transferencia'];
const keyId = k => 'k_' + String(k).replace(/[^A-Za-z0-9_-]/g, '_');

/* ============ Cálculos financieros ============ */
function saldoActual() {
  const T = today();
  return S.config.saldoInicial
    + sum(S.sales.filter(s => s.fecha <= T), 'monto')
    + sum(S.cash.filter(c => c.fecha <= T), c => c.tipo === 'entrada' ? c.monto : -c.monto)
    - sum(S.payables.filter(p => p.estado === 'pagado' && p.pagadoEl <= T), 'monto');
}
function reserveBalance() { return sum(S.reserve.movs, m => m.tipo === 'aporte' ? m.monto : -m.monto); }
function pendientes() { return S.payables.filter(p => p.estado === 'pendiente'); }
function nominaEstimada(days) {
  const T = today(), out = [], emps = S.employees.filter(e => e.activo);
  const gen = new Set(S.payables.filter(p => p.categoria === 'Nómina').map(p => p.vence));
  for (let i = 0; i <= days; i++) { const d = addD(T, i); if (gen.has(d)) continue; const e = emps.filter(x => isPayday(d, x.periodicidad)); if (e.length) out.push({ id: 'est-' + d, concepto: 'Nómina (por generar)', categoria: 'Nómina', monto: sum(e, 'sueldo'), vence: d, estado: 'pendiente', virtual: true }); }
  return out;
}
function compromisosProximos() { const lim = addD(today(), S.config.diasCompromisos); return pendientes().filter(p => p.vence <= lim).concat(nominaEstimada(S.config.diasCompromisos)); }
function disponible() { return saldoActual() - sum(compromisosProximos(), 'monto') - reserveBalance(); }

function avgByWeekday() {
  const T = today(), from = addD(T, -56), by = {};
  S.sales.forEach(s => { if (s.fecha < T && s.fecha >= from) by[s.fecha] = (by[s.fecha] || 0) + s.monto; });
  const sums = Array(7).fill(0), cnt = Array(7).fill(0);
  const first = S.sales.length ? S.sales.reduce((a, s) => s.fecha < a ? s.fecha : a, T) : T;
  for (let i = 1; i <= 56; i++) { const d = addD(T, -i); if (d < first) break; const w = pd(d).getDay(); sums[w] += by[d] || 0; cnt[w]++; }
  return sums.map((v, i) => cnt[i] ? v / cnt[i] : 0);
}
function avgDailyPurchases() {
  const T = today(), from = addD(T, -28);
  const tot = sum(S.purchases.filter(p => p.fecha >= from && p.fecha < T), 'costo');
  return tot / 28;
}
function isPayday(date, per) {
  const d = pd(date);
  if (per === 'semanal') return d.getDay() === 6;
  return d.getDate() === 15 || d.getDate() === lastDay(d.getFullYear(), d.getMonth());
}
function proyeccion(days, sc) {
  sc = sc || {};
  const T = today(); const f = 1 + (Number(sc.ventasPct) || 0) / 100;
  const avg = avgByWeekday().map(v => v * f); const dp = avgDailyPurchases() * f;
  let pend = pendientes();
  if (sc.mover && sc.mover.id) {
    const m = sc.mover, p0 = pend.find(x => x.id === m.id);
    if (p0) {
      pend = pend.filter(x => x.id !== m.id);
      if (m.modo === 'dividir') { const a = Math.round(p0.monto / 2); pend.push(Object.assign({}, p0, { monto: a, vence: m.f1 || p0.vence }), Object.assign({}, p0, { monto: p0.monto - a, vence: m.f2 || addD(p0.vence, 30) })); }
      else pend.push(Object.assign({}, p0, { vence: m.f1 || p0.vence }));
    }
  }
  const extras = sc.extras || [];
  const emps = S.employees.filter(e => e.activo);
  const payDates = new Set(S.payables.filter(p => p.categoria === 'Nómina').map(p => p.vence));
  let bal = saldoActual() - (Number(sc.retiroHoy) || 0); const out = [];
  for (let i = 1; i <= days; i++) {
    const date = addD(T, i); const w = pd(date).getDay();
    let egr = dp, ing = avg[w]; const items = [];
    pend.forEach(p => { if ((i === 1 && p.vence <= T) || p.vence === date) { egr += p.monto; items.push(p); } });
    extras.forEach(x => { if ((i === 1 && x.fecha <= T) || x.fecha === date) { if (x.monto >= 0) { egr += x.monto; items.push({ concepto: x.concepto || 'Gasto simulado', monto: x.monto, vence: date }); } else ing += -x.monto; } });
    if (!payDates.has(date)) {
      const nom = sum(emps.filter(e => isPayday(date, e.periodicidad)), 'sueldo');
      if (nom) { egr += nom; items.push({ concepto: 'Nómina (estimada)', monto: nom, vence: date, categoria: 'Nómina', virtual: true }); }
    }
    if (sc.empleado && sc.empleado.sueldo > 0 && date >= sc.empleado.desde && w === 6) egr += sc.empleado.sueldo;
    bal += ing - egr;
    out.push({ date, bal, ing, egr, items });
  }
  return out;
}
function retiroSeguro(series, disp) {
  const res = reserveBalance();
  const m = Math.min(disp, ...series.slice(0, 30).map(d => d.bal - res));
  return Math.max(0, Math.floor(m / 100) * 100);
}
function soluciones(al) {
  if (!al) return [];
  const out = []; const T = today();
  const big = al.causas.find(c => c.id && !c.virtual && c.monto >= 5000);
  const fmtRes = (r) => !r ? { ok: true, txt: 'La alerta desaparece' } : r.dias > al.dias ? { ok: true, txt: 'La alerta se mueve al ' + fds(r.fecha) + ', te da ' + (r.dias - al.dias) + ' días más' } : { ok: false, txt: 'No alcanza a resolverla' };
  if (big) {
    const s1 = { moverId: big.id, moverModo: 'dividir', f1: big.vence, f2: addD(big.vence, 30) };
    out.push({ texto: 'Dividir "' + big.concepto + '" en dos pagos de ' + money(big.monto / 2) + ', el segundo 30 días después', res: fmtRes(alerta(proyeccion(90, simScenario(s1)))), sim: s1 });
    const s2 = { moverId: big.id, moverModo: 'mover', f1: addD(big.vence, 14) };
    out.push({ texto: 'Pedir dos semanas más para "' + big.concepto + '"', res: fmtRes(alerta(proyeccion(90, simScenario(s2)))), sim: s2 });
  }
  if (S.recurring.some(r => r.activo && r.categoria === 'Retiro del dueño')) {
    const s3 = { retiroPct: 50, retiroHasta: al.fecha };
    out.push({ texto: 'Reducir a la mitad tu retiro semanal hasta el ' + fds(al.fecha), res: fmtRes(alerta(proyeccion(90, simScenario(s3)))), sim: s3 });
  }
  return out;
}
const SIM0 = () => ({ ventasPct: 0, retiroHoy: 0, gastoMonto: 0, gastoFecha: addD(today(), 7), empSueldo: 0, empDesde: nextSaturday(), moverId: '', moverModo: 'mover', f1: '', f2: '', retiroPct: 0, retiroHasta: addD(today(), 30) });
function simScenario(s) {
  s = Object.assign(SIM0(), s || {});
  const sc = { ventasPct: Number(s.ventasPct) || 0, retiroHoy: Number(s.retiroHoy) || 0, extras: [] };
  if (Number(s.gastoMonto) > 0) sc.extras.push({ fecha: s.gastoFecha || today(), monto: Number(s.gastoMonto), concepto: 'Gasto simulado' });
  if (Number(s.empSueldo) > 0) sc.empleado = { sueldo: Number(s.empSueldo), desde: s.empDesde || today() };
  if (s.moverId) sc.mover = { id: s.moverId, modo: s.moverModo, f1: s.f1, f2: s.f2 };
  if (Number(s.retiroPct) > 0) S.recurring.filter(r => r.activo && r.categoria === 'Retiro del dueño').forEach(r => occurrences(r, addD(today(), 1), s.retiroHasta || addD(today(), 30)).forEach(d => sc.extras.push({ fecha: d, monto: -r.monto * Number(s.retiroPct) / 100 })));
  return sc;
}
function alerta(series) {
  series = series || proyeccion(90); const res = reserveBalance();
  let idx = series.findIndex(d => d.bal < 0), tipo = 'efectivo';
  if (idx < 0) { idx = series.findIndex(d => d.bal < res); tipo = 'reserva'; }
  if (idx < 0) return null;
  const d = series[idx];
  const causas = series.slice(Math.max(0, idx - 3), idx + 1).flatMap(x => x.items).filter(x => x.monto >= 1000).sort((a, b) => b.monto - a.monto).slice(0, 3);
  return { tipo, dias: idx + 1, fecha: d.date, saldo: d.bal, causas };
}
function semaforo(disp, al) {
  if (disp < 0) return { k: 'rojo', label: 'En riesgo', text: 'Tus pagos próximos y tu fondo de reserva suman más que tu saldo. Revisa qué pagos puedes mover o qué gastos puedes frenar.' };
  if (disp < S.config.umbralVerde || (al && al.dias <= 30)) return { k: 'amarillo', label: 'Con cuidado', text: al && al.dias <= 30 ? 'Hoy alcanzas a cubrir tus pagos, pero la proyección muestra un apretón en las próximas semanas.' : 'Cubres tus pagos, pero con poco margen. Evita compras o retiros grandes esta semana.' };
  return { k: 'verde', label: 'Estable', text: 'Cubres tus pagos próximos, mantienes tu fondo de reserva y la proyección no muestra faltantes.' };
}
function avisos() {
  const T = today(), out = [], ayer = addD(T, -1);
  const al = alerta();
  if (al) out.push({ k: al.tipo === 'efectivo' ? 'bad' : 'warn', t: 'Alerta de liquidez en ' + al.dias + ' días', d: 'Tu saldo proyectado para el ' + fdl(al.fecha) + ' sería de ' + money(al.saldo) + '.', a: 'simFromAlert', l: 'Buscar soluciones' });
  const venc = pendientes().filter(p => p.vence < T);
  if (venc.length) out.push({ k: 'bad', t: venc.length === 1 ? 'Tienes un pago vencido' : 'Tienes ' + venc.length + ' pagos vencidos', d: venc.map(v => v.concepto + ' (' + money(v.monto) + ')').slice(0, 2).join(', '), a: 'nav', v: 'pagos', l: 'Ver pagos' });
  const nom = nominaEstimada(S.config.diasCompromisos);
  if (nom.length) out.push({ k: 'warn', t: 'Nómina por generar', d: 'El ' + fdl(nom[0].vence) + ' toca pagar aproximadamente ' + money(nom[0].monto) + '.', a: 'goNomina', l: 'Generar nómina' });
  if (S.sales.length && !S.sales.some(s => s.fecha === ayer)) out.push({ k: 'info', t: 'Falta la venta de ayer', d: 'Registra la venta del ' + fdl(ayer) + ' para que tus cálculos sean exactos.', a: 'quickSale', l: 'Registrar venta' });
  if (S.products.length && !S.closings.some(c => c.fecha === ayer)) out.push({ k: 'info', t: 'Falta el cierre de ayer', d: 'Anota sobrantes y merma del ' + fdl(ayer) + '.', a: 'goCierre', l: 'Hacer cierre' });
  const mk = monthKey(T); const by = {};
  S.closings.filter(c => monthKey(c.fecha) === mk).forEach(c => by[c.productId] = (by[c.productId] || 0) + mermaCosto(c));
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 300) { const pr = S.products.find(x => x.id === top[0]); if (pr) out.push({ k: 'info', t: pr.nombre + ': la merma más alta del mes', d: 'Llevas ' + money(top[1]) + ' en producto desperdiciado. Revisa la compra sugerida.', a: 'goSugerida', l: 'Ver compra sugerida' }); }
  if (S.reserve.meta && reserveBalance() < S.reserve.meta * 0.5) out.push({ k: 'info', t: 'Tu fondo de reserva va a la mitad', d: 'Llevas ' + money(reserveBalance()) + ' de ' + money(S.reserve.meta) + '.', a: 'nav', v: 'reserva', l: 'Ver fondo' });
  return out;
}
function mermaCosto(c) {
  const last = S.purchases.filter(p => p.productId === c.productId && p.cantidad > 0).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const prod = S.products.find(p => p.id === c.productId);
  const unit = last ? last.costo / last.cantidad : (prod ? prod.precioRef || 0 : 0);
  return c.merma * unit;
}

/* Genera pagos de gastos fijos y estimaciones de impuestos */
function occurrences(r, from, to) {
  const out = []; let d = pd(from); const end = pd(to);
  if (r.frecuencia === 'semanal') {
    while (d.getDay() !== Number(r.diaSemana)) d.setDate(d.getDate() + 1);
    while (d <= end) { out.push(ds(d)); d.setDate(d.getDate() + 7); }
  } else {
    const step = r.frecuencia === 'bimestral' ? 2 : 1;
    let y = d.getFullYear(), m = d.getMonth();
    while (true) {
      const day = Math.min(Number(r.dia), lastDay(y, m)); const occ = new Date(y, m, day);
      if (occ > end) break;
      if (occ >= pd(from)) out.push(ds(occ));
      m += step; if (m > 11) { y += Math.floor(m / 12); m = m % 12; }
    }
  }
  return out;
}
function ensureGenerated() {
  const T = today(), end = addD(T, 90);
  const keys = new Set(S.payables.map(p => p.key).filter(Boolean));
  S.recurring.forEach(r => {
    if (!r.activo) return;
    const from = r.desde > addD(T, -120) ? r.desde : addD(T, -120);
    occurrences(r, from, end).forEach(date => {
      const key = 'rec:' + r.id + ':' + date;
      if (!keys.has(key)) { S.payables.push({ id: keyId(key), key, concepto: r.nombre, categoria: r.categoria, monto: r.monto, vence: date, estado: 'pendiente', origen: 'recurrente' }); keys.add(key); }
    });
  });
  const base = sum(S.sales.filter(s => s.fecha >= addD(T, -30) && s.fecha < T), 'monto') * S.config.impuestoPct / 100;
  const t = pd(T);
  for (let k = 0; k <= 3; k++) {
    const dt = new Date(t.getFullYear(), t.getMonth() + k, 17); const date = ds(dt);
    if (date < T || date > end) continue;
    const key = 'tax:' + monthKey(date);
    const ex = S.payables.find(p => p.key === key);
    if (!ex) { if (base > 0) S.payables.push({ id: keyId(key), key, concepto: 'Impuestos del mes (estimación)', categoria: 'Impuestos', monto: Math.round(base), vence: date, estado: 'pendiente', estimado: true }); }
    else if (ex.estado === 'pendiente' && ex.estimado && Math.abs(ex.monto - Math.round(base)) > 50) ex.monto = Math.round(base);
  }
}

/* ============ Datos de demostración ============ */
function seedDemo() {
  const prev = S; const R = mulberry32(20261005); const T = today();
  const D = blankData({ nombre: 'Taquería Lupita', ciudad: 'Guadalajara, Jal.', giro: 'Taquería', empleados: 5 });
  D.config.plan = 'acompanamiento'; S = D;
  D.products = [['Tortilla de maíz', 'kg', 24], ['Carne de res para asada', 'kg', 215], ['Carne de cerdo al pastor', 'kg', 138], ['Cebolla', 'kg', 28], ['Cilantro', 'manojo', 12], ['Limón', 'kg', 38], ['Aguacate', 'kg', 72], ['Queso Oaxaca', 'kg', 155], ['Refrescos', 'caja', 215]]
    .map(([n, u, p]) => ({ id: uid(), nombre: n, unidad: u, precioRef: p }));
  D.suppliers = [['Tortillería La Esperanza', '33 1234 5678', 0], ['Carnicería Don Chuy', '33 2345 6789', 7], ['Frutas y Verduras Alcalde', '33 3456 7890', 0], ['Distribuidora del Bajío', '33 4567 8901', 0]]
    .map(([n, t, c]) => ({ id: uid(), nombre: n, telefono: t, credito: c }));
  const P = D.products, SU = D.suppliers;
  // Ventas
  const base = [12500, 6800, 7200, 7600, 8400, 11800, 14200];
  for (let i = 92; i >= 1; i--) {
    const f = addD(T, -i), d = pd(f), dm = d.getDate();
    let v = base[d.getDay()]; if ((dm >= 14 && dm <= 16) || dm >= 29 || dm <= 1) v *= 1.12; if (d.getDay() === 2 && i <= 28) v *= 1.17;
    v *= 0.88 + R() * 0.24; v = Math.round(v / 10) * 10;
    const ef = Math.round(v * (0.36 + R() * 0.14) / 10) * 10;
    const tr = R() < 0.35 ? Math.round(v * 0.08 / 10) * 10 : 0;
    D.sales.push({ id: uid(), fecha: f, monto: ef, metodo: 'Efectivo' });
    D.sales.push({ id: uid(), fecha: f, monto: v - ef - tr, metodo: 'Tarjeta' });
    if (tr) D.sales.push({ id: uid(), fecha: f, monto: tr, metodo: 'Transferencia' });
  }
  // Compras
  const plan = [[0, 26, 0, [1, 3, 5, 6]], [1, 18, 1, [1, 4]], [2, 20, 1, [1, 4]], [3, 8, 2, [1, 3, 5]], [4, 20, 2, [1, 3, 5]], [5, 12, 2, [1, 3, 5]], [6, 9, 2, [1, 3, 5]], [7, 10, 3, [2]], [8, 8, 3, [2]]];
  for (let i = 92; i >= 1; i--) {
    const f = addD(T, -i), w = pd(f).getDay();
    plan.forEach(([pi, q, si, days]) => {
      if (!days.includes(w)) return;
      const qty = Math.round(q * 1.2 * (0.9 + R() * 0.2) * (P[pi].unidad === 'kg' ? 10 : 1)) / (P[pi].unidad === 'kg' ? 10 : 1);
      const costo = Math.round(qty * P[pi].precioRef * (0.97 + R() * 0.08));
      const sup = SU[si]; const id = uid();
      const credito = sup.credito > 0; const vence = credito ? addD(f, sup.credito) : f;
      D.purchases.push({ id, fecha: f, productId: P[pi].id, cantidad: qty, costo, supplierId: sup.id });
      D.payables.push({ id: uid(), key: 'comp:' + id, concepto: 'Compra: ' + P[pi].nombre, categoria: 'Proveedores', monto: costo, vence, estado: 'pendiente', proveedor: sup.nombre, origen: 'compra' });
    });
  }
  // Cierres y merma
  const mermaMax = [1.5, 0.5, 0.8, 0.4, 4, 0.6, 1.2, 0.3, 0];
  for (let i = 40; i >= 1; i--) {
    const f = addD(T, -i);
    P.forEach((p, pi) => {
      const step = p.unidad === 'kg' ? 10 : 1;
      const merma = Math.round(R() * mermaMax[pi] * step) / step;
      const sobr = Math.round(R() * (pi === 8 ? 3 : mermaMax[pi] * 2 + 0.5) * step) / step;
      D.closings.push({ id: uid(), fecha: f, productId: p.id, sobrante: sobr, merma });
    });
  }
  // Empleados y nómina
  D.employees = [['Rosa Martínez', 'Cocinera', 3400, '2021-03-15'], ['Juan Pérez', 'Taquero', 3100, '2022-01-10'], ['Miguel Ángel López', 'Taquero', 2900, '2023-06-01'], ['Daniela Torres', 'Mesera', 2300, '2024-02-19'], ['Luis Ramírez', 'Ayudante de cocina', 2200, '2025-08-04']]
    .map(([n, p, s, f]) => ({ id: uid(), nombre: n, puesto: p, sueldo: s, periodicidad: 'semanal', ingreso: f, activo: true }));
  for (let i = 92; i >= 1; i--) {
    const f = addD(T, -i); if (pd(f).getDay() !== 6) continue;
    const items = D.employees.map(e => { const bonos = R() < 0.15 ? 300 : 0; const ded = R() < 0.1 ? 250 : 0; return { empId: e.id, nombre: e.nombre, sueldo: e.sueldo, dias: 6, bonos, deducciones: ded, neto: e.sueldo + bonos - ded }; });
    const id = uid(); const total = sum(items, 'neto');
    D.payrolls.push({ id, tipo: 'semanal', inicio: addD(f, -6), fin: f, fechaPago: f, items, total, estado: 'pagada' });
    D.payables.push({ id: uid(), key: 'nom:' + id, concepto: 'Nómina semanal', categoria: 'Nómina', monto: total, vence: f, estado: 'pendiente', payrollId: id });
  }
  // Gastos fijos
  const desde = addD(T, -95);
  D.recurring = [['Renta del local', 'Renta', 18000, 'mensual', 1, 0], ['Luz (CFE)', 'Servicios', 4200, 'mensual', 12, 0], ['Agua', 'Servicios', 950, 'mensual', 20, 0], ['Gas LP', 'Servicios', 2800, 'mensual', 8, 0], ['Internet y teléfono', 'Servicios', 650, 'mensual', 5, 0], ['Sistema de punto de venta', 'Servicios', 499, 'mensual', 3, 0], ['Retiro del dueño', 'Retiro del dueño', 9000, 'semanal', 1, 0]]
    .map(([n, c, m, fr, dia, dw]) => ({ id: uid(), nombre: n, categoria: c, monto: m, frecuencia: fr, dia, diaSemana: dw, activo: true, desde }));
  // Impuestos pagados en meses anteriores
  const t = pd(T);
  for (let k = 3; k >= 0; k--) {
    const dt = new Date(t.getFullYear(), t.getMonth() - k, 17); const date = ds(dt);
    if (date >= T || date < addD(T, -92)) continue;
    const pm = new Date(dt.getFullYear(), dt.getMonth() - 1, 1); const pk = ds(pm).slice(0, 7);
    let b = sum(D.sales.filter(s => monthKey(s.fecha) === pk), 'monto'); if (b < 150000) b = 300000;
    D.payables.push({ id: uid(), key: 'tax:' + monthKey(date), concepto: 'ISR e IVA (pago provisional)', categoria: 'Impuestos', monto: Math.round(b * 0.04), vence: date, estado: 'pendiente' });
  }
  ensureGenerated();
  D.payables.forEach(p => { if (p.vence < T) { p.estado = 'pagado'; p.pagadoEl = p.vence; } });
  [[-72, 'Abono al crédito de equipo de cocina', 'Créditos', 30000], [-42, 'Abono al crédito de equipo de cocina', 'Créditos', 30000], [-12, 'Abono al crédito de equipo de cocina', 'Créditos', 30000], [-55, 'Remodelación de baños', 'Mantenimiento', 38000], [-30, 'Seguro anual del local', 'Otros', 16500]]
    .forEach(([d, c, k, m]) => D.payables.push({ id: uid(), concepto: c, categoria: k, monto: m, vence: addD(T, d), estado: 'pagado', pagadoEl: addD(T, d), origen: 'manual' }));
  D.payables.push({ id: uid(), concepto: 'Mantenimiento de campana extractora', categoria: 'Mantenimiento', monto: 1800, vence: addD(T, -2), estado: 'pendiente', origen: 'manual' });
  D.payables.push({ id: uid(), concepto: 'Refrendo de licencia municipal', categoria: 'Otros', monto: 14500, vence: addD(T, 16), estado: 'pendiente', origen: 'manual' });
  D.payables.push({ id: uid(), concepto: 'Pago final del crédito de equipo de cocina', categoria: 'Créditos', monto: 62000, vence: addD(T, 18), estado: 'pendiente', origen: 'manual' });
  // Fondo de reserva
  D.reserve = { meta: 60000, movs: [{ id: uid(), fecha: addD(T, -70), tipo: 'aporte', monto: 10000, nota: 'Inicio del fondo' }, { id: uid(), fecha: addD(T, -45), tipo: 'aporte', monto: 8000, nota: 'Quincena buena' }, { id: uid(), fecha: addD(T, -20), tipo: 'aporte', monto: 7000, nota: '' }] };
  // Promociones y cortes de caja
  let inicioPromo = addD(T, -28); while (pd(inicioPromo).getDay() !== 2) inicioPromo = addD(inicioPromo, 1);
  D.promos = [{ id: uid(), nombre: 'Martes de pastor', dia: 2, tipo: 'combo', desc: '5 tacos al pastor + refresco', precio: '$99', horario: '1:00 a 6:00 p.m.', inicio: inicioPromo, activa: true }];
  for (let i = 14; i >= 1; i--) {
    const f = addD(T, -i); const ef = sum(D.sales.filter(s => s.fecha === f && s.metodo === 'Efectivo'), 'monto');
    const gas = [0, 0, 180, 350, 0, 520, 0, 240][Math.floor(R() * 8)]; const dif = [0, 0, 0, 0, -50, 20, -120, 0, 30, -20][Math.floor(R() * 10)];
    D.cortes.push({ id: uid(), fecha: f, fondo: 1500, ventasEf: ef, gastosEf: gas, contado: 1500 + ef - gas + dif, nota: dif < -100 ? 'Revisar con cajera' : '' });
  }
  // Calibrar saldo para que la demo muestre una alerta realista
  D.config.saldoInicial = 0;
  const c0 = saldoActual(); const ser = proyeccion(18);
  const delta = ser[17].bal - c0; const target = reserveBalance() - 3000;
  D.config.saldoInicial = Math.round((target - delta - c0) / 100) * 100;
  // Comunidad
  const posts = [
    { a: 'Martha Gómez', r: 'Cocina Doña Mary', c: 'Tonalá, Jal.', cat: 'Finanzas', d: -1, t: 'Separar la renta desde que entra el dinero me salvó este mes', b: 'Desde hace dos meses aparto cada día una parte de la venta para la renta. Antes llegaba el día 1 y siempre andaba juntando. Este mes por primera vez la pagué sin pedir prestado.', u: 14, cm: [['Ricardo Salas', 'Birria Don Ramón', '¿Lo apartas en otra cuenta o en efectivo? Yo lo intenté en efectivo y terminaba usándolo para proveedores.'], ['Martha Gómez', 'Cocina Doña Mary', 'En una cuenta aparte del banco. Si lo veo, me lo gasto.']] },
    { a: 'Ricardo Salas', r: 'Birria Don Ramón', c: 'Zapopan, Jal.', cat: 'Proveedores', d: -2, t: '¿Cómo le hacen para negociar crédito con el carnicero?', b: 'Mi carnicero me pide pago de contado y en semanas flojas me aprieta mucho. ¿A ustedes les dan crédito? ¿Cuántos días?', u: 9, cm: [['Lupita Hernández', 'Taquería Lupita', 'A mí me dan 7 días desde que le compro diario y le pago siempre puntual. Tardó como 6 meses en darme la confianza.'], ['José Luis Cárdenas', 'Mariscos El Güero', 'Con mi proveedor de camarón negocié 15 días mostrándole que llevo dos años comprándole cada semana.']] },
    { a: 'Andrea Villalobos', r: 'Café Nogal', c: 'Guadalajara, Jal.', cat: 'Marketing', d: -4, t: 'Los martes eran nuestro peor día. Probamos un combo y subió la venta', b: 'Vimos que los martes vendíamos casi la mitad que el fin de semana. Pusimos café de olla con pan dulce a precio especial solo los martes por la tarde. En tres semanas el martes subió bastante y no nos costó casi nada.', u: 21, cm: [['Pedro Ávila', 'Pozolería Los Arcos', 'Buena idea. ¿Lo anunciaron en redes o solo en el local?'], ['Andrea Villalobos', 'Café Nogal', 'Un letrero afuera y una historia de Instagram cada martes en la mañana.']] },
    { a: 'Pedro Ávila', r: 'Pozolería Los Arcos', c: 'Zapopan, Jal.', cat: 'Administración', d: -6, t: '¿Pagan nómina semanal o quincenal?', b: 'Tengo 6 empleados y les pago quincenal, pero me piden semanal. Me preocupa que la semana floja no me alcance. ¿Qué les ha funcionado?', u: 7, cm: [['Martha Gómez', 'Cocina Doña Mary', 'Semanal. A mí me ayuda a no juntar un pago grande y la gente está más contenta.']] },
    { a: 'José Luis Cárdenas', r: 'Mariscos El Güero', c: 'Tlaquepaque, Jal.', cat: 'Finanzas', d: -9, t: 'El aguacate se nos está comiendo la merma', b: 'Hice cuentas con el registro de merma y el aguacate es lo que más tiramos. Ahora compro tres veces por semana en vez de una sola compra grande. Les recomiendo revisar su reporte de merma, a mí me abrió los ojos.', u: 17, cm: [] }
  ];
  D.posts = posts.map(p => ({ id: uid(), autor: p.a, restaurante: p.r, ciudad: p.c, categoria: p.cat, fecha: addD(T, p.d), titulo: p.t, cuerpo: p.b, utiles: p.u, miUtil: false, denuncias: 0, autorId: 'demo-' + p.r, comentarios: p.cm.map((c, i) => ({ id: uid(), autor: c[0], restaurante: c[1], fecha: addD(T, Math.min(0, p.d + 1 + (i ? 0 : 0))), texto: c[2] })) }));
  // Asesor
  const big = addD(T, 18);
  D.advisor = { nombre: 'Fernanda Ruiz', proxima: addD(T, 4) + 'T17:00' };
  D.msgs = [
      { de: 'asesor', fecha: addD(T, -6), texto: 'Hola, Lupita. Revisé tu semana: vendiste un poco más que la anterior y la merma de aguacate bajó. Vas muy bien con el cierre diario.' },
      { de: 'yo', fecha: addD(T, -5), texto: 'Gracias. ¿Crees que ya pueda aumentar el retiro semanal?' },
      { de: 'asesor', fecha: addD(T, -5), texto: 'Todavía no. Te explico en la sesión, pero en resumen: tienes el pago del equipo de cocina pronto y conviene llegar con margen.' },
      { de: 'asesor', fecha: addD(T, -1), texto: 'Ojo con el ' + fdl(big) + ': el pago final del equipo de cocina es de $62,000. Con el ritmo de ventas actual quedarías por debajo de tu fondo de reserva. Te propongo hablar con el proveedor para dividirlo en dos pagos. Lo vemos en la sesión.' }
  ].map(m => ({ id: uid(), autor: m.de === 'asesor' ? 'Fernanda Ruiz' : 'Lupita Hernández', ...m, de: m.de === 'yo' ? 'dueno' : 'asesor' }));
  D.payables.forEach(p => { if (p.key) p.id = keyId(p.key); });
  S = prev; return D;
}

/* ============ Íconos e ilustraciones ============ */
const IC = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  ventas: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  pagos: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3',
  reserva: 'M8 3h8M7 6h10M7 6c-2 2-2 4-2 7v5a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-5c0-3 0-5-2-7M9 13h6',
  simulador: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  perecederos: 'M3 9h18l-2 11H5zM8 9l4-6 4 6M9 13v4M15 13v4',
  nomina: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3 3 0 0 1 0 5.6M21 20c0-2.6-1.7-4.8-4-5.6',
  impuestos: 'M6 3h9l4 4v14H6zM14 3v5h5M9 17l6-6M9.5 11.5h.01M14.5 16.5h.01',
  promos: 'M3 10v4h3l7 4V6l-7 4zM16 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11',
  financiamiento: 'M3 10l9-6 9 6M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 21h18',
  reportes: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  comunidad: 'M4 5h12v9H8l-4 3zM10 17h6l4 3V9h-2',
  asesor: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
  clientes: 'M4 7h16v13H4zM9 7V4h6v3M4 12h16',
  escudo: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM9 12l2 2 4-4',
  candado: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  config: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  campana: 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  mas1: 'M12 5v14M5 12h14',
  alerta: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  sirvio: 'M20 6 9 17l-5-5',
  coment: 'M4 5h16v11H9l-5 4z',
  bandera: 'M5 21V4M5 4h11l-2 4 2 4H5',
  whats: 'M3 21l1.6-4.8A8.5 8.5 0 1 1 7.8 19.4zM9 9.5c0 3 2.5 5.5 5.5 5.5',
  salir: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
  volver: 'M15 6l-6 6 6 6',
  caja: 'M3 8h18v12H3zM7 8V5h10v3M12 12v4M10 14h4',
  cuchillo: 'M4 20 15 9M14 4l6 6-5 1-2-2z',
  dia: 'M6 3h12v18H6zM9.5 9.5l1.8 1.8 3.4-3.4M9.5 15.5h5',
  herr: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM16.5 13.5v6M13.5 16.5h6'
};
const icon = (k, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${k === 'mas' ? 3.2 : 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[k]}"/></svg>`;
const ILL = {
  ticket: '<rect x="14" y="6" width="36" height="46" rx="2"/><path d="M14 52l4.5 5 4.5-5 4.5 5 4.5-5 4.5 5 4.5-5 4.5 5 4.5-5"/><path d="M21 16h22M21 24h16M21 32h22M21 40h10"/><circle cx="44" cy="40" r="5"/>',
  canasta: '<path d="M8 28h48l-5 26H13z"/><path d="M20 28l10-16M44 28 34 12"/><circle cx="25" cy="21" r="5"/><path d="M38 22c4-6 10-6 12-4-2 4-8 6-12 4z"/><path d="M22 36v10M32 36v10M42 36v10"/>',
  calendario: '<rect x="8" y="12" width="48" height="42" rx="3"/><path d="M8 22h48M20 6v10M44 6v10"/><path d="M22 38l7 7 13-14"/>',
  equipo: '<circle cx="22" cy="24" r="7"/><circle cx="42" cy="24" r="7"/><path d="M8 52c0-8 6-14 14-14s14 6 14 14M28 52c0-8 6-14 14-14s14 6 14 14"/><path d="M15 15c2-6 12-6 14 0"/>',
  platica: '<path d="M6 10h32v22H18l-8 7v-7H6z"/><path d="M26 38v4h18l8 7v-7h6V20H44"/><path d="M14 18h16M14 24h10"/>',
  alcancia: '<path d="M18 14h28M16 20h32"/><path d="M16 20c-6 6-6 12-6 20v8a6 6 0 0 0 6 6h32a6 6 0 0 0 6-6v-8c0-8 0-14-6-20"/><circle cx="32" cy="38" r="7"/><path d="M32 34v8"/>',
  megafono: '<path d="M8 26v12h8l20 12V14L16 26z"/><path d="M44 24a10 10 0 0 1 0 16M50 18a18 18 0 0 1 0 28"/><path d="M16 38l4 14h6l-3-12"/>'
};
const ill = k => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ILL[k]}</svg>`;
const empty = (k, t, d, btn) => `<div class="empty">${ill(k)}<b>${t}</b>${d ? `<p>${d}</p>` : ''}${btn || ''}</div>`;

/* ============ Configuración y estado ============ */
const CFG = window.PY_CONFIG || {};
const API = String(CFG.apiUrl || '').trim();
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};
const K_LOCAL = 'pymx_local_v3', K_SES = 'pymx_sesion_v3', K_UI = 'pymx_ui_v3';

let MODE = null;      // 'local' (demostración o sin servidor) | 'cloud'
let S = null;         // datos del restaurante abierto
let USER = null;      // { id, nombre, email, rol }
let SESSION = null;   // nube: { token, user, restauranteId }
let LOCAL = null;     // local: { account, data, session }
let READONLY = false; // asesor revisando a un cliente
let VIEWING = null;   // asesor: restaurante abierto
let FEED = null, CLIENTES = null, TEAM = null;
let BOOTING = null;   // texto mientras carga
let ui = Object.assign({ view: 'inicio', pTab: 'compras', eTab: 'equipo', gTab: 'proximos', vTab: 'registro', range: 30, cat: 'Todas', open: {}, newPost: false, payFilter: 'Todas', loginTab: 'entrar', tema: 'sistema', tourDone: false }, LS.get(K_UI, {}));
function saveUI() { LS.set(K_UI, { view: ui.view, tema: ui.tema, tourDone: ui.tourDone, range: ui.range }); }

function blankData(r) {
  return {
    restaurant: Object.assign({ nombre: 'Mi restaurante', ciudad: '', giro: '' }, r || {}),
    config: { saldoInicial: 0, diasCompromisos: 7, umbralVerde: 20000, impuestoPct: 4, cuotasPct: 12, plan: 'autogestion', fondoCaja: 1500 },
    sales: [], products: [], suppliers: [], purchases: [], closings: [], employees: [], payrolls: [],
    recurring: [], payables: [], reserve: { meta: 0, movs: [] }, cash: [], posts: [], promos: [], cortes: [], msgs: [],
    advisor: { nombre: '', proxima: null },
    funciones: { credito: true, simulador: true, promos: true, comunidad: true, equipo: true }, solicitud: ''
  };
}
const ROL = () => (USER && USER.rol) || 'dueno';
const isOwner = () => ROL() === 'dueno';
const isStaff = () => ROL() === 'staff';
const isAsesor = () => ROL() === 'asesor';
const isAdmin = () => ROL() === 'admin';
const noRest = () => isAdmin() || (isAsesor() && !VIEWING);

/* ============ Colecciones (iguales a las hojas del Sheets) ============ */
const COLS = { ventas: 'sales', productos: 'products', proveedores: 'suppliers', compras: 'purchases', cierres: 'closings', empleados: 'employees', nominas: 'payrolls', gastos_fijos: 'recurring', pagos: 'payables', reserva: 'reserve.movs', movimientos: 'cash', promociones: 'promos', cortes: 'cortes', mensajes: 'msgs' };
function colGet(D, c) { const k = COLS[c]; return k.includes('.') ? D[k.split('.')[0]][k.split('.')[1]] : D[k]; }
function colSet(D, c, arr) { const k = COLS[c]; if (k.includes('.')) D[k.split('.')[0]][k.split('.')[1]] = arr; else D[k] = arr; }
function restOf() {
  const cfg = Object.assign({}, S.config); delete cfg.plan;
  return { nombre: S.restaurant.nombre, ciudad: S.restaurant.ciudad, giro: S.restaurant.giro || '', plan: S.config.plan, datos: { config: cfg, reservaMeta: S.reserve.meta } };
}
function buildS(R, cols) {
  const D = blankData({ nombre: R.nombre, ciudad: R.ciudad, giro: R.giro });
  const d = R.datos || {};
  Object.assign(D.config, d.config || {}); D.config.plan = R.plan || D.config.plan;
  D.reserve.meta = Number(d.reservaMeta) || 0;
  D.advisor = Object.assign({ nombre: '', proxima: null }, R.asesor || {});
  Object.assign(D.funciones, R.funciones || {}); D.solicitud = R.solicitud || '';
  for (const c in COLS) colSet(D, c, (cols && cols[c]) || []);
  return D;
}
function allCols(D) { const o = {}; for (const c in COLS) o[c] = colGet(D, c); return o; }

/* ============ Servidor (Google Apps Script) ============ */
async function api(action, data) {
  const body = JSON.stringify(Object.assign({ action, token: SESSION ? SESSION.token : undefined }, data || {}));
  let r;
  try { r = await fetch(API, { method: 'POST', body, redirect: 'follow' }); }
  catch (e) { const er = new Error('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.'); er.code = 'red'; throw er; }
  let j; try { j = await r.json(); } catch (e) { const er = new Error('El servidor respondió algo inesperado. Revisa que el enlace del Apps Script sea el correcto.'); er.code = 'red'; throw er; }
  if (!j.ok) { const er = new Error(j.error || 'Algo salió mal en el servidor.'); er.code = j.code; if (j.code === 'sesion' || j.code === 'suspendida') onSessionLost(j.code === 'suspendida' ? j.error : null); throw er; }
  return j;
}
function onSessionLost(msg) { SESSION = null; USER = null; S = null; MODE = null; BOOTING = null; LS.del(K_SES); ui.loginTab = 'entrar'; ui.loginError = msg || 'Tu sesión terminó. Vuelve a entrar.'; setTimeout(render, 0); }

/* Sincronización: cada cambio se guarda en una "bandeja de salida" y se envía al Sheets */
let SNAP = null, SENDING = null, syncTimer = null, SYNC = 'ok';
const outKey = () => 'pymx_out_' + (SESSION ? SESSION.restauranteId : 'x');
function snapshot() {
  const s = {};
  for (const c in COLS) { const m = {}; colGet(S, c).forEach(r => { if (r && r.id && !r.virtual) m[r.id] = JSON.stringify(r); }); s[c] = m; }
  s.__rest = JSON.stringify(restOf()); return s;
}
function collectChanges() {
  if (MODE !== 'cloud' || !S || !SNAP || READONLY) return;
  const box = LS.get(outKey(), { ups: {}, dels: {}, rest: null }); let n = 0;
  for (const c in COLS) {
    const prev = SNAP[c] || {}, cur = {};
    colGet(S, c).forEach(r => {
      if (!r || !r.id || r.virtual) return; const j = JSON.stringify(r); cur[r.id] = j;
      if (prev[r.id] !== j) { (box.ups[c] = box.ups[c] || {})[r.id] = r; if (box.dels[c]) delete box.dels[c][r.id]; n++; }
    });
    for (const id in prev) if (!(id in cur)) { (box.dels[c] = box.dels[c] || {})[id] = 1; if (box.ups[c]) delete box.ups[c][id]; n++; }
    SNAP[c] = cur;
  }
  const rj = JSON.stringify(restOf());
  if (isOwner() && rj !== SNAP.__rest) { box.rest = restOf(); SNAP.__rest = rj; n++; }
  if (n) { LS.set(outKey(), box); scheduleFlush(300); }
}
function boxEmpty(b) { return !b || (!b.rest && !Object.values(b.ups).some(o => Object.keys(o).length) && !Object.values(b.dels).some(o => Object.keys(o).length)); }
function scheduleFlush(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(flush, ms); }
async function flush() {
  if (MODE !== 'cloud' || SENDING || !SESSION) return;
  const box = LS.get(outKey(), null); if (boxEmpty(box)) { setSync('ok'); return; }
  SENDING = box; LS.set(outKey(), { ups: {}, dels: {}, rest: null }); setSync('saving');
  const upserts = {}, deletes = {};
  for (const c in box.ups) { const a = Object.values(box.ups[c]); if (a.length) upserts[c] = a; }
  for (const c in box.dels) { const a = Object.keys(box.dels[c]); if (a.length) deletes[c] = a; }
  try {
    await api('sync', { upserts, deletes, restaurante: box.rest || undefined });
    SENDING = null; setSync('ok');
    if (!boxEmpty(LS.get(outKey(), null))) scheduleFlush(200);
  } catch (e) {
    const cur = LS.get(outKey(), { ups: {}, dels: {}, rest: null });
    for (const c in box.ups) for (const id in box.ups[c]) if (!(cur.ups[c] && cur.ups[c][id]) && !(cur.dels[c] && cur.dels[c][id])) (cur.ups[c] = cur.ups[c] || {})[id] = box.ups[c][id];
    for (const c in box.dels) for (const id in box.dels[c]) if (!(cur.ups[c] && cur.ups[c][id])) (cur.dels[c] = cur.dels[c] || {})[id] = 1;
    if (box.rest && !cur.rest) cur.rest = box.rest;
    LS.set(outKey(), cur); SENDING = null;
    if (e.code === 'sesion') return;
    setSync(e.code === 'red' ? 'off' : 'error', e.message);
    scheduleFlush(e.code === 'red' ? 15000 : 30000);
  }
}
function setSync(s, msg) {
  SYNC = s; const t = { ok: 'Guardado en la nube', saving: 'Guardando…', off: 'Sin conexión: se guardará al reconectar', error: 'No se pudo guardar: ' + (msg || '') }[s] || '';
  document.querySelectorAll('[data-sync]').forEach(el => { el.className = 'sync ' + (s === 'ok' ? '' : s === 'saving' ? 'saving' : 'off'); el.querySelector('span').textContent = t; });
}
window.addEventListener('online', () => scheduleFlush(500));
window.addEventListener('beforeunload', e => { if (MODE === 'cloud' && (SENDING || !boxEmpty(LS.get(outKey(), null)))) { flush(); } });

async function loadRestaurant(rid, readonly) {
  BOOTING = readonly ? 'Abriendo el restaurante de tu cliente…' : 'Abriendo tu restaurante…'; render();
  if (!readonly) await flush();
  const j = await api('cargar', rid ? { restauranteId: rid } : {});
  S = buildS(j.restaurante, j.cols);
  READONLY = !!readonly; VIEWING = readonly ? { id: j.restaurante.id, nombre: j.restaurante.nombre } : null;
  if (!readonly) { SESSION.restauranteId = j.restaurante.id; LS.set(K_SES, SESSION); LS.set('pymx_cache_' + j.restaurante.id, { R: j.restaurante, cols: j.cols }); }
  SNAP = snapshot(); BOOTING = null;
}

/* ============ Navegación ============ */
// Herramientas extra: el dueño elige cuáles ver para que la app no se sienta pesada
const HERR = [
  ['ventas', 'Ventas y caja', 'Ventas por día y por forma de pago, corte de caja detallado e importar del punto de venta.'],
  ['reportes', 'Reportes', 'A dónde se fue el dinero de cada mes y cómo vas contra otros restaurantes.'],
  ['reserva', 'Fondo de reserva', 'Aparta dinero para emergencias y mira cuánto llevas.'],
  ['nomina', 'Empleados y nómina', 'Tu equipo, sueldos y la nómina de cada semana o quincena.'],
  ['perecederos', 'Perecederos', 'Compras a proveedores, cuánto comprar y cuánto se tira.'],
  ['impuestos', 'Impuestos', 'Una estimación de lo que tendrás que pagar para que no te agarre de sorpresa.'],
  ['simulador', 'Simulador', 'Prueba una decisión antes de tomarla: subir precios, contratar, comprar equipo.'],
  ['promos', 'Promociones', 'Encuentra tu día flojo y mide si una promoción funcionó.']
];
const HERR_KEYS = new Set(HERR.map(x => x[0]));
function herrOn(k) {
  const H = S && S.config.herramientas;
  if (H && k in H) return !!H[k];
  if (!S) return false;
  if (k === 'nomina') return S.employees.length > 0;
  if (k === 'perecederos') return S.products.length > 0;
  if (k === 'reserva') return S.reserve.meta > 0 || S.reserve.movs.length > 0;
  return false;
}
const VIEW_FN = { simulador: 'simulador', promos: 'promos', comunidad: 'comunidad' };
const fnOk = k => !VIEW_FN[k] || !S || !S.funciones || S.funciones[VIEW_FN[k]] !== false;
const creditoOn = () => !!(S && S.funciones && S.funciones.credito);
function navOwner() {
  const herr = HERR.filter(([k]) => fnOk(k) && herrOn(k)).map(([k, l]) => [k, l]);
  return [
    ['Tu día', [['inicio', 'Inicio'], ['dia', 'Cerrar el día'], ['pagos', 'Pagos y gastos']]],
    ['Crecer', [['financiamiento', 'Crédito'], ['comunidad', 'Comunidad'], ['asesor', 'Mi asesor']]],
    ['Herramientas', herr.concat([['herramientas', herr.length ? 'Agregar o quitar' : 'Agregar herramientas']])],
    ['Cuenta', [['config', 'Configuración']]]
  ];
}
const NAV_STAFF = [['Tu turno', [['dia', 'Cerrar el día'], ['ventas', 'Ventas y caja'], ['perecederos', 'Perecederos']]], ['Apoyo', [['comunidad', 'Comunidad']]], ['Cuenta', [['config', 'Mi cuenta']]]];
const NAV_ASESOR = [['Asesoría', [['clientes', 'Mis clientes']]], ['Apoyo', [['comunidad', 'Comunidad']]], ['Cuenta', [['config', 'Mi cuenta']]]];
const NAV_VIEWING = [['Asesoría', [['clientes', 'Mis clientes']]], ['Su negocio', [['inicio', 'Inicio'], ['ventas', 'Ventas y caja'], ['pagos', 'Pagos y gastos'], ['reportes', 'Reportes'], ['nomina', 'Empleados y nómina'], ['perecederos', 'Perecederos']]], ['Apoyo', [['asesor', 'Mensajes']]]];
const NAV_ADMIN = [['Administración', [['admin', 'Restaurantes'], ['asesores', 'Asesores']]], ['Apoyo', [['comunidad', 'Comunidad']]], ['Cuenta', [['config', 'Mi cuenta']]]];
const TITLES = { inicio: 'Inicio', dia: 'Cerrar el día', ventas: 'Ventas y caja', pagos: 'Pagos y gastos', reserva: 'Fondo de reserva', simulador: '¿Qué pasa si…?', perecederos: 'Perecederos', nomina: 'Empleados y nómina', impuestos: 'Impuestos', promos: 'Promociones', financiamiento: 'Crédito', reportes: 'Reportes', comunidad: 'Comunidad', asesor: 'Mi asesor', config: 'Configuración', clientes: 'Mis clientes', admin: 'Restaurantes', asesores: 'Asesores', herramientas: 'Herramientas' };
const ICON_OF = { inicio: 'inicio', dia: 'dia', ventas: 'ventas', pagos: 'pagos', reserva: 'reserva', simulador: 'simulador', perecederos: 'perecederos', nomina: 'nomina', impuestos: 'impuestos', promos: 'promos', financiamiento: 'financiamiento', reportes: 'reportes', comunidad: 'comunidad', asesor: 'asesor', config: 'config', clientes: 'clientes', admin: 'clientes', asesores: 'asesor', herramientas: 'herr' };
function navGroups() {
  let g;
  if (isAdmin()) return NAV_ADMIN;
  if (isAsesor()) g = VIEWING ? NAV_VIEWING : NAV_ASESOR;
  else if (isStaff()) g = NAV_STAFF;
  else g = navOwner();
  return g.map(([n, items]) => [n, items.filter(([k]) => fnOk(k))]).filter(x => x[1].length);
}
const allowedViews = () => navGroups().flatMap(g => g[1].map(x => x[0]));
function bottomItems() {
  const pref = isAdmin() ? ['admin', 'asesores', 'comunidad'] : isAsesor() && !VIEWING ? ['clientes', 'comunidad', 'config'] : isStaff() ? ['dia', 'ventas', 'perecederos'] : VIEWING ? ['inicio', 'pagos', 'asesor'] : ['inicio', 'dia', 'pagos', 'financiamiento'];
  return pref.filter(v => allowedViews().includes(v));
}
function applyTheme() {
  const t = ui.tema;
  if (t === 'claro') document.documentElement.dataset.theme = 'light';
  else if (t === 'oscuro') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = '#143D34';
}
function saludo() { const hh = new Date().getHours(); return hh < 12 ? 'Buenos días' : hh < 19 ? 'Buenas tardes' : 'Buenas noches'; }
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';

function render() {
  const app = document.getElementById('app'); applyTheme();
  if (BOOTING) { app.innerHTML = `<div class="login-main" style="min-height:100vh"><div class="empty">${ill('canasta')}<b>${h(BOOTING)}</b><p>Esto toma unos segundos.</p></div></div>`; return; }
  if (!USER || (!S && !noRest())) { app.innerHTML = vLogin(); return; }
  if (S && !READONLY && !isStaff()) ensureGenerated();
  let v = ui.view; if (!allowedViews().includes(v)) v = ui.view = allowedViews()[0];
  const views = { inicio: vInicio, dia: vDia, herramientas: vHerramientas, ventas: vVentas, pagos: vPagos, reserva: vReserva, simulador: vSimulador, perecederos: vPerecederos, nomina: vNomina, impuestos: vImpuestos, promos: vPromos, financiamiento: vFinanciamiento, reportes: vReportes, comunidad: vComunidad, asesor: vAsesor, config: vConfig, clientes: vClientes, admin: vAdmin, asesores: vAsesores };
  const nAv = S && !isStaff() && !(isAsesor() && !VIEWING) ? avisos() : [];
  const vencidos = S && !isStaff() ? pendientes().filter(p => p.vence < today()).length : 0;
  const nav = navGroups().map(([g, items]) => `<div class="navgroup"><span>${g}</span>${items.map(([k, l]) => `<button class="navbtn" data-a="nav" data-v="${k}" ${k === v ? 'aria-current="page"' : ''}>${icon(ICON_OF[k])}${l}${k === 'financiamiento' && !creditoOn() ? icon('candado', 'lock') : ''}${k === 'pagos' && vencidos ? `<span class="count" title="Pagos vencidos">${vencidos}</span>` : ''}</button>`).join('')}</div>`).join('');
  const restName = VIEWING ? VIEWING.nombre : S ? S.restaurant.nombre : 'Equipo .Py México';
  const planTxt = isAdmin() ? 'Administrador' : isAsesor() && !VIEWING ? 'Asesor del equipo' : isStaff() ? 'Encargado' : S && S.config.plan === 'acompanamiento' ? 'Plan Acompañamiento' : 'Plan Autogestión';
  const syncEl = MODE === 'cloud' ? `<span class="sync ${SYNC === 'ok' ? '' : SYNC === 'saving' ? 'saving' : 'off'}" data-sync><i></i><span>${SYNC === 'ok' ? 'Guardado en la nube' : 'Guardando…'}</span></span>` : `<span class="sync off" data-sync><i></i><span>${LOCAL && LOCAL.account && LOCAL.account.demo ? 'Demostración en este equipo' : 'Guardado en este equipo'}</span></span>`;
  const sub = v === 'inicio' && !READONLY ? '' : `${h(restName)}, ${fdl(today())}`;
  const title = v === 'inicio' ? (READONLY ? 'Así va ' + h(restName) : `${saludo()}, ${h(firstName(USER.nombre))}`) : TITLES[v];
  const actionsTop = S && !isAsesor() ? `<div class="actions">${!isStaff() ? `<button class="btn sec" data-a="avisos">${icon('campana')}Avisos${nAv.length ? ` <span class="badge ${nAv.some(a => a.k === 'bad') ? 'bad' : ''}">${nAv.length}</span>` : ''}</button><button class="btn sec" data-a="quickPay">Registrar pago</button>` : ''}${v !== 'dia' ? `<button class="btn" data-a="nav" data-v="dia" data-tour="registrar">${icon('dia')}Cerrar el día</button>` : ''}</div>` : '';
  const banner = READONLY ? `<div class="banner warn">${icon('asesor')}<span>Estás revisando <b>${h(restName)}</b> como asesor. Puedes ver todo y escribirle mensajes, pero no cambiar sus datos.</span><span class="spacer"></span><button class="btn sec sm" data-a="backClientes">Volver a mis clientes</button></div>`
    : MODE === 'local' && LOCAL.account.demo ? `<div class="banner">${icon('caja')}<span>Estás en la demostración con datos de ejemplo de una taquería. ${API ? 'Crea tu cuenta para registrar tu propio restaurante y guardar en la nube.' : 'Lo que cambies se guarda solo en este equipo.'}</span><span class="spacer"></span>${API ? '<button class="btn sm" data-a="toSignup">Crear mi cuenta</button>' : ''}</div>` : '';
  app.innerHTML = `
  <div class="app">
    <aside class="side">
      <div class="brand">.Py <b>México</b></div>
      <div class="rest-card"><span class="mono">${h(initials(restName))}</span><div><b>${h(restName)}</b><span>${planTxt}</span></div></div>
      <nav class="nav" aria-label="Secciones">${nav}</nav>
      <div class="side-foot">${syncEl}</div>
      <a class="side-link" href="privacidad.html" target="_blank" rel="noopener">Aviso de privacidad</a>
    </aside>
    <main class="${READONLY ? 'readonly' : ''}">
      ${banner}
      <header class="top">
        <div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : `<p class="sub">${cap(fdl(today()))}${S ? ', ' + h(S.restaurant.nombre) : ''}</p>`}</div>
        ${actionsTop}
      </header>
      <div class="content">${views[v]()}</div>
    </main>
    <nav class="bottomnav" aria-label="Menú">${bottomItems().map(k => `<button data-a="nav" data-v="${k}" ${k === v ? 'aria-current="page"' : ''}>${icon(ICON_OF[k])}${k === 'pagos' && vencidos ? `<span class="count">${vencidos}</span>` : ''}${(TITLES[k] || '').replace('Ventas y caja', 'Ventas').replace('Pagos y gastos', 'Pagos').replace('Mis clientes', 'Clientes').replace('Configuración', 'Cuenta').replace('Cerrar el día', 'Cerrar día')}</button>`).join('')}<button data-a="more">${icon('mas')}Más</button></nav>
  </div>`;
  decorateTables();
  if (ui.focus) { const el = document.getElementById(ui.focus); if (el) el.focus(); ui.focus = null; }
  if (v === 'inicio' && isOwner() && !READONLY && !ui.tourDone) showTour();
  collectChanges();
}
function decorateTables() {
  document.querySelectorAll('main table.t').forEach(t => {
    const hs = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim()); if (!hs.length) return;
    t.classList.add('cards');
    t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (hs[i]) td.dataset.label = hs[i]; if (td.querySelector('.acts')) td.classList.add('acts-cell'); }));
  });
}
function go(v) {
  if (isOwner() && !READONLY && S && HERR_KEYS.has(v) && fnOk(v) && !herrOn(v)) { S.config.herramientas = Object.assign({}, herrMap(), { [v]: true }); if (MODE === 'local') LS.set(K_LOCAL, LOCAL); toast('Agregamos ' + HERR.find(x => x[0] === v)[1] + ' a tus herramientas'); }
  ui.view = v; closeModal(); saveUI(); render(); window.scrollTo(0, 0); if (v === 'comunidad' && MODE === 'cloud') loadFeed(); if (v === 'asesor' && MODE === 'cloud') loadMsgs(); if (v === 'clientes') loadClientes(); if (v === 'config' && MODE === 'cloud' && isOwner()) loadTeam(); if ((v === 'admin' || v === 'asesores') && MODE === 'cloud') loadAdmin(); }
function herrMap() { const o = {}; HERR.forEach(([k]) => o[k] = herrOn(k)); return o; }
function commit(msg) {
  if (READONLY) { render(); toast('Como asesor solo puedes revisar y escribir mensajes.'); return; }
  if (MODE === 'local') LS.set(K_LOCAL, LOCAL);
  render(); if (msg) toast(msg);
}

/* ============ Recorrido de bienvenida ============ */
const TOUR = [
  ['caja', 'Tu dinero de un vistazo', 'Este número es lo que de verdad puedes usar hoy: tu saldo menos los pagos que ya vienen y tu fondo de reserva. La barra te muestra cómo se reparte.'],
  ['semaforo', 'El semáforo', 'Verde: vas bien. Amarillo: cuidado con compras o retiros grandes. Rojo: lo que debes supera lo que tienes. Debajo ves cuánto puedes retirar para ti sin riesgo.'],
  ['viene', 'Lo que viene', 'Tus pagos de los próximos días, ordenados. Cuando pagues uno, márcalo y tu dinero disponible se actualiza solo.'],
  ['registrar', 'Cierra tu día', 'Al cerrar, anota cuánto vendiste y si gastaste algo. Con eso basta para que las cuentas, las alertas y la proyección funcionen. Toma un minuto.']
];
function showTour() {
  const i = ui.tourStep || 0; const st = TOUR[i]; if (!st) return;
  document.querySelectorAll('.tour-on').forEach(e => e.classList.remove('tour-on'));
  const target = document.querySelector(`[data-tour="${st[0]}"]`); if (target) target.classList.add('tour-on');
  let t = document.getElementById('tour'); if (!t) { t = document.createElement('div'); t.id = 'tour'; t.className = 'tour'; t.setAttribute('role', 'dialog'); document.body.appendChild(t); }
  t.innerHTML = `<div class="step">Paso ${i + 1} de ${TOUR.length}</div><h3>${st[1]}</h3><p>${st[2]}</p><div class="row"><button class="btn sm" data-a="tourNext">${i === TOUR.length - 1 ? 'Empezar' : 'Siguiente'}</button><button class="btn ghost sm" data-a="tourEnd">Saltar recorrido</button></div>`;
}
function endTour() { ui.tourDone = true; ui.tourStep = 0; saveUI(); const t = document.getElementById('tour'); if (t) t.remove(); document.querySelectorAll('.tour-on').forEach(e => e.classList.remove('tour-on')); }

/* ============ Entrar y crear cuenta ============ */
function vLogin() {
  const t = ui.loginTab;
  const err = ui.loginError ? `<p class="error" role="alert">${h(ui.loginError)}</p>` : '';
  const ok = ui.loginOk ? `<p class="aviso info">${h(ui.loginOk)}</p>` : '';
  let form = '';
  if (t === 'entrar') form = `<h2>Entra a tu restaurante</h2><p class="muted">Con el correo y la contraseña de tu cuenta.</p>
    <form data-f="login">${err}${ok}
      <label>Correo electrónico<input name="email" type="email" required autocomplete="email" inputmode="email"></label>
      <label>Contraseña<input name="pass" type="password" required autocomplete="current-password"></label>
      <button class="btn" type="submit">Entrar</button>
    </form>
    <p class="switch">¿Primera vez? <button class="linkbtn" data-a="loginTab" data-v="crear">Crea la cuenta de tu restaurante</button>${API ? `<br><button class="linkbtn" data-a="loginTab" data-v="recuperar">Olvidé mi contraseña</button>` : ''}</p>`;
  else if (t === 'crear') form = `<h2>Crea la cuenta de tu restaurante</h2><p class="muted">Cada restaurante tiene su propio espacio. Solo se encuentran en la comunidad.</p>
    <form data-f="signup">${err}
      <label>Tu nombre<input name="nombre" required autocomplete="name"></label>
      <label>Correo electrónico<input name="email" type="email" required autocomplete="email" inputmode="email"></label>
      <label>Contraseña (mínimo 6 caracteres)<input name="pass" type="password" minlength="6" required autocomplete="new-password"></label>
      <label>Nombre del restaurante<input name="rest" required></label>
      <label>Ciudad<input name="ciudad" placeholder="Ej. Guadalajara, Jal." required></label>
      <label>¿Cuánto dinero tienes hoy entre banco y caja?<input name="saldo" type="number" min="0" step="1" required inputmode="numeric"></label>
      <label>Plan que te interesa<select name="plan"><option value="autogestion">Autogestión: tú llevas el control</option><option value="acompanamiento">Acompañamiento: con asesor</option></select></label>
      ${API ? '<p class="hint">Empiezas en Autogestión. Si eliges Acompañamiento, el equipo te contacta y lo activa al confirmar tu pago.</p>' : ''}
      <label class="check"><input type="checkbox" name="aviso" required><span>Leí y acepto el <a href="privacidad.html" target="_blank" rel="noopener">aviso de privacidad</a>.</span></label>
      <button class="btn" type="submit">Crear cuenta</button>
      ${API ? '' : '<p class="hint">Esta copia de la app no está conectada a la nube: la cuenta se guarda solo en este equipo.</p>'}
    </form>
    <p class="switch">¿Ya tienes cuenta? <button class="linkbtn" data-a="loginTab" data-v="entrar">Entra aquí</button></p>`;
  else form = ui.recStep ? `<h2>Escribe el código</h2><p class="muted">Te enviamos un código de 6 números a ${h(ui.recEmail)}. Revisa también tu correo no deseado.</p>
    <form data-f="reset">${err}<label>Código<input name="code" inputmode="numeric" maxlength="6" required></label><label>Nueva contraseña<input name="pass" type="password" minlength="6" required autocomplete="new-password"></label><button class="btn" type="submit">Cambiar contraseña</button></form>
    <p class="switch"><button class="linkbtn" data-a="loginTab" data-v="entrar">Volver a entrar</button></p>`
    : `<h2>Recupera tu contraseña</h2><p class="muted">Te mandamos un código a tu correo.</p>
    <form data-f="recover">${err}<label>Correo electrónico<input name="email" type="email" required></label><button class="btn" type="submit">Enviar código</button></form>
    <p class="switch"><button class="linkbtn" data-a="loginTab" data-v="entrar">Volver a entrar</button></p>`;
  return `
  <div class="login">
    <section class="login-side">
      <div class="brand">.Py <b>México</b></div>
      <div>
        <h1>Vender no es lo mismo que tener dinero para usar.</h1>
        <p class="lead">.Py México junta tus ventas, compras, nómina y pagos para decirte cuánto puedes usar hoy y avisarte antes de que te falte.</p>
      </div>
      <div class="preview-caja" aria-hidden="true">
        <div class="k">Lo que puedes usar hoy</div><div class="n">$4,656</div>
        <div class="bar"><span style="width:62%;background:#E9B45E"></span><span style="width:32%;background:#7FB3A3"></span><span style="width:6%;background:#F4F1E8"></span></div>
        <ul><li><i style="background:#E9B45E"></i>$48,719 apartados para pagos de esta semana</li><li><i style="background:#7FB3A3"></i>$25,000 de fondo de reserva</li><li><i style="background:#F4F1E8"></i>$4,656 libres</li></ul>
      </div>
    </section>
    <section class="login-main"><div class="login-card">
      ${form}
      <div class="divider">o</div>
      <button class="btn sec" data-a="demo">Ver la demostración de una taquería</button>
      <p class="switch"><a href="privacidad.html" target="_blank" rel="noopener">Aviso de privacidad</a><br><span class="hint">Proyecto académico de demostración</span></p>
    </div></section>
  </div>`;
}

/* ============ Inicio ============ */
function primerosPasos() {
  if (!isOwner() || READONLY) return '';
  const pasos = [
    ['Escribe con cuánto dinero empiezas hoy (banco y caja)', S.config.saldoInicial !== 0 || !!S.config.saldoOk, 'goSaldo'],
    ['Agrega tus gastos fijos: renta, luz, agua, gas', S.recurring.length > 0, 'goFijos'],
    ['Cierra tu primer día: cuánto vendiste y qué gastaste', S.sales.length > 0, 'goDia']
  ];
  const hechos = pasos.filter(x => x[1]).length;
  if (hechos === pasos.length) return '';
  return `<section class="panel"><div class="ph"><div><h2>Empieza en tres pasos</h2><p>Con esto la app ya puede decirte cuánto puedes usar y avisarte a tiempo. Llevas ${hechos} de ${pasos.length}.</p></div></div>
    <div class="progress"><span style="width:${hechos / pasos.length * 100}%"></span></div>
    <ol class="pasos">${pasos.map(([t, ok, a], i) => `<li class="${ok ? 'done' : ''}"><span class="n">${ok ? '✓' : i + 1}</span><span class="t">${t}</span>${ok ? '<span class="tag ok">Listo</span>' : `<button class="btn sec sm" data-a="${a}">Hacerlo ahora</button>`}</li>`).join('')}</ol></section>`;
}
function itemRow(p) {
  return `<div class="pitem"><span class="what"><div>${h(p.concepto)}</div><span>${h(p.categoria || '')}${p.proveedor ? ', ' + h(p.proveedor) : ''}${p.estimado ? ', estimación' : ''}</span></span><span class="amt">${money(p.monto)}</span>${p.virtual ? `<button class="btn sec sm" data-a="goNomina">Generar</button>` : `<button class="btn sec sm" data-a="markPaid" data-id="${p.id}">Pagado</button>`}</div>`;
}
function timeline(items, max) {
  const T = today(); if (!items.length) return empty('calendario', 'No tienes pagos en los próximos días', 'Cuando registres compras a crédito, gastos fijos o nómina, aparecerán aquí en orden.');
  const by = {}; items.forEach(p => { const k = p.vence < T ? 'venc' : p.vence; (by[k] = by[k] || []).push(p); });
  const keys = Object.keys(by).sort((a, b) => a === 'venc' ? -1 : b === 'venc' ? 1 : a.localeCompare(b));
  const shown = keys.slice(0, max || 99);
  return `<ol class="viene">${shown.map(k => {
    const d = k === 'venc' ? null : pd(k); const arr = by[k];
    const box = k === 'venc' ? `<div class="dia venc"><b>!</b><span>Vencido</span></div>` : `<div class="dia ${k === T ? 'hoy' : ''}"><b>${d.getDate()}</b><span>${k === T ? 'Hoy' : cap(DIAS[d.getDay()]).slice(0, 3)}</span></div>`;
    return `<li>${box}<div class="dia-items">${arr.map(itemRow).join('')}${arr.length > 1 ? `<span class="dia-tot">Total del día: ${money(sum(arr, 'monto'))}</span>` : ''}</div></li>`;
  }).join('')}</ol>${keys.length > shown.length ? `<p class="hint">Y ${keys.length - shown.length} días más con pagos. <button class="linkbtn" data-a="nav" data-v="pagos">Ver todos</button></p>` : ''}`;
}
function vInicio() {
  const T = today(), N = S.config.diasCompromisos;
  const saldo = saldoActual(), prox = compromisosProximos(), comp = sum(prox, 'monto'), res = reserveBalance(), disp = saldo - comp - res;
  const series = proyeccion(90), al = alerta(series), sem = semaforo(disp, al);
  const seg = retiroSeguro(series, disp); const sols = soluciones(al); ui.sols = sols;
  const upcoming = pendientes().filter(p => p.vence <= addD(T, 14)).concat(nominaEstimada(14)).sort((a, b) => a.vence.localeCompare(b.vence));
  // barra de sobres
  let bar, legend;
  if (disp >= 0) {
    const tot = Math.max(1, saldo);
    bar = `<span class="s-pagos" style="width:${comp / tot * 100}%"></span><span class="s-fondo" style="width:${res / tot * 100}%"></span><span class="s-libre" style="width:${disp / tot * 100}%"></span>`;
    legend = [['#E9B45E', money(comp), `Apartado para pagos de ${N} días`], ['#7FB3A3', money(res), 'Fondo de reserva'], ['#F4F1E8', money(disp), 'Libre para usar']];
  } else {
    const tot = Math.max(1, comp + res); const cp = Math.min(comp, Math.max(saldo, 0)), cf = Math.max(0, Math.min(res, saldo - comp));
    bar = `<span class="s-pagos" style="width:${cp / tot * 100}%"></span><span class="s-fondo" style="width:${cf / tot * 100}%"></span><span class="s-falta" style="width:${-disp / tot * 100}%"></span>`;
    legend = [['#E9B45E', money(comp), `Pagos de ${N} días`], ['#7FB3A3', money(res), 'Fondo de reserva'], ['#E07B66', money(-disp), 'Lo que falta para cubrir todo']];
  }
  const caja = `
  <section class="caja" data-tour="caja" aria-label="Tu dinero hoy">
    <div>
      <div class="k">${disp >= 0 ? 'Lo que puedes usar sin apretarte' : 'Te falta para cubrir lo que viene'}</div>
      <div class="big ${disp < 0 ? 'neg' : ''}">${money(Math.abs(disp))}</div>
      <p class="why">Tienes <b>${money(saldo)}</b> entre banco y caja. De eso, <b>${money(comp)}</b> ya están comprometidos para pagos de los próximos ${N} días y <b>${money(res)}</b> son tu fondo de reserva.</p>
      <div class="sobres"><div class="bar" role="img" aria-label="Reparto de tu saldo">${bar}</div>
        <div class="legend">${legend.map(([c, v, l]) => `<div style="border-color:${c}"><b>${v}</b>${l}</div>`).join('')}</div></div>
      <details class="explica"><summary>¿Cómo se calcula?</summary><ul>
        <li><b>Saldo:</b> lo que tenías al empezar, más tus ventas, menos lo que ya marcaste como pagado.</li>
        <li><b>Pagos de los próximos ${N} días:</b> compras a crédito, nómina (aunque no la hayas generado), gastos fijos, impuestos estimados y pagos vencidos.</li>
        <li><b>Fondo de reserva:</b> dinero tuyo para emergencias; no cuenta como disponible.</li>
      </ul></details>
    </div>
    <div class="semaforo s-${sem.k}" data-tour="semaforo">
      <div class="luz"><div class="poste" aria-hidden="true"><i class="r"></i><i class="a"></i><i class="v"></i></div><div><strong>${sem.label}</strong><span>Semáforo de liquidez</span></div></div>
      <p>${sem.text}</p>
      <div class="retiro"><span>Puedes retirar hoy para ti</span><b>${money(seg)}</b>${seg && isOwner() && !READONLY ? `<button data-a="retiro" data-v="${seg}">Registrar un retiro</button>` : `<p>${seg ? 'Sin poner en riesgo tus pagos de los próximos 30 días.' : 'Tus próximos 30 días no dejan margen para retirar sin tocar tu fondo.'}</p>`}</div>
    </div>
  </section>`;
  const alertHtml = al ? `
  <section class="alerta ${al.tipo === 'efectivo' ? 'bad' : ''}">
    <div class="ah"><span class="ico">${icon('alerta')}</span><div>
      <h3>${al.tipo === 'efectivo' ? `En ${al.dias} días te podrías quedar sin efectivo` : `En ${al.dias} días tendrías que tocar tu fondo de reserva`}</h3>
      <p class="muted mt">El ${fdl(al.fecha)} tu saldo bajaría a ${money(al.saldo)}${al.tipo === 'reserva' ? `, por debajo de tu fondo de ${money(res)}` : ''}. Lo que más pesa esos días:</p>
      <div class="causas">${al.causas.map(c => `<span>${h(c.concepto)}: <b>${money(c.monto)}</b>, ${fds(c.vence)}</span>`).join('')}</div>
    </div></div>
    ${sols.length ? `<div class="opciones"><h4>Qué podrías hacer</h4>${sols.map((s, i) => `<div class="opcion"><span>${h(s.texto)}</span><span class="tag ${s.res.ok ? 'ok' : ''}">${s.res.txt}</span><button class="btn sec sm" data-a="simPreset" data-i="${i}">Probarlo en el simulador</button></div>`).join('')}</div>` : ''}
  </section>` : '';
  // proyección
  const rng = ui.range || 30;
  const data = [{ bal: saldo, date: T }].concat(series.slice(0, rng));
  const mn = data.reduce((m, d) => d.bal < m.bal ? d : m, data[0]);
  const lect = mn.bal < 0 ? ['bad', `Tu punto más bajo sería el ${fdl(mn.date)}, con ${money(mn.bal)}. Ese día no alcanzaría para cubrir tus pagos.`]
    : mn.bal < res ? ['warn', `Tu punto más bajo sería el ${fdl(mn.date)}: ${money(mn.bal)}. Está por debajo de tu fondo de reserva de ${money(res)}.`]
      : ['', `Tu punto más bajo en los próximos ${rng} días sería el ${fdl(mn.date)}: ${money(mn.bal)}. Vas por encima de tu fondo de reserva.`];
  // mes
  const mk = pd(T).getDate() < 10 ? ds(new Date(pd(T).getFullYear(), pd(T).getMonth() - 1, 1)).slice(0, 7) : monthKey(T);
  const rep = reportData(mk);
  // datos
  const v7 = sum(S.sales.filter(s => s.fecha > addD(T, -8) && s.fecha < T), 'monto');
  const v7p = sum(S.sales.filter(s => s.fecha > addD(T, -15) && s.fecha <= addD(T, -8)), 'monto');
  const ch = v7p ? (v7 - v7p) / v7p * 100 : 0;
  const days14 = []; for (let i = 14; i >= 1; i--) { const d = addD(T, -i); days14.push(sum(S.sales.filter(s => s.fecha === d), 'monto')); }
  const mx14 = Math.max(1, ...days14);
  const mkc = monthKey(T); const by = {};
  S.closings.filter(c => monthKey(c.fecha) === mkc).forEach(c => by[c.productId] = (by[c.productId] || 0) + mermaCosto(c));
  const merma = sum(Object.values(by), x => x); const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  const topName = top ? (S.products.find(p => p.id === top[0]) || {}).nombre : '';
  const nextNom = (() => { for (let i = 0; i < 16; i++) { const x = addD(T, i); const e = S.employees.filter(e => e.activo && isPayday(x, e.periodicidad)); if (e.length) return { fecha: x, monto: sum(e, 'sueldo'), n: e.length }; } return null; })();
  const cerrado = diaCerrado(T);
  const cerrarHoy = isOwner() && !READONLY && S.sales.length && !cerrado ? `<section class="cierre-cta"><div>${icon('dia')}<span><b>¿Ya cerraste el día de hoy?</b> Anota cuánto vendiste y qué gastaste. Toma un minuto.</span></div><button class="btn" data-a="nav" data-v="dia">Cerrar el día</button></section>` : '';
  const detalle = `
  <div class="g57">
    <section class="panel"><div class="ph"><div><h2>Tu dinero en los próximos días</h2><p>Si vendes como en las últimas 8 semanas y pagas lo que ya tienes registrado.</p></div>
      <div class="seg" role="group" aria-label="Periodo">${[30, 60, 90].map(d => `<button data-a="range" data-v="${d}" aria-pressed="${rng === d}">${d} días</button>`).join('')}</div></div>
      ${lineChart(series, res, rng, saldo, mn)}
      <div class="legend"><span><i style="border-color:var(--bosque)"></i>Tu saldo</span><span><i style="border-color:var(--ocre);border-top-style:dashed"></i>Tu fondo de reserva</span></div>
      <p class="lectura ${lect[0]}">${lect[1]}</p>
    </section>
    <section class="panel"><div class="ph"><div><h2>¿A dónde se fue el dinero de ${MESES[pd(mk + '-01').getMonth()]}?</h2><p>De lo que vendiste, cuánto se fue en cada cosa. Solo cuenta lo que ya pagaste.</p></div></div>
      ${rep.ventas ? waterfall(rep) : empty('ticket', 'Todavía no hay ventas este mes', 'Cierra tus días para ver a dónde se va tu dinero.')}
    </section>
  </div>`;
  return `
  ${primerosPasos()}
  ${cerrarHoy}
  ${caja}
  ${alertHtml}
  <section class="panel" data-tour="viene"><div class="ph"><div><h2>Lo que viene</h2><p>Tus pagos de las próximas dos semanas.</p></div><button class="linkbtn" data-a="nav" data-v="pagos">Ver todos</button></div>
    ${timeline(upcoming, 5)}
  </section>
  <details class="mas-detalle" ${READONLY || ui.detalleOpen ? 'open' : ''} data-detalle><summary>${icon('reportes')}<span><b>Ver gráficas y más números</b><span>Proyección, a dónde se fue el dinero, ventas de la semana, merma y nómina</span></span></summary>
  ${detalle}
  <div class="grid3">
    <section class="panel dato"><div class="label">${icon('ventas')}Ventas de los últimos 7 días</div><div class="value">${money(v7)}</div><div class="note ${ch >= 0 ? 'up' : 'down'}">${v7p ? (ch >= 0 ? num(ch) + '% más' : num(-ch) + '% menos') + ' que la semana anterior' : 'Sin semana anterior para comparar'}</div>
      <div class="spark" aria-hidden="true">${days14.map((v, i) => `<i class="${i >= 7 ? 'on' : ''}" style="height:${Math.max(3, v / mx14 * 100)}%"></i>`).join('')}</div></section>
    <section class="panel dato"><div class="label">${icon('perecederos')}Merma de ${MESES[pd(T).getMonth()]}</div><div class="value">${money(merma)}</div><div class="note">${top ? `Lo que más tiras: <b>${h(topName)}</b>, ${money(top[1])}` : 'Se mide con la herramienta Perecederos'}</div></section>
    <section class="panel dato"><div class="label">${icon('nomina')}Próxima nómina</div><div class="value">${nextNom ? money(nextNom.monto) : '—'}</div><div class="note">${nextNom ? cap(fdl(nextNom.fecha)) + ', ' + nextNom.n + ' personas' : 'Se calcula con la herramienta Empleados y nómina'}</div></section>
  </div>
  </details>`;
}
/* ============ Gráficas ============ */
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const n = raw / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }
function moneyShort(v) { const a = Math.abs(v); const s = a >= 1000 ? num(a / 1000, a >= 10000 ? 0 : 1) + ' mil' : num(a, 0); return (v < 0 ? '−$' : '$') + s; }
function lineChart(series, reserve, days, start, mnPt) {
  const W = 640, H = 250, pl = 58, pr = 16, pt = 22, pb = 26;
  const data = [{ bal: start, date: today() }].concat(series.slice(0, days));
  const vals = data.map(d => d.bal).concat([reserve, 0]);
  let mn = Math.min(...vals), mx = Math.max(...vals); const padv = (mx - mn) * 0.08 || 1000; mn -= padv; mx += padv;
  const step = niceStep((mx - mn) / 4); mn = Math.floor(mn / step) * step; mx = Math.ceil(mx / step) * step;
  const x = i => pl + (W - pl - pr) * i / (data.length - 1), y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  let g = '';
  for (let v = mn; v <= mx + 1; v += step) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line-2)"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${moneyShort(v)}</text>`;
  if (mn < 0 && mx > 0) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--soft)"/>`;
  const every = days <= 30 ? 7 : days <= 60 ? 14 : 21;
  for (let i = 0; i < data.length; i += every) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${i === 0 ? 'Hoy' : fds(data[i].date)}</text>`;
  const pts = data.map((d, i) => x(i).toFixed(1) + ',' + y(d.bal).toFixed(1));
  g += `<polygon points="${x(0)},${y(Math.max(mn, 0))} ${pts.join(' ')} ${x(data.length - 1)},${y(Math.max(mn, 0))}" fill="var(--menta)" opacity=".55"/>`;
  g += `<line x1="${pl}" x2="${W - pr}" y1="${y(reserve)}" y2="${y(reserve)}" stroke="var(--ocre)" stroke-width="1.6" stroke-dasharray="6 4"/>`;
  g += `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--bosque)" stroke-width="2.4" stroke-linejoin="round"/>`;
  if (mnPt) { const i = data.findIndex(d => d.date === mnPt.date); if (i >= 0) { const cx = x(i), cy = y(mnPt.bal); const anchor = cx > W - 140 ? 'end' : cx < 140 ? 'start' : 'middle'; g += `<circle cx="${cx}" cy="${cy}" r="5.5" fill="var(--paper)" stroke="${mnPt.bal < reserve ? 'var(--arcilla)' : 'var(--bosque)'}" stroke-width="2.5"/><text class="lbl" x="${cx}" y="${cy + 22 > H - pb ? cy - 12 : cy + 22}" text-anchor="${anchor}">Punto más bajo: ${moneyShort(mnPt.bal)}</text>`; } }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo proyectado a ${days} días">${g}</svg>`;
}
function barChart(rows, hi) {
  if (hi == null) hi = rows.length - 1;
  const W = 640, H = 210, pl = 58, pr = 10, pt = 22, pb = 26; const mx0 = Math.max(1, ...rows.map(r => r.v)); const step = niceStep(mx0 / 4); const mx = Math.ceil(mx0 / step) * step;
  const bw = (W - pl - pr) / rows.length; const y = v => pt + (H - pt - pb) * (1 - v / mx);
  let g = '';
  for (let v = 0; v <= mx; v += step) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line-2)"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${moneyShort(v)}</text>`;
  rows.forEach((r, i) => { const bx = pl + i * bw + bw * 0.18; g += `<rect x="${bx}" y="${y(r.v)}" width="${bw * 0.64}" height="${Math.max(0, y(0) - y(r.v))}" rx="3" fill="${i === hi ? 'var(--bosque)' : 'var(--off)'}"><title>${r.l}: ${money(r.v)}</title></rect><text x="${bx + bw * 0.32}" y="${H - 6}" text-anchor="middle">${r.l}</text>${i === hi ? `<text class="lbl" x="${bx + bw * 0.32}" y="${y(r.v) - 7}" text-anchor="middle">${moneyShort(r.v)}</text>` : ''}`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
function waterfall(r) {
  let cats = Object.entries(r.byCat).filter(([c, v]) => v > 0 && c !== 'Retiro del dueño').sort((a, b) => b[1] - a[1]);
  if (cats.length > 6) { const rest = cats.slice(5); cats = cats.slice(0, 5).concat([['Otros', sum(rest, x => x[1])]]); }
  const steps = [{ l: 'Ventas', v: r.ventas, t: 'in' }].concat(cats.map(([c, v]) => ({ l: c, v: -v, t: 'out' })));
  const res = r.ventas - r.egresosOp; steps.push({ l: 'Te quedó', v: res, t: 'tot' });
  if (r.retiro) { steps.push({ l: 'Tus retiros', v: -r.retiro, t: 'out2' }); steps.push({ l: 'Después de retiros', v: res - r.retiro, t: 'tot' }); }
  const W = 680, H = 270, pl = 8, pr = 8, pt = 26, pb = 46; const n = steps.length; const bw = (W - pl - pr) / n;
  let run = 0, top = r.ventas, bot = Math.min(0, res - r.retiro); const geo = [];
  steps.forEach(s => { if (s.t === 'in') { geo.push([0, s.v]); run = s.v; } else if (s.t === 'tot') { geo.push([0, s.v]); run = s.v; } else { geo.push([run + s.v, run]); run += s.v; } });
  const y = v => pt + (H - pt - pb) * (1 - (v - bot) / (top - bot || 1));
  let g = `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>`;
  steps.forEach((s, i) => {
    const [a, b] = geo[i]; const x0 = pl + i * bw + bw * 0.14, w = bw * 0.72; const y1 = y(Math.max(a, b)), y2 = y(Math.min(a, b));
    const fill = s.t === 'in' ? 'var(--bosque)' : s.t === 'tot' ? (s.v >= 0 ? 'var(--bosque-2)' : 'var(--arcilla)') : s.t === 'out2' ? 'var(--off)' : 'var(--ocre)';
    g += `<rect x="${x0}" y="${y1}" width="${w}" height="${Math.max(2, y2 - y1)}" rx="3" fill="${fill}" ${s.t === 'tot' ? '' : 'opacity=".92"'}/>`;
    if (i < n - 1 && s.t !== 'tot') g += `<line x1="${x0 + w}" x2="${x0 + bw}" y1="${y(geo[i][s.t === 'in' ? 1 : 0])}" y2="${y(geo[i][s.t === 'in' ? 1 : 0])}" stroke="var(--soft)" stroke-dasharray="2 3"/>`;
    g += `<text class="lbl" x="${x0 + w / 2}" y="${y1 - 7}" text-anchor="middle">${s.v < 0 ? '−' : ''}${moneyShort(Math.abs(s.v))}</text>`;
    const words = s.l.split(' '); const l1 = words.slice(0, 2).join(' '), l2 = words.slice(2).join(' ');
    g += `<text x="${x0 + w / 2}" y="${H - pb + 18}" text-anchor="middle">${h(l1)}</text>${l2 ? `<text x="${x0 + w / 2}" y="${H - pb + 32}" text-anchor="middle">${h(l2)}</text>` : ''}`;
  });
  const big = cats[0]; const pctRes = r.ventas ? res / r.ventas * 100 : 0;
  return `<div class="tablewrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cascada de ventas a resultado" style="min-width:560px">${g}</svg></div>
  <p class="lectura ${res < 0 ? 'bad' : pctRes < 8 ? 'warn' : ''}">De cada $100 que vendiste, ${big ? `$${num(big[1] / r.ventas * 100, 0)} se fueron en ${big[0].toLowerCase()} y ` : ''}te quedaron $${num(Math.max(pctRes, 0), 0)} antes de tus retiros.${r.retiro && res - r.retiro < 0 ? ' Con tus retiros, sacaste más de lo que dejó el negocio este mes.' : ''}</p>`;
}

/* ============ Ventas y caja ============ */
function vVentas() {
  const vt = ui.vTab || 'registro';
  const tabsV = `<div class="tabs" role="tablist">${[['registro', 'Ventas'], ['corte', 'Corte de caja']].map(([k, l]) => `<button class="tab" role="tab" aria-selected="${vt === k}" data-a="vtab" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (vt === 'corte') return tabsV + vCorte();
  const T = today();
  const byDay = {}; S.sales.forEach(s => { const d = byDay[s.fecha] || (byDay[s.fecha] = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, total: 0 }); d[s.metodo] = (d[s.metodo] || 0) + s.monto; d.total += s.monto; });
  const hoy = byDay[T] ? byDay[T].total : 0;
  const v7 = sum(S.sales.filter(s => s.fecha > addD(T, -7)), 'monto');
  const mes = sum(S.sales.filter(s => monthKey(s.fecha) === monthKey(T)), 'monto');
  const weeks = []; for (let k = 7; k >= 0; k--) { const end = addD(T, -7 * k), st = addD(end, -6); weeks.push({ l: k === 0 ? 'Esta' : fds(st), v: sum(S.sales.filter(s => s.fecha >= st && s.fecha <= end), 'monto') }); }
  const days = Object.keys(byDay).sort().reverse().slice(0, 14);
  const recent = S.sales.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || 0).slice(0, 12);
  const mix = byDay[T] || { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
  return tabsV + `
  <div class="g57">
    <section class="panel">
      <div class="ph"><div><h2>Registrar venta</h2><p>Anota lo que entró, separado por forma de pago. Puedes registrar varias veces al día.</p></div></div>
      <form class="fields" data-f="sale">
        <label class="wide">Monto<input id="saleMonto" class="money-in" name="monto" type="number" min="1" step="1" placeholder="$0" required inputmode="numeric"></label>
        <label>Forma de pago<select name="metodo">${METODOS.map(m => `<option>${m}</option>`).join('')}</select></label>
        <label>Fecha<input name="fecha" type="date" value="${T}" max="${T}" required></label>
        <label class="wide">Nota (opcional)<input name="nota" placeholder="Ej. evento privado"></label>
        <div class="form-actions wide"><button class="btn" type="submit">Registrar venta</button>${!isStaff() ? '<button class="btn sec" type="button" data-a="importCsv">Importar del punto de venta</button>' : ''}</div>
      </form>
    </section>
    <section class="panel dato"><div class="label">Hoy llevas</div><div class="value">${money(hoy)}</div>
      ${hoy ? `<div class="mt">${METODOS.map(m => `<div class="row" style="justify-content:space-between;padding:4px 0;border-top:1px solid var(--line-2)"><span class="muted">${m}</span><b>${money(mix[m])}</b></div>`).join('')}</div>` : `<p class="note">Aún no registras la venta de hoy.</p>`}
      <div class="grid2 mt2" style="gap:12px"><div><div class="note">Últimos 7 días</div><b class="serif" style="font-size:1.3rem">${money(v7)}</b></div><div><div class="note">${cap(MESES[pd(T).getMonth()])}</div><b class="serif" style="font-size:1.3rem">${money(mes)}</b></div></div>
    </section>
  </div>
  <section class="panel"><div class="ph"><div><h2>Ventas por semana</h2><p>Las últimas 8 semanas. La barra verde es la semana actual.</p></div></div>${barChart(weeks)}</section>
  <div class="grid2">
    <section class="panel"><div class="ph"><h2>Por día</h2></div>
      ${days.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Día</th><th class="num">Efectivo</th><th class="num">Tarjeta</th><th class="num">Transferencia</th><th class="num">Total</th></tr></thead><tbody>
      ${days.map(d => `<tr><td>${cap(DIAS[pd(d).getDay()]).slice(0, 3)} ${fds(d)}</td><td class="num">${money(byDay[d].Efectivo)}</td><td class="num">${money(byDay[d].Tarjeta)}</td><td class="num">${money(byDay[d].Transferencia)}</td><td class="num"><b>${money(byDay[d].total)}</b></td></tr>`).join('')}
      </tbody></table></div>` : empty('ticket', 'Todavía no hay ventas', 'Registra tu primera venta o importa el archivo de tu punto de venta.')}
    </section>
    <section class="panel"><div class="ph"><h2>Últimos registros</h2></div>
      ${recent.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Fecha</th><th>Forma de pago</th><th class="num">Monto</th><th></th></tr></thead><tbody>
      ${recent.map(s => `<tr><td>${fd(s.fecha)}${s.nota ? `<br><span class="hint">${h(s.nota)}</span>` : ''}</td><td>${s.metodo}</td><td class="num">${money(s.monto)}</td><td class="right"><div class="acts"><button class="btn danger sm" data-a="delSale" data-id="${s.id}">Eliminar</button></div></td></tr>`).join('')}
      </tbody></table></div>` : empty('ticket', 'Sin registros', '')}
    </section>
  </div>`;
}
function corteTicket(fondo, ventas, gastos, contado, fecha) {
  const esp = Number(fondo || 0) + Number(ventas || 0) - Number(gastos || 0);
  const has = !(contado === '' || contado == null); const d = has ? Number(contado) - esp : 0;
  const res = !has ? '' : Math.abs(d) < 1 ? '<div class="res ok">LA CAJA CUADRA</div>' : d > 0 ? `<div class="res warn">SOBRAN ${money(d)}</div>` : `<div class="res bad">FALTAN ${money(-d)}</div>`;
  return `<div class="ticket" aria-live="polite"><h4>${h(S.restaurant.nombre)}</h4><div class="c">Corte de caja, ${fd(fecha)}</div><hr>
    <div class="l"><span>Fondo al abrir</span><span>${money(fondo)}</span></div>
    <div class="l"><span>+ Ventas en efectivo</span><span>${money(ventas)}</span></div>
    <div class="l"><span>− Gastos con efectivo</span><span>${money(gastos)}</span></div><hr>
    <div class="l tot"><span>Debería haber</span><span>${money(esp)}</span></div>
    <div class="l"><span>Contaste</span><span>${has ? money(contado) : '—'}</span></div>${res}</div>`;
}
function vCorte() {
  const T = today(); const f = ui.corteDate || T;
  const ex = S.cortes.find(c => c.fecha === f);
  const ventasEf = sum(S.sales.filter(s => s.fecha === f && s.metodo === 'Efectivo'), 'monto');
  const fondo = ex ? ex.fondo : S.config.fondoCaja; const gastos = ex ? ex.gastosEf : 0; const contado = ex ? ex.contado : '';
  const vEf = ex ? ex.ventasEf : ventasEf;
  const mes = S.cortes.filter(c => monthKey(c.fecha) === monthKey(T));
  const dif = c => c.contado - (c.fondo + c.ventasEf - c.gastosEf);
  const falt = sum(mes.filter(c => dif(c) < 0), c => -dif(c));
  const tagDif = d => Math.abs(d) < 1 ? '<span class="tag ok">Cuadra</span>' : d > 0 ? `<span class="tag warn">Sobran ${money(d)}</span>` : `<span class="tag bad">Faltan ${money(-d)}</span>`;
  return `
  <div class="g75">
    <section class="panel">
      <div class="ph"><div><h2>Corte de caja</h2><p>Al cerrar, cuenta el efectivo y compáralo con lo que debería haber. El ticket se llena solo mientras escribes.</p></div>
        <label style="flex-direction:row;align-items:center;gap:8px">Día<input type="date" value="${f}" max="${T}" data-a-change="corteDate" style="width:auto"></label></div>
      <form class="fields" data-f="corte" data-calc="corte">
        <input type="hidden" name="fecha" value="${f}">
        <label>Fondo de caja al abrir<input name="fondo" type="number" min="0" value="${fondo}" inputmode="numeric"></label>
        <label>Ventas en efectivo<input name="ventasEf" type="number" min="0" value="${vEf}" inputmode="numeric"></label>
        <label>Gastos pagados con efectivo<input name="gastosEf" type="number" min="0" value="${gastos}" inputmode="numeric"></label>
        <label>Efectivo contado al cerrar<input name="contado" type="number" min="0" value="${contado}" required inputmode="numeric"></label>
        <label class="wide">Nota (opcional)<input name="nota" value="${h(ex ? ex.nota : '')}" placeholder="Ej. se pagó el gas con efectivo"></label>
        <div class="form-actions"><button class="btn" type="submit">${ex ? 'Actualizar corte' : 'Guardar corte'}</button></div>
      </form>
      ${!ventasEf && !ex ? '<p class="hint mt">No hay ventas en efectivo registradas para este día. Regístralas primero o escribe el monto a mano.</p>' : ''}
    </section>
    <div><div data-corte-res>${corteTicket(fondo, vEf, gastos, contado, f)}</div>
      <section class="panel dato"><div class="label">Faltantes este mes</div><div class="value ${falt ? 'down' : ''}">${money(falt)}</div><div class="note">En ${mes.length} cortes. Un faltante chico y frecuente suele ser cambio mal dado; si se repite el mismo día, revísalo con quien cobra ese turno.</div></section></div>
  </div>
  <section class="panel"><div class="ph"><h2>Cortes anteriores</h2></div>
    ${S.cortes.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Día</th><th class="num">Debería haber</th><th class="num">Contado</th><th>Resultado</th><th>Nota</th></tr></thead><tbody>
    ${S.cortes.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 20).map(c => `<tr><td>${cap(DIAS[pd(c.fecha).getDay()]).slice(0, 3)} ${fds(c.fecha)}</td><td class="num">${money(c.fondo + c.ventasEf - c.gastosEf)}</td><td class="num">${money(c.contado)}</td><td>${tagDif(dif(c))}</td><td class="muted">${h(c.nota || '')}</td></tr>`).join('')}
    </tbody></table></div>` : empty('ticket', 'Todavía no haces cortes de caja', 'Haz el primero hoy al cerrar.')}</section>`;
}

/* ============ Perecederos ============ */
function vPerecederos() {
  const tab = ui.pTab; const T = today();
  const tabs = [['compras', 'Compras'], ['sugerida', 'Qué comprar'], ['cierre', 'Cierre del día'], ['merma', 'Merma'], ['catalogo', 'Productos y proveedores']];
  let body = '';
  const pName = id => (S.products.find(p => p.id === id) || {}).nombre || 'Producto eliminado';
  const pUnit = id => (S.products.find(p => p.id === id) || {}).unidad || '';
  const sName = id => (S.suppliers.find(p => p.id === id) || {}).nombre || '—';
  if (tab === 'sugerida') body = vSugerida();
  else if (tab === 'compras') {
    const rec = S.purchases.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 25);
    body = !S.products.length || !S.suppliers.length ? `<section class="panel">${empty('canasta', 'Primero agrega tus productos y proveedores', 'Con eso puedes registrar tus compras en segundos.', '<button class="btn sm mt" data-a="ptab" data-v="catalogo">Agregar productos y proveedores</button>')}</section>` : `
    <section class="panel">
      <div class="ph"><div><h2>Registrar compra</h2><p>Si la compraste a crédito, se agrega sola a tus pagos pendientes.</p></div></div>
      <form class="fields" data-f="purchase">
        <label>Producto<select name="productId">${S.products.map(p => `<option value="${p.id}">${h(p.nombre)} (${h(p.unidad)})</option>`).join('')}</select></label>
        <label>Cantidad<input name="cantidad" type="number" min="0.1" step="0.1" required inputmode="decimal"></label>
        <label>Costo total<input name="costo" type="number" min="1" step="1" required inputmode="numeric"></label>
        <label>Proveedor<select name="supplierId">${S.suppliers.map(s => `<option value="${s.id}">${h(s.nombre)}</option>`).join('')}</select></label>
        <label>Forma de pago<select name="pago"><option value="contado">Pagada en el momento</option><option value="credito">A crédito</option></select></label>
        <label>Si es a crédito, se paga el<input name="vence" type="date" value="${addD(T, 7)}"></label>
        <label>Fecha de compra<input name="fecha" type="date" value="${T}" max="${T}" required></label>
        <div class="form-actions"><button class="btn" type="submit">Registrar compra</button></div>
      </form>
    </section>
    <section class="panel"><div class="ph"><div><h2>Compras recientes</h2><p>Esta semana llevas ${money(sum(S.purchases.filter(p => p.fecha > addD(T, -7)), 'costo'))} en compras.</p></div></div>
      ${rec.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Producto</th><th>Fecha</th><th class="num">Cantidad</th><th>Proveedor</th><th class="num">Costo</th><th>Pago</th><th></th></tr></thead><tbody>
      ${rec.map(p => { const pay = S.payables.find(x => x.key === 'comp:' + p.id); const st = !pay ? '' : pay.estado === 'pagado' ? '<span class="tag ok">Pagada</span>' : `<span class="tag ${pay.vence < T ? 'bad' : 'warn'}">Se paga ${fds(pay.vence)}</span>`; return `<tr><td>${h(pName(p.productId))}</td><td>${fd(p.fecha)}</td><td class="num">${num(p.cantidad)} ${h(pUnit(p.productId))}</td><td>${h(sName(p.supplierId))}</td><td class="num">${money(p.costo)}</td><td>${st}</td><td class="right"><div class="acts"><button class="btn danger sm" data-a="delPurchase" data-id="${p.id}">Eliminar</button></div></td></tr>`; }).join('')}
      </tbody></table></div>` : empty('canasta', 'Sin compras registradas', '')}</section>`;
  } else if (tab === 'cierre') {
    const d = ui.closeDate || T; const ex = S.closings.filter(c => c.fecha === d);
    body = `
    <section class="panel">
      <div class="ph"><div><h2>Cierre del día</h2><p>Al terminar, anota cuánto te sobró y cuánto se tiró de cada producto. Así sabes cuánto dinero se va en merma y cuánto comprar mañana.</p></div>
        <label style="flex-direction:row;align-items:center;gap:8px">Día<input type="date" value="${d}" max="${T}" data-a-change="closeDate" style="width:auto"></label></div>
      ${S.products.length ? `<form data-f="closing"><input type="hidden" name="fecha" value="${d}">
      <div class="tablewrap"><table class="t"><thead><tr><th>Producto</th><th>Unidad</th><th>Sobró</th><th>Se tiró</th></tr></thead><tbody>
      ${S.products.map(p => { const c = ex.find(x => x.productId === p.id) || {}; return `<tr><td>${h(p.nombre)}</td><td class="muted">${h(p.unidad)}</td><td><input name="s_${p.id}" type="number" min="0" step="0.1" value="${c.sobrante ?? ''}" aria-label="Sobró de ${h(p.nombre)}" inputmode="decimal"></td><td><input name="m_${p.id}" type="number" min="0" step="0.1" value="${c.merma ?? ''}" aria-label="Se tiró de ${h(p.nombre)}" inputmode="decimal"></td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="row mt"><button class="btn" type="submit">Guardar cierre</button>${ex.length ? '<span class="tag ok">Este día ya tiene cierre; al guardar lo actualizas</span>' : ''}</div>
      </form>` : empty('canasta', 'Agrega tus productos primero', '', '<button class="btn sm mt" data-a="ptab" data-v="catalogo">Agregar productos</button>')}
    </section>`;
  } else if (tab === 'merma') {
    const mk = monthKey(T); const cl = S.closings.filter(c => monthKey(c.fecha) === mk);
    const by = {}; cl.forEach(c => { const o = by[c.productId] || (by[c.productId] = { q: 0, c: 0 }); o.q += c.merma; o.c += mermaCosto(c); });
    const rows = Object.entries(by).filter(([, o]) => o.q > 0).sort((a, b) => b[1].c - a[1].c);
    const tot = sum(rows, r => r[1].c); const compras = sum(S.purchases.filter(p => monthKey(p.fecha) === mk), 'costo');
    const weeks = []; for (let k = 5; k >= 0; k--) { const end = addD(T, -7 * k), st = addD(end, -6); weeks.push({ l: k === 0 ? 'Esta' : fds(st), v: sum(S.closings.filter(c => c.fecha >= st && c.fecha <= end), mermaCosto) }); }
    const mxr = Math.max(1, ...rows.map(r => r[1].c));
    body = `
    <div class="grid3">
      <section class="panel dato"><div class="label">Merma de ${MESES[pd(T).getMonth()]}</div><div class="value">${money(tot)}</div><div class="note">En producto que se tiró</div></section>
      <section class="panel dato"><div class="label">De lo que compraste</div><div class="value">${compras ? num(tot / compras * 100) + '%' : '—'}</div><div class="note">Una referencia sana es menos de 5%</div></section>
      <section class="panel dato"><div class="label">Lo que más tiras</div><div class="value" style="font-size:1.35rem">${rows[0] ? h(pName(rows[0][0])) : '—'}</div><div class="note">${rows[0] ? money(rows[0][1].c) + ' este mes' : 'Haz tu cierre del día'}</div></section>
    </div>
    <div class="grid2">
      <section class="panel"><div class="ph"><h2>Por producto</h2></div>
        ${rows.length ? `<table class="t" data-nocards><tbody>${rows.map(([id, o]) => `<tr><td style="width:38%">${h(pName(id))}<br><span class="hint">${num(o.q)} ${h(pUnit(id))}</span></td><td><div class="progress" style="height:10px"><span style="width:${o.c / mxr * 100}%;background:var(--ocre)"></span></div></td><td class="num"><b>${money(o.c)}</b></td></tr>`).join('')}</tbody></table>` : empty('canasta', 'Sin merma registrada este mes', 'Usa el cierre del día para empezar a medirla.')}
      </section>
      <section class="panel"><div class="ph"><h2>Por semana</h2></div>${barChart(weeks)}<p class="lectura">Si compras más seguido y en menos cantidad lo que más se echa a perder, esta barra debería bajar.</p></section>
    </div>`;
  } else {
    body = `
    <div class="grid2">
      <section class="panel"><div class="ph"><h2>Productos</h2></div>
        ${S.products.length ? `<table class="t"><thead><tr><th>Producto</th><th>Unidad</th><th class="num">Último precio</th><th></th></tr></thead><tbody>
        ${S.products.map(p => { const last = S.purchases.filter(x => x.productId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]; return `<tr><td>${h(p.nombre)}</td><td>${h(p.unidad)}</td><td class="num">${last ? money(last.costo / last.cantidad) + ' / ' + h(p.unidad) : '—'}</td><td class="right"><div class="acts"><button class="btn danger sm" data-a="delProduct" data-id="${p.id}">Eliminar</button></div></td></tr>`; }).join('')}
        </tbody></table>` : empty('canasta', 'Agrega lo que compras seguido', 'Tortilla, carne, verdura, refrescos…')}
        <form class="fields mt" data-f="product">
          <label>Nuevo producto<input name="nombre" placeholder="Ej. Jitomate" required></label>
          <label>Unidad<select name="unidad"><option>kg</option><option>pieza</option><option>caja</option><option>litro</option><option>manojo</option><option>paquete</option></select></label>
          <div class="form-actions"><button class="btn sec" type="submit">Agregar producto</button></div>
        </form>
      </section>
      <section class="panel"><div class="ph"><h2>Proveedores</h2></div>
        ${S.suppliers.length ? `<table class="t"><thead><tr><th>Proveedor</th><th>WhatsApp</th><th>Crédito</th><th></th></tr></thead><tbody>
        ${S.suppliers.map(s => `<tr><td>${h(s.nombre)}</td><td>${h(s.telefono || '—')}</td><td>${s.credito ? s.credito + ' días' : 'De contado'}</td><td class="right"><div class="acts"><button class="btn danger sm" data-a="delSupplier" data-id="${s.id}">Eliminar</button></div></td></tr>`).join('')}
        </tbody></table>` : empty('canasta', 'Agrega a tus proveedores', 'Con su WhatsApp te armamos el pedido listo para enviar.')}
        <form class="fields mt" data-f="supplier">
          <label>Nuevo proveedor<input name="nombre" required></label>
          <label>WhatsApp<input name="telefono" type="tel" placeholder="33 1234 5678"></label>
          <label>Días de crédito<input name="credito" type="number" min="0" value="0"></label>
          <div class="form-actions"><button class="btn sec" type="submit">Agregar proveedor</button></div>
        </form>
      </section>
    </div>`;
  }
  return `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-a="ptab" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
}
function consumo() {
  const T = today(), from = addD(T, -28);
  const v4 = sum(S.sales.filter(s => s.fecha >= from && s.fecha < T), 'monto') / 4;
  const prox = sum(proyeccion(7), 'ing'); const factor = v4 ? prox / v4 : 1;
  return S.products.map(pr => {
    const comp = S.purchases.filter(x => x.productId === pr.id && x.fecha >= from && x.fecha < T);
    const q = sum(comp, 'cantidad'), c = sum(comp, 'costo');
    const merma = sum(S.closings.filter(x => x.productId === pr.id && x.fecha >= from && x.fecha < T), 'merma'); const unit = q ? c / q : (pr.precioRef || 0);
    const usoSem = Math.max(0, (q - merma) / 4); const mermaPct = q ? merma / q * 100 : 0;
    const sug = usoSem * factor; const buyCount = new Set(comp.map(x => pd(x.fecha).getDay())).size || 1;
    const supO = comp.length ? (S.suppliers.find(s => s.id === comp[comp.length - 1].supplierId) || {}) : {};
    return { pr, q, usoSem, mermaPct, sug, costo: sug * unit, unit, mermaSem: merma / 4 * unit, buyCount, sup: supO.nombre || '', tel: supO.telefono || '' };
  }).filter(x => x.q > 0);
}
function pedidoTxt(sup, rs) { return `Hola, buen día. Para esta semana le encargo:\n${rs.map(r => '- ' + r.pr.nombre + ': ' + num(r.sug, r.pr.unidad === 'kg' ? 1 : 0) + ' ' + r.pr.unidad).join('\n')}\nGracias. ${S.restaurant.nombre}`; }
function waLink(tel, txt) { const d = String(tel || '').replace(/\D/g, ''); const n = d.length === 10 ? '52' + d : d; return 'https://wa.me/' + n + '?text=' + encodeURIComponent(txt); }
function vSugerida() {
  const rows = consumo(); const tot = sum(rows, 'costo');
  const ahorro = sum(rows.filter(r => r.mermaPct > 5), r => r.mermaSem * 0.5) * 4.3;
  const fx = (n, u) => num(n, u === 'kg' ? 1 : 0) + ' ' + u;
  if (!rows.length) return `<section class="panel">${empty('canasta', 'Necesitamos unas semanas de compras', 'Registra tus compras y tus cierres del día; con eso calculamos cuánto comprar.')}</section>`;
  const by = {}; rows.forEach(r => { const k = r.sup || 'Sin proveedor'; (by[k] = by[k] || { tel: r.tel, rs: [] }).rs.push(r); });
  ui.pedidos = by;
  return `
  <section class="panel"><div class="ph"><div><h2>Qué comprar los próximos 7 días</h2><p>Lo calculamos con lo que de verdad usaste en 4 semanas (lo que compraste menos lo que se tiró) y las ventas que esperas.</p></div><div class="dato right"><div class="note">Total estimado</div><b class="serif" style="font-size:1.4rem">${money(tot)}</b></div></div>
    <div class="tablewrap"><table class="t"><thead><tr><th>Producto</th><th class="num">Usas por semana</th><th class="num">Se tira</th><th class="num">Comprar</th><th class="num">Costo</th><th>Consejo</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${h(r.pr.nombre)}</td><td class="num">${fx(r.usoSem, r.pr.unidad)}</td><td class="num"><span class="tag ${r.mermaPct > 8 ? 'bad' : r.mermaPct > 4 ? 'warn' : 'ok'}">${num(r.mermaPct)}%</span></td><td class="num"><b>${fx(r.sug, r.pr.unidad)}</b></td><td class="num">${money(r.costo)}</td><td class="small">${r.mermaPct > 8 ? 'Compra menos cantidad, ' + (r.buyCount < 3 ? 'tres veces por semana.' : 'y revisa cómo se guarda.') : r.mermaPct > 4 ? 'Ajústate a lo sugerido.' : 'Vas bien.'}</td></tr>`).join('')}
    </tbody></table></div>
    ${ahorro > 0 ? `<p class="lectura warn">Si bajas a la mitad la merma de lo marcado en amarillo y rojo, ahorrarías cerca de <b>${money(ahorro)} al mes</b>.</p>` : ''}
  </section>
  <section><div class="ph"><div><h2>Tus pedidos, listos para mandar</h2><p>Uno por proveedor. Mándalo por WhatsApp o cópialo.</p></div></div>
    <div class="comandas">${Object.entries(by).map(([s, o], i) => `<div><div class="ticket"><h4>Pedido</h4><div class="c">${h(s)}</div><hr>${o.rs.map(r => `<div class="l"><span>${h(r.pr.nombre)}</span><span>${fx(r.sug, r.pr.unidad)}</span></div>`).join('')}<hr><div class="l tot"><span>Aprox.</span><span>${money(sum(o.rs, 'costo'))}</span></div></div>
      <div class="acts">${o.tel ? `<a class="btn sm" href="${waLink(o.tel, pedidoTxt(s, o.rs))}" target="_blank" rel="noopener">${icon('whats')}Enviar por WhatsApp</a>` : ''}<button class="btn sec sm" data-a="copyPedido" data-v="${h(s)}">${icon('copiar')}Copiar</button></div></div>`).join('')}</div>
  </section>`;
}

/* ============ Empleados y nómina ============ */
function nextSaturday() { let d = today(); while (pd(d).getDay() !== 6) d = addD(d, 1); return d; }
function vNomina() {
  const tab = ui.eTab; const T = today();
  const tabs = [['equipo', 'Tu equipo'], ['nomina', 'Nómina']];
  let body = '';
  if (tab === 'equipo') {
    const act = S.employees.filter(e => e.activo);
    body = `
    <section class="panel"><div class="ph"><div><h2>Tu equipo</h2><p>${act.length} personas activas. Tu nómina semanal es de aproximadamente ${money(sum(act, e => e.periodicidad === 'semanal' ? e.sueldo : e.sueldo * 7 / 15))}.</p></div></div>
      ${S.employees.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Nombre</th><th>Puesto</th><th class="num">Sueldo</th><th>Se le paga</th><th>Desde</th><th>Estado</th><th></th></tr></thead><tbody>
      ${S.employees.map(e => `<tr><td>${h(e.nombre)}</td><td>${h(e.puesto)}</td><td class="num">${money(e.sueldo)}</td><td>${cap(e.periodicidad)}</td><td>${fd(e.ingreso)}</td><td>${e.activo ? '<span class="tag ok">Activo</span>' : '<span class="tag">Baja</span>'}</td><td class="right"><div class="acts"><button class="btn sec sm" data-a="editEmp" data-id="${e.id}">Editar</button><button class="btn sec sm" data-a="toggleEmp" data-id="${e.id}">${e.activo ? 'Dar de baja' : 'Reactivar'}</button></div></td></tr>`).join('')}
      </tbody></table></div>` : empty('equipo', 'Aún no registras a tu equipo', 'Agrégalos abajo y la app calcula tu nómina y te avisa antes de cada pago.')}
    </section>
    <section class="panel"><div class="ph"><h2>Agregar a alguien</h2></div>
      <form class="fields" data-f="employee">
        <label>Nombre completo<input name="nombre" required></label>
        <label>Puesto<input name="puesto" placeholder="Ej. Cocinero" required></label>
        <label>Sueldo por periodo<input name="sueldo" type="number" min="1" required inputmode="numeric"></label>
        <label>Se le paga<select name="periodicidad"><option value="semanal">Cada semana (sábado)</option><option value="quincenal">Cada quincena (15 y fin de mes)</option></select></label>
        <label>Fecha de ingreso<input name="ingreso" type="date" value="${T}" required></label>
        <div class="form-actions"><button class="btn" type="submit">Agregar</button></div>
      </form>
    </section>`;
  } else {
    const list = S.payrolls.slice().sort((a, b) => b.fechaPago.localeCompare(a.fechaPago));
    const tipo = ui.genTipo || 'semanal';
    const emps = S.employees.filter(e => e.activo && e.periodicidad === tipo);
    const fecha = ui.genFecha || (tipo === 'semanal' ? nextSaturday() : (() => { const d = pd(T); return d.getDate() <= 15 ? ds(new Date(d.getFullYear(), d.getMonth(), 15)) : ds(new Date(d.getFullYear(), d.getMonth(), lastDay(d.getFullYear(), d.getMonth()))); })());
    const baseDias = tipo === 'semanal' ? 6 : 15;
    body = `
    <section class="panel">
      <div class="ph"><div><h2>Generar nómina</h2><p>Revisa días trabajados, bonos y descuentos. El total se calcula mientras escribes y, al guardar, se agrega a tus pagos.</p></div></div>
      <form data-f="payroll" data-calc="pay">
        <div class="fields" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
          <label>Tipo<select name="tipo" data-a-change="genTipo"><option value="semanal" ${tipo === 'semanal' ? 'selected' : ''}>Semanal</option><option value="quincenal" ${tipo === 'quincenal' ? 'selected' : ''}>Quincenal</option></select></label>
          <label>Fecha de pago<input name="fecha" type="date" value="${fecha}" required></label>
        </div>
        ${emps.length ? `<div class="tablewrap mt"><table class="t"><thead><tr><th>Persona</th><th class="num">Sueldo</th><th>Días (de ${baseDias})</th><th>Bonos</th><th>Descuentos</th><th class="num">A pagar</th></tr></thead><tbody>
        ${emps.map(e => `<tr data-row="${e.id}" data-sueldo="${e.sueldo}" data-base="${baseDias}"><td>${h(e.nombre)}<br><span class="hint">${h(e.puesto)}</span></td><td class="num">${money(e.sueldo)}</td><td><input name="d_${e.id}" type="number" min="0" max="${baseDias}" step="0.5" value="${baseDias}" inputmode="decimal"></td><td><input name="b_${e.id}" type="number" min="0" step="1" value="0" inputmode="numeric"></td><td><input name="x_${e.id}" type="number" min="0" step="1" value="0" inputmode="numeric"></td><td class="num" data-neto>${money(e.sueldo)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="5">Total a pagar</td><td class="num" data-total>${money(sum(emps, 'sueldo'))}</td></tr></tfoot></table></div>
        <p class="aviso mt" data-cuotas>Cuotas patronales e impuestos estimados (${S.config.cuotasPct}%): ${money(sum(emps, 'sueldo') * S.config.cuotasPct / 100)}. Es una estimación y no se suma al pago; confírmala con tu contador.</p>
        <div class="row mt"><button class="btn" type="submit">Guardar nómina</button></div>`
      : empty('equipo', `No hay personas con pago ${tipo}`, 'Agrégalas en la pestaña Tu equipo.')}
      </form>
    </section>
    <section class="panel"><div class="ph"><h2>Nóminas anteriores</h2></div>
      ${list.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Fecha de pago</th><th>Periodo</th><th class="num">Personas</th><th class="num">Total</th><th>Estado</th><th></th></tr></thead><tbody>
      ${list.slice(0, 15).map(p => { const pay = S.payables.find(x => x.key === 'nom:' + p.id); const paid = pay && pay.estado === 'pagado'; return `<tr><td>${fd(p.fechaPago)}</td><td>${fds(p.inicio)} al ${fds(p.fin)}</td><td class="num">${p.items.length}</td><td class="num">${money(p.total)}</td><td>${paid ? '<span class="tag ok">Pagada</span>' : '<span class="tag warn">Pendiente</span>'}</td><td class="right"><div class="acts"><button class="btn sec sm" data-a="viewPayroll" data-id="${p.id}">Ver detalle</button>${!paid && pay ? `<button class="btn sm" data-a="markPaid" data-id="${pay.id}">Marcar pagada</button>` : ''}</div></td></tr>`; }).join('')}
      </tbody></table></div>` : empty('equipo', 'Todavía no generas ninguna nómina', '')}
    </section>`;
  }
  return `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-a="etab" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
}

/* ============ Pagos y gastos ============ */
function vPagos() {
  const tab = ui.gTab, T = today();
  const tabs = [['proximos', 'Por pagar'], ['calendario', 'Calendario'], ['fijos', 'Gastos fijos'], ['historial', 'Ya pagado']];
  let body = '';
  const f = ui.payFilter; const filt = arr => f === 'Todas' ? arr : arr.filter(p => p.categoria === f);
  const filterBar = `<label style="flex-direction:row;align-items:center;gap:8px">Mostrar<select data-a-change="payFilter" style="width:auto"><option value="Todas">Todas las categorías</option>${CATS_PAGO.map(c => `<option ${f === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>`;
  if (tab === 'proximos') {
    const pend = filt(pendientes().concat(nominaEstimada(14))).filter(p => p.vence <= addD(T, 60)).sort((a, b) => a.vence.localeCompare(b.vence));
    const g = [['Vencidos', pend.filter(p => p.vence < T), 'bad'], ['Esta semana', pend.filter(p => p.vence >= T && p.vence <= addD(T, 7))], ['La siguiente semana', pend.filter(p => p.vence > addD(T, 7) && p.vence <= addD(T, 14))], ['Más adelante, hasta 60 días', pend.filter(p => p.vence > addD(T, 14))]];
    body = `<div class="row">${filterBar}<span class="spacer"></span><button class="btn sec sm" data-a="quickPay">${icon('mas1')}Agregar pago</button></div>
    ${g.map(([t, arr, cls]) => arr.length ? `<section class="panel"><div class="ph"><h2 ${cls ? 'class="down"' : ''}>${t}</h2><b class="serif" style="font-size:1.2rem">${money(sum(arr, 'monto'))}</b></div>${payTable(arr)}</section>` : '').join('')}
    ${!pend.length ? `<section class="panel">${empty('calendario', 'No tienes pagos pendientes' + (f !== 'Todas' ? ' en esta categoría' : ''), 'Aparecen aquí cuando registras compras a crédito, gastos fijos o nómina.')}</section>` : ''}`;
  } else if (tab === 'calendario') body = vCalendario();
  else if (tab === 'fijos') {
    const mensual = sum(S.recurring.filter(r => r.activo), r => r.frecuencia === 'semanal' ? r.monto * 52 / 12 : r.frecuencia === 'bimestral' ? r.monto / 2 : r.monto);
    body = `
    <section class="panel"><div class="ph"><div><h2>Gastos fijos</h2><p>Se agregan solos a tus pagos. En total equivalen a ${money(mensual)} al mes.</p></div></div>
      ${S.recurring.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Concepto</th><th>Categoría</th><th class="num">Monto</th><th>Cuándo</th><th>Estado</th><th></th></tr></thead><tbody>
      ${S.recurring.map(r => `<tr><td>${h(r.nombre)}</td><td>${h(r.categoria)}</td><td class="num">${money(r.monto)}</td><td>${r.frecuencia === 'semanal' ? 'Cada ' + DIAS[r.diaSemana] : (r.frecuencia === 'bimestral' ? 'Cada 2 meses, día ' : 'Cada mes, día ') + r.dia}</td><td>${r.activo ? '<span class="tag ok">Activo</span>' : '<span class="tag">En pausa</span>'}</td><td class="right"><div class="acts"><button class="btn sec sm" data-a="editRec" data-id="${r.id}">Editar</button><button class="btn sec sm" data-a="toggleRec" data-id="${r.id}">${r.activo ? 'Pausar' : 'Activar'}</button><button class="btn danger sm" data-a="delRec" data-id="${r.id}">Eliminar</button></div></td></tr>`).join('')}
      </tbody></table></div>` : empty('calendario', 'Sin gastos fijos', 'Agrega renta, luz, agua, gas o cualquier pago que se repita.')}
    </section>
    <section class="panel"><div class="ph"><h2>Agregar gasto fijo</h2></div>${recForm({})}</section>`;
  } else {
    const paid = filt(S.payables.filter(p => p.estado === 'pagado' && p.pagadoEl >= addD(T, -30))).sort((a, b) => b.pagadoEl.localeCompare(a.pagadoEl));
    body = `<div class="row">${filterBar}</div>
    <section class="panel"><div class="ph"><h2>Pagado en los últimos 30 días</h2><b class="serif" style="font-size:1.2rem">${money(sum(paid, 'monto'))}</b></div>
      ${paid.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Concepto</th><th>Pagado el</th><th>Categoría</th><th class="num">Monto</th><th></th></tr></thead><tbody>
      ${paid.slice(0, 60).map(p => `<tr><td>${h(p.concepto)}</td><td>${fd(p.pagadoEl)}</td><td>${h(p.categoria)}</td><td class="num">${money(p.monto)}</td><td class="right"><div class="acts"><button class="btn sec sm" data-a="unpay" data-id="${p.id}">Deshacer</button></div></td></tr>`).join('')}
      </tbody></table></div>` : empty('calendario', 'Sin pagos en este periodo', '')}</section>`;
  }
  return `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-a="gtab" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
}
function payTable(arr) {
  const T = today();
  return `<div class="tablewrap"><table class="t"><thead><tr><th>Concepto</th><th>Vence</th><th>Categoría</th><th class="num">Monto</th><th></th></tr></thead><tbody>
  ${arr.map(p => `<tr><td>${h(p.concepto)}${p.proveedor ? `<br><span class="hint">${h(p.proveedor)}</span>` : ''}${p.estimado ? ' <span class="tag">Estimación</span>' : ''}</td><td>${p.vence === T ? 'Hoy' : fd(p.vence)}</td><td>${h(p.categoria)}</td><td class="num">${money(p.monto)}</td><td class="right"><div class="acts">${p.virtual ? `<button class="btn sec sm" data-a="goNomina">Generar nómina</button>` : `<button class="btn sm" data-a="markPaid" data-id="${p.id}">Marcar pagado</button>`}${p.origen === 'manual' ? `<button class="btn danger sm" data-a="delPay" data-id="${p.id}">Eliminar</button>` : ''}</div></td></tr>`).join('')}
  </tbody></table></div>`;
}
function recForm(r) {
  return `<form class="fields" data-f="recurring">
    <input type="hidden" name="id" value="${r.id || ''}">
    <label>Concepto<input name="nombre" value="${h(r.nombre || '')}" placeholder="Ej. Renta del local" required></label>
    <label>Categoría<select name="categoria">${CATS_PAGO.filter(c => c !== 'Nómina').map(c => `<option ${r.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label>Monto<input name="monto" type="number" min="1" value="${r.monto || ''}" required inputmode="numeric"></label>
    <label>Cada cuánto<select name="frecuencia">${[['mensual', 'Cada mes'], ['bimestral', 'Cada 2 meses'], ['semanal', 'Cada semana']].map(([v, l]) => `<option value="${v}" ${r.frecuencia === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Día del mes<input name="dia" type="number" min="1" max="31" value="${r.dia || 1}"></label>
    <label>Día de la semana (si es semanal)<select name="diaSemana">${DIAS.map((d, i) => `<option value="${i}" ${Number(r.diaSemana) === i ? 'selected' : ''}>${cap(d)}</option>`).join('')}</select></label>
    <div class="form-actions"><button class="btn" type="submit">${r.id ? 'Guardar cambios' : 'Agregar gasto fijo'}</button></div>
  </form>`;
}
function vCalendario() {
  const T = today(); const mk = ui.calMonth || monthKey(T); const [y, m] = mk.split('-').map(Number);
  const first = new Date(y, m - 1, 1), off = (first.getDay() + 6) % 7, nd = lastDay(y, m - 1);
  const pend = pendientes().concat(nominaEstimada(45)); const paid = S.payables.filter(p => p.estado === 'pagado');
  const al = alerta(); const prev = ds(new Date(y, m - 2, 1)).slice(0, 7), next = ds(new Date(y, m, 1)).slice(0, 7);
  const totals = {}; for (let d = 1; d <= nd; d++) { const date = y + '-' + pad(m) + '-' + pad(d); totals[date] = sum(pend.filter(p => p.vence === date), 'monto'); }
  const mx = Math.max(1, ...Object.values(totals));
  let cells = '';
  for (let i = 0; i < off; i++) cells += '<div class="cd empty-cell"></div>';
  for (let d = 1; d <= nd; d++) {
    const date = y + '-' + pad(m) + '-' + pad(d); const pp = pend.filter(p => p.vence === date), pg = paid.filter(p => p.pagadoEl === date);
    const tot = totals[date]; const lvl = tot ? Math.min(1, 0.18 + tot / mx * 0.82) : 0;
    const bg = tot ? `background:color-mix(in srgb, var(--ocre) ${Math.round(lvl * 55)}%, var(--paper))` : '';
    cells += `<button class="cd ${date === T ? 'today' : ''} ${date < T ? 'past' : ''}" style="${bg}" data-a="calDay" data-v="${date}" aria-label="${fdl(date)}${tot ? ', ' + money(tot) + ' por pagar' : ''}">
      <span class="dn">${d}</span>${al && al.fecha === date ? '<span class="tag bad flag">Alerta</span>' : ''}
      ${tot ? `<span class="cam">${money(tot)}</span>${pp.slice(0, 2).map(x => `<span class="cc">${h(x.concepto)}</span>`).join('')}${pp.length > 2 ? `<span class="cc">y ${pp.length - 2} más</span>` : ''}` : ''}
      ${pg.length ? `<span class="cc">Pagado: ${money(sum(pg, 'monto'))}</span>` : ''}</button>`;
  }
  return `<section class="panel">
    <div class="ph"><div><h2>${cap(monthName(mk))}</h2><p>Por pagar en ${MESES[m - 1]}: ${money(sum(pend.filter(p => monthKey(p.vence) === mk), 'monto'))}. Mientras más oscuro el día, más pesado.</p></div>
      <div class="row"><button class="btn sec sm" data-a="calMonth" data-v="${prev}">Mes anterior</button><button class="btn sec sm" data-a="calMonth" data-v="${monthKey(T)}">Este mes</button><button class="btn sec sm" data-a="calMonth" data-v="${next}">Mes siguiente</button></div></div>
    <div class="calwrap"><div class="cal">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="ch">${d}</div>`).join('')}${cells}</div></div>
    <div class="row mt"><span class="heat-legend">Menos <i style="background:var(--paper)"></i><i style="background:color-mix(in srgb,var(--ocre) 20%,var(--paper))"></i><i style="background:color-mix(in srgb,var(--ocre) 38%,var(--paper))"></i><i style="background:color-mix(in srgb,var(--ocre) 55%,var(--paper))"></i> Más</span><span class="hint">Toca un día para ver el detalle. La nómina aparece aunque aún no la generes.</span></div>
  </section>`;
}

/* ============ Impuestos, fondo y reportes ============ */
function vImpuestos() {
  const T = today();
  const est = pendientes().filter(p => p.categoria === 'Impuestos').sort((a, b) => a.vence.localeCompare(b.vence));
  const paid = S.payables.filter(p => p.categoria === 'Impuestos' && p.estado === 'pagado').sort((a, b) => b.pagadoEl.localeCompare(a.pagadoEl));
  return `
  <p class="aviso">Lo de esta sección son <b>estimaciones</b> para que el pago no te tome por sorpresa. No sustituyen el cálculo de tu contador ni toman en cuenta tu régimen fiscal.</p>
  <div class="grid2">
    <section class="panel"><div class="ph"><div><h2>Lo que viene</h2><p>Estimado con el ${num(S.config.impuestoPct)}% de tus ventas de los últimos 30 días.</p></div></div>
      ${est.length ? timeline(est) : empty('calendario', 'Sin pagos estimados', 'Configura un porcentaje para verlos aquí.')}
      <form class="fields mt" data-f="taxPct">
        <label>Porcentaje estimado sobre ventas<input name="pct" type="number" min="0" max="40" step="0.1" value="${S.config.impuestoPct}"></label>
        <div class="form-actions"><button class="btn sec" type="submit">Actualizar</button></div>
      </form>
      <details class="qs"><summary>¿Qué porcentaje pongo?</summary><p>Pregúntale a tu contador cuánto suele representar tu pago mensual frente a lo que vendes, y escríbelo aquí. La app usará ese número para avisarte con tiempo.</p></details>
    </section>
    <section class="panel"><div class="ph"><div><h2>Registrar pago de impuestos</h2><p>Si había una estimación ese mes, se reemplaza por lo que pagaste de verdad.</p></div></div>
      <form class="fields" data-f="taxPay">
        <label>Concepto<select name="concepto"><option>ISR e IVA (pago provisional)</option><option>Cuotas IMSS</option><option>Impuesto sobre nómina</option><option>Otro</option></select></label>
        <label>Monto pagado<input name="monto" type="number" min="1" required inputmode="numeric"></label>
        <label>Fecha de pago<input name="fecha" type="date" value="${T}" required></label>
        <div class="form-actions"><button class="btn" type="submit">Registrar pago</button></div>
      </form>
    </section>
  </div>
  <section class="panel"><div class="ph"><h2>Pagos registrados</h2></div>
    ${paid.length ? `<table class="t"><thead><tr><th>Concepto</th><th>Fecha</th><th class="num">Monto</th></tr></thead><tbody>
    ${paid.map(p => `<tr><td>${h(p.concepto)}</td><td>${fd(p.pagadoEl)}</td><td class="num">${money(p.monto)}</td></tr>`).join('')}
    </tbody></table>` : empty('ticket', 'Sin pagos registrados', '')}</section>`;
}
function vReserva() {
  const bal = reserveBalance(), meta = S.reserve.meta, pct = meta ? Math.min(100, bal / meta * 100) : 0;
  const gastoSem = sum(S.recurring.filter(r => r.activo && r.categoria !== 'Retiro del dueño'), r => r.frecuencia === 'semanal' ? r.monto : r.frecuencia === 'bimestral' ? r.monto / 8.7 : r.monto / 4.35) + sum(S.employees.filter(e => e.activo), e => e.periodicidad === 'semanal' ? e.sueldo : e.sueldo * 7 / 15);
  const sem = gastoSem ? bal / gastoSem : 0;
  return `
  <div class="g57">
    <section class="panel">
      <div class="dato"><div class="label">${icon('reserva')}Tu fondo de reserva</div><div class="value" style="font-size:2.4rem">${money(bal)}</div><div class="note">${meta ? 'de una meta de ' + money(meta) : 'Define una meta para medir tu avance'}</div></div>
      <div class="progress mt" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      ${meta ? `<p class="hint mt">Llevas ${num(pct, 0)}%. Te faltan ${money(Math.max(0, meta - bal))}.</p>` : ''}
      ${gastoSem ? `<p class="lectura ${sem < 2 ? 'warn' : ''}">Si un día dejaras de vender, este fondo cubriría unas <b>${num(sem, 1)} semanas</b> de renta, servicios y nómina.${sem < 4 ? ' Se recomienda juntar al menos cuatro.' : ''}</p>` : ''}
      <form class="fields mt" data-f="reserveMeta"><label>Meta del fondo<input name="meta" type="number" min="0" value="${meta || ''}" inputmode="numeric"></label><div class="form-actions"><button class="btn sec" type="submit">Guardar meta</button></div></form>
      ${gastoSem ? `<p class="hint mt">Una meta de cuatro semanas sería de ${money(gastoSem * 4)}.</p>` : ''}
    </section>
    <div class="stack">
      <section class="panel"><div class="ph"><div><h2>Aportar o retirar</h2><p>Apártalo de verdad: una cuenta aparte en tu banco funciona mejor que un sobre en la caja.</p></div></div>
        <form class="fields" data-f="reserveMov">
          <label>Movimiento<select name="tipo"><option value="aporte">Aportar al fondo</option><option value="retiro">Sacar del fondo</option></select></label>
          <label>Monto<input name="monto" type="number" min="1" required inputmode="numeric"></label>
          <label class="wide">Nota (opcional)<input name="nota"></label>
          <div class="form-actions"><button class="btn" type="submit">Registrar movimiento</button></div>
        </form>
      </section>
      <section class="panel"><div class="ph"><h2>Movimientos</h2></div>
        ${S.reserve.movs.length ? `<table class="t"><thead><tr><th>Movimiento</th><th>Fecha</th><th>Nota</th><th class="num">Monto</th></tr></thead><tbody>
        ${S.reserve.movs.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map(m => `<tr><td>${m.tipo === 'aporte' ? 'Aportación' : 'Retiro'}</td><td>${fd(m.fecha)}</td><td>${h(m.nota || '')}</td><td class="num ${m.tipo === 'aporte' ? 'up' : 'down'}">${m.tipo === 'aporte' ? '+' : '−'} ${money(m.monto)}</td></tr>`).join('')}
        </tbody></table>` : empty('alcancia', 'Sin movimientos todavía', 'Empieza con poco: lo importante es apartar cada semana.')}
      </section>
    </div>
  </div>`;
}
function reportData(mk) {
  const ventas = sum(S.sales.filter(s => monthKey(s.fecha) === mk), 'monto');
  const paid = S.payables.filter(p => p.estado === 'pagado' && monthKey(p.pagadoEl) === mk);
  const byCat = {}; CATS_PAGO.forEach(c => byCat[c] = 0); paid.forEach(p => byCat[p.categoria] = (byCat[p.categoria] || 0) + p.monto);
  const merma = sum(S.closings.filter(c => monthKey(c.fecha) === mk), mermaCosto);
  const egresosOp = sum(Object.entries(byCat).filter(([c]) => c !== 'Retiro del dueño'), e => e[1]);
  return { ventas, byCat, merma, egresosOp, retiro: byCat['Retiro del dueño'] || 0 };
}
function vReportes() {
  const T = today(); const months = []; const t = pd(T);
  for (let k = 0; k < 4; k++) months.push(ds(new Date(t.getFullYear(), t.getMonth() - k, 1)).slice(0, 7));
  const mk = ui.repMonth || (pd(T).getDate() < 10 ? months[1] : months[0]); const r = reportData(mk);
  const res = r.ventas - r.egresosOp;
  const cats = Object.entries(r.byCat).filter(([c, v]) => v > 0 && c !== 'Retiro del dueño').sort((a, b) => b[1] - a[1]);
  return `
  <div class="row"><label style="flex-direction:row;align-items:center;gap:8px">Mes<select data-a-change="repMonth" style="width:auto">${months.map(m => `<option value="${m}" ${m === mk ? 'selected' : ''}>${cap(monthName(m))}${m === months[0] ? ' (en curso)' : ''}</option>`).join('')}</select></label><span class="spacer"></span>
    <button class="btn sec sm" data-a="csvReport" data-v="${mk}">Copiar resumen</button><button class="btn sec sm" data-a="csvSales" data-v="${mk}">Copiar ventas del mes</button><button class="btn sec sm" data-a="print">Imprimir</button></div>
  <section class="panel"><div class="ph"><div><h2>De tus ventas a lo que te quedó</h2><p>${cap(monthName(mk))}. Solo cuenta lo que ya marcaste como pagado; no es un estado de resultados contable.</p></div></div>
    ${r.ventas ? waterfall(r) : empty('ticket', 'Sin ventas en este mes', '')}</section>
  <div class="grid2">
    <section class="panel"><div class="ph"><h2>Resumen</h2></div>
      <table class="t" data-nocards><tbody>
        <tr><td>Ventas</td><td class="num"><b>${money(r.ventas)}</b></td></tr>
        ${cats.map(([c, v]) => `<tr><td class="muted">${c}</td><td class="num">− ${money(v)}</td></tr>`).join('')}
      </tbody><tfoot>
        <tr><td>Te quedó de la operación</td><td class="num">${money(res)}</td></tr>
        <tr><td class="muted" style="font-weight:500">Tus retiros</td><td class="num" style="font-weight:500">− ${money(r.retiro)}</td></tr>
        <tr><td>Después de tus retiros</td><td class="num ${res - r.retiro < 0 ? 'down' : ''}">${money(res - r.retiro)}</td></tr>
      </tfoot></table>
      <p class="hint mt">Merma del mes: ${money(r.merma)} en producto que se tiró.</p>
    </section>
    ${vComparativo(mk, r)}
  </div>`;
}
function vComparativo(mk, r) {
  let nota = '';
  if (mk === monthKey(today())) { const t = pd(today()); const pm = ds(new Date(t.getFullYear(), t.getMonth() - 1, 1)).slice(0, 7); mk = pm; r = reportData(pm); nota = ' Usamos ' + monthName(pm) + ' porque el mes en curso no ha terminado.'; }
  if (!r.ventas) return '<section class="panel">' + empty('ticket', 'Aún no hay un mes completo para comparar', '') + '</section>';
  const comp = sum(S.purchases.filter(p => monthKey(p.fecha) === mk), 'costo');
  const rows = [['Compra de insumos', comp / r.ventas * 100, 28, 35, 'de tus ventas'], ['Nómina', (r.byCat['Nómina'] || 0) / r.ventas * 100, 20, 30, 'de tus ventas'], ['Renta', (r.byCat['Renta'] || 0) / r.ventas * 100, 0, 10, 'de tus ventas'], ['Merma', comp ? r.merma / comp * 100 : 0, 0, 5, 'de tus compras']];
  const W = 100;
  return `<section class="panel"><div class="ph"><div><h2>¿Cómo vas contra otros restaurantes?</h2><p>Rangos de referencia comunes en restaurantes. Son guía, no regla.${nota}</p></div></div>
    <div class="stack">${rows.map(([c, v, lo, hi, de]) => { const st = v > hi ? ['bad', 'Por encima'] : ['ok', v < lo && lo > 0 ? 'Por debajo' : 'Dentro']; const scale = Math.max(hi * 1.6, v * 1.1, 10); return `<div><div class="row" style="justify-content:space-between"><b>${c}</b><span><b>${num(v)}%</b> <span class="muted small">${de}</span> <span class="tag ${st[0]}">${st[1]}</span></span></div>
      <div style="position:relative;height:14px;background:var(--paper-2);border:1px solid var(--line);border-radius:999px;margin-top:6px;overflow:hidden"><span style="position:absolute;left:${lo / scale * W}%;width:${(hi - lo) / scale * W}%;top:0;bottom:0;background:var(--menta)"></span><span style="position:absolute;left:calc(${Math.min(v / scale * W, 99)}% - 2px);width:4px;top:0;bottom:0;background:${v > hi ? 'var(--arcilla)' : 'var(--bosque)'}"></span></div>
      <span class="hint">Referencia: ${lo ? lo + ' a ' : 'hasta '}${hi}%</span></div>`; }).join('')}</div>
    ${rows[0][1] > 35 ? '<p class="lectura warn">Tu compra de insumos está arriba de la referencia. Revisa “Qué comprar”, compara precios de proveedores o ajusta el precio de los platillos que más te cuestan.</p>' : ''}
  </section>`;
}

/* ============ Simulador ============ */
function lineCmp(base, esc, reserve, days, s0, s1) {
  const W = 640, H = 250, pl = 58, pr = 14, pt = 14, pb = 26;
  const a = [{ bal: s0, date: today() }].concat(base.slice(0, days)), b = [{ bal: s1, date: today() }].concat(esc.slice(0, days));
  const vals = a.concat(b).map(d => d.bal).concat([reserve, 0]);
  let mn = Math.min(...vals), mx = Math.max(...vals); const pv = (mx - mn) * 0.08 || 1000; mn -= pv; mx += pv;
  const step = niceStep((mx - mn) / 4); mn = Math.floor(mn / step) * step; mx = Math.ceil(mx / step) * step;
  const x = i => pl + (W - pl - pr) * i / (a.length - 1), y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  let g = '';
  for (let v = mn; v <= mx + 1; v += step) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line-2)"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${moneyShort(v)}</text>`;
  if (mn < 0 && mx > 0) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--soft)"/>`;
  const every = days <= 30 ? 7 : days <= 60 ? 14 : 21;
  for (let i = 0; i < a.length; i += every) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${i === 0 ? 'Hoy' : fds(a[i].date)}</text>`;
  g += `<line x1="${pl}" x2="${W - pr}" y1="${y(reserve)}" y2="${y(reserve)}" stroke="var(--ocre)" stroke-width="1.6" stroke-dasharray="6 4"/>`;
  const pts = s => s.map((d, i) => x(i).toFixed(1) + ',' + y(d.bal).toFixed(1)).join(' ');
  g += `<polyline points="${pts(a)}" fill="none" stroke="var(--soft)" stroke-width="1.8" stroke-dasharray="2 3"/>`;
  g += `<polyline points="${pts(b)}" fill="none" stroke="var(--bosque)" stroke-width="2.6"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Comparación de saldo proyectado">${g}</svg>`;
}
function vSimulador() {
  const s = ui.sim = Object.assign(SIM0(), ui.sim || {});
  const T = today();
  const opts = pendientes().filter(p => p.monto >= 1000 && p.vence <= addD(T, 90)).sort((a, b) => a.vence.localeCompare(b.vence));
  return `
  <p class="aviso info">Prueba una decisión antes de tomarla. Nada de lo que muevas aquí cambia tus datos.</p>
  <div class="sim">
    <section class="panel">
      <div class="ph"><h2>¿Qué pasa si…?</h2><button class="linkbtn" data-a="simReset">Quitar cambios</button></div>
      <form class="stack" data-sim>
        <fieldset><legend>${icon('ventas')}Mis ventas cambian</legend>
          <div class="rangebox"><input type="range" name="ventasPct" min="-30" max="30" step="5" value="${s.ventasPct}" aria-label="Cambio en ventas"><b data-out="ventasPct">${s.ventasPct > 0 ? '+' : ''}${s.ventasPct}%</b></div>
        </fieldset>
        <fieldset><legend>${icon('reserva')}Saco dinero hoy para mí</legend><input name="retiroHoy" type="number" min="0" step="500" value="${s.retiroHoy || ''}" placeholder="$0" inputmode="numeric"></fieldset>
        <fieldset><legend>${icon('reserva')}Bajo mi retiro semanal</legend>
          <div class="two"><select name="retiroPct">${[0, 25, 50, 75, 100].map(v => `<option value="${v}" ${Number(s.retiroPct) === v ? 'selected' : ''}>${v ? v + '% menos' : 'Sin cambio'}</option>`).join('')}</select><label>Hasta<input name="retiroHasta" type="date" value="${s.retiroHasta}"></label></div>
        </fieldset>
        <fieldset><legend>${icon('caja')}Hago una compra grande</legend>
          <div class="two"><input name="gastoMonto" type="number" min="0" step="500" value="${s.gastoMonto || ''}" placeholder="Monto" aria-label="Monto de la compra" inputmode="numeric"><label>Fecha<input name="gastoFecha" type="date" value="${s.gastoFecha}"></label></div>
        </fieldset>
        <fieldset><legend>${icon('nomina')}Contrato a alguien más</legend>
          <div class="two"><input name="empSueldo" type="number" min="0" step="100" value="${s.empSueldo || ''}" placeholder="Sueldo semanal" aria-label="Sueldo semanal" inputmode="numeric"><label>Desde<input name="empDesde" type="date" value="${s.empDesde}"></label></div>
        </fieldset>
        <fieldset><legend>${icon('pagos')}Muevo o divido un pago</legend>
          <select name="moverId"><option value="">Ninguno</option>${opts.map(p => `<option value="${p.id}" ${s.moverId === p.id ? 'selected' : ''}>${fds(p.vence)}, ${h(p.concepto)}, ${money(p.monto)}</option>`).join('')}</select>
          ${s.moverId ? `<div class="two mt"><select name="moverModo"><option value="mover" ${s.moverModo === 'mover' ? 'selected' : ''}>Cambiar la fecha</option><option value="dividir" ${s.moverModo === 'dividir' ? 'selected' : ''}>Dividir en dos pagos</option></select><label>${s.moverModo === 'dividir' ? 'Primer pago' : 'Nueva fecha'}<input name="f1" type="date" value="${s.f1}"></label></div>${s.moverModo === 'dividir' ? `<label class="mt">Segundo pago<input name="f2" type="date" value="${s.f2}"></label>` : ''}` : ''}
        </fieldset>
      </form>
    </section>
    <div id="simOut" class="stack">${simOut()}</div>
  </div>`;
}
function simOut() {
  const s = ui.sim, sc = simScenario(s), res = reserveBalance();
  const base = proyeccion(90), esc = proyeccion(90, sc);
  const alB = alerta(base), alE = alerta(esc);
  const dispB = disponible(), dispE = dispB - sc.retiroHoy;
  const minOf = ser => ser.reduce((m, d) => d.bal < m.bal ? d : m, ser[0]);
  const mB = minOf(base), mE = minOf(esc);
  const segB = retiroSeguro(base, dispB), segE = retiroSeguro(esc, dispE);
  const changed = JSON.stringify(sc) !== JSON.stringify(simScenario({}));
  let v;
  if (!changed) v = ['', 'Mueve algo a la izquierda y aquí ves qué le pasaría a tu dinero.'];
  else if (alB && !alE) v = ['ok', 'Con estos cambios, la alerta de liquidez desaparece.'];
  else if (!alB && alE) v = ['bad', 'Cuidado: con estos cambios aparece una alerta en ' + alE.dias + ' días.'];
  else if (alB && alE && alE.dias > alB.dias) v = ['warn', 'La alerta se aleja ' + (alE.dias - alB.dias) + ' días, pero no desaparece.'];
  else if (alB && alE && alE.dias < alB.dias) v = ['bad', 'La alerta se adelanta ' + (alB.dias - alE.dias) + ' días.'];
  else v = [esc[89].bal >= base[89].bal ? 'ok' : 'warn', 'En 90 días tendrías ' + money(Math.abs(esc[89].bal - base[89].bal)) + (esc[89].bal >= base[89].bal ? ' más' : ' menos') + ' que si sigues igual.'];
  const alTxt = a => a ? `En ${a.dias} días (${fds(a.fecha)})` : 'Sin alerta';
  const row = (l, a, b, good) => `<tr><td>${l}</td><td class="num">${a}</td><td class="num"><b class="${good === true ? 'up' : good === false ? 'down' : ''}">${b}</b></td></tr>`;
  const rng = ui.simRange || 90;
  return `
  <div class="veredicto ${v[0]}" role="status">${v[1]}</div>
  <section class="panel"><div class="ph"><h2>Tu dinero con y sin el cambio</h2><div class="seg" role="group" aria-label="Periodo">${[30, 60, 90].map(d => `<button data-a="simRange" data-v="${d}" aria-pressed="${rng === d}">${d} días</button>`).join('')}</div></div>
    ${lineCmp(base, esc, res, rng, saldoActual(), saldoActual() - sc.retiroHoy)}
    <div class="legend"><span><i style="border-color:var(--soft);border-top-style:dotted"></i>Si sigues igual</span><span><i style="border-color:var(--bosque)"></i>Con tu cambio</span><span><i style="border-color:var(--ocre);border-top-style:dashed"></i>Fondo de reserva</span></div>
  </section>
  <section class="panel"><table class="t" data-nocards><thead><tr><th></th><th class="num">Si sigues igual</th><th class="num">Con tu cambio</th></tr></thead><tbody>
    ${row('Puedes usar hoy', money(dispB), money(dispE), dispE > dispB ? true : dispE < dispB ? false : null)}
    ${row('Alerta de liquidez', alTxt(alB), alTxt(alE), !alE && alB ? true : alE && !alB ? false : alE && alB ? (alE.dias > alB.dias ? true : alE.dias < alB.dias ? false : null) : null)}
    ${row('Saldo más bajo en 90 días', money(mB.bal) + '<br><span class="hint">' + fds(mB.date) + '</span>', money(mE.bal) + '<br><span class="hint">' + fds(mE.date) + '</span>', mE.bal > mB.bal ? true : mE.bal < mB.bal ? false : null)}
    ${row('Saldo en 30 días', money(base[29].bal), money(esc[29].bal), esc[29].bal > base[29].bal ? true : esc[29].bal < base[29].bal ? false : null)}
    ${row('Retiro sin riesgo hoy', money(segB), money(segE), segE > segB ? true : segE < segB ? false : null)}
  </tbody></table></section>`;
}

/* ============ Promociones y financiamiento ============ */
function promoMsg(p) {
  const r = S.restaurant, d = DIAS[p.dia], pl = d.endsWith('s') ? d : d + 's';
  const city = r.ciudad ? ' en ' + r.ciudad.split(',')[0] : '';
  const base = { combo: `Los ${pl} en ${r.nombre}: ${p.desc} por solo ${p.precio}.`, descuento: `Todos los ${pl} en ${r.nombre}: ${p.desc} con ${p.precio} de descuento.`, regalo: `Los ${pl} en ${r.nombre}, ${p.desc} y te regalamos ${p.precio}.`, horario: `Los ${pl} en ${r.nombre}: ${p.desc} a ${p.precio}.` }[p.tipo] || '';
  return base + (p.horario ? ` Válido de ${p.horario}.` : '') + ` Te esperamos${city}.`;
}
function promoResult(p) {
  const T = today(); const wd = Number(p.dia);
  const by = {}; S.sales.forEach(s => by[s.fecha] = (by[s.fecha] || 0) + s.monto);
  const before = [], after = [];
  for (let i = 1; i <= 56; i++) { const d = addD(p.inicio, -i); if (pd(d).getDay() === wd && by[d] != null) before.push(by[d]); }
  for (let d = p.inicio; d < T; d = addD(d, 1)) if (pd(d).getDay() === wd && by[d] != null) after.push(by[d]);
  if (after.length < 2 || !before.length) return null;
  const a = sum(before, x => x) / before.length, b = sum(after, x => x) / after.length;
  return { antes: a, despues: b, pct: (b - a) / a * 100, semanas: after.length, extra: (b - a) * after.length };
}
function vPromos() {
  const avg = avgByWeekday(); const order = [1, 2, 3, 4, 5, 6, 0];
  const has = avg.some(v => v > 0);
  const weak = order.slice().sort((a, b) => avg[a] - avg[b])[0], best = order.slice().sort((a, b) => avg[b] - avg[a])[0];
  const np = ui.promoDraft = Object.assign({ nombre: '', dia: weak, tipo: 'combo', desc: '', precio: '', horario: '' }, ui.promoDraft || {});
  return `
  <div class="grid2">
    <section class="panel"><div class="ph"><div><h2>Tu semana, día por día</h2><p>Venta promedio de las últimas 8 semanas.</p></div></div>
      ${has ? barChart(order.map(i => ({ l: cap(DIAS[i]).slice(0, 3), v: avg[i] })), order.indexOf(weak)) : empty('megafono', 'Registra ventas para ver este análisis', '')}
      ${has ? `<p class="lectura">Tu día más flojo es el <b>${DIAS[weak]}</b>: vendes ${money(avg[weak])} en promedio, ${num((1 - avg[weak] / avg[best]) * 100, 0)}% menos que el ${DIAS[best]}. Una promoción solo ese día puede llenar mesas sin bajar precios toda la semana.</p>` : ''}
    </section>
    <section class="panel"><div class="ph"><div><h2>Arma una promoción</h2><p>Te damos el mensaje listo para WhatsApp o redes.</p></div></div>
      <form class="fields" data-f="promo" data-calc="promo">
        <label class="wide">Nombre<input name="nombre" value="${h(np.nombre)}" placeholder="Ej. Lunes de asada" required></label>
        <label>Día<select name="dia">${order.map(i => `<option value="${i}" ${Number(np.dia) === i ? 'selected' : ''}>${cap(DIAS[i])}${i === weak ? ' (el más flojo)' : ''}</option>`).join('')}</select></label>
        <label>Tipo<select name="tipo">${[['combo', 'Combo a precio especial'], ['descuento', 'Descuento en un producto'], ['regalo', 'Regalo con tu consumo'], ['horario', 'Precio especial por horario']].map(([v, l]) => `<option value="${v}" ${np.tipo === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="wide">¿Qué incluye?<input name="desc" value="${h(np.desc)}" placeholder="Ej. 4 tacos de asada + agua fresca" required></label>
        <label>${np.tipo === 'descuento' ? 'Descuento' : np.tipo === 'regalo' ? 'Regalo' : 'Precio'}<input name="precio" value="${h(np.precio)}" placeholder="${np.tipo === 'descuento' ? 'Ej. 20%' : np.tipo === 'regalo' ? 'Ej. un agua fresca' : 'Ej. $89'}" required></label>
        <label>Horario (opcional)<input name="horario" value="${h(np.horario)}" placeholder="Ej. 1:00 a 5:00 p.m."></label>
        <div class="wide"><span class="hint">Así se verá tu mensaje:</span><div class="preview" data-promo-preview>${h(np.desc && np.precio ? promoMsg(np) : 'Completa la promoción para ver el mensaje.')}</div></div>
        <div class="form-actions wide"><button class="btn" type="submit">Guardar y medir resultado</button><button class="btn sec" type="button" data-a="copyPromo">${icon('copiar')}Copiar mensaje</button></div>
      </form>
    </section>
  </div>
  <section class="panel"><div class="ph"><div><h2>¿Funcionaron tus promociones?</h2><p>Comparamos lo que vendías ese día antes de la promoción con lo que vendes ahora.</p></div></div>
    ${S.promos.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Promoción</th><th>Día</th><th>Desde</th><th class="num">Antes</th><th class="num">Ahora</th><th>Resultado</th><th></th></tr></thead><tbody>
    ${S.promos.map(p => { const r = promoResult(p); return `<tr><td>${h(p.nombre)}<br><span class="hint">${h(p.desc)}, ${h(p.precio)}</span></td><td>${cap(DIAS[p.dia])}</td><td>${fd(p.inicio)}</td><td class="num">${r ? money(r.antes) : '—'}</td><td class="num">${r ? money(r.despues) : '—'}</td><td>${!p.activa ? '<span class="tag">En pausa</span>' : r ? `<span class="tag ${r.pct >= 3 ? 'ok' : r.pct <= -3 ? 'bad' : ''}">${r.pct >= 0 ? '+' : ''}${num(r.pct, 0)}%</span><br><span class="hint">${r.extra > 0 ? money(r.extra) + ' extra en ' + r.semanas + ' semanas' : 'Sin mejora clara'}</span>` : '<span class="hint">Aún es pronto para medir</span>'}</td><td class="right"><div class="acts"><a class="btn sec sm" href="https://wa.me/?text=${encodeURIComponent(promoMsg(p))}" target="_blank" rel="noopener">${icon('whats')}Compartir</a><button class="btn sec sm" data-a="togglePromo" data-id="${p.id}">${p.activa ? 'Pausar' : 'Activar'}</button></div></td></tr>`; }).join('')}
    </tbody></table></div>` : empty('megafono', 'Todavía no tienes promociones', 'Crea una para tu día más flojo y aquí verás si funcionó.')}
  </section>`;
}
function perfilCredito() {
  const T = today();
  const dias = S.sales.length ? diffD(S.sales.reduce((a, s) => s.fecha < a ? s.fecha : a, T), T) : 0;
  const ventasMes = sum(S.sales.filter(s => s.fecha >= addD(T, -90) && s.fecha < T), 'monto') / 3;
  const weeks = []; for (let k = 1; k <= 12; k++) { const e = addD(T, -7 * (k - 1) - 1), st = addD(e, -6); weeks.push(sum(S.sales.filter(s => s.fecha >= st && s.fecha <= e), 'monto')); }
  const wk = weeks.filter(v => v > 0); const mean = wk.length ? sum(wk, v => v) / wk.length : 0;
  const cv = mean ? Math.sqrt(sum(wk, v => (v - mean) ** 2) / wk.length) / mean : 1;
  const paid = S.payables.filter(p => p.estado === 'pagado' && p.pagadoEl >= addD(T, -90));
  const punt = paid.length ? paid.filter(p => p.pagadoEl <= p.vence).length / paid.length * 100 : 0;
  const venc = pendientes().filter(p => p.vence < T).length;
  const checks = [
    ['Historial registrado', dias >= 90, dias >= 30 ? Math.round(dias / 30) + ' meses' : dias + ' días', 'Se recomiendan al menos 3 meses'],
    ['Ventas estables', cv < 0.15, cv < 0.15 ? 'Estables' : cv < 0.25 ? 'Algo variables' : 'Muy variables', 'Variación semanal de ' + num(cv * 100, 0) + '%'],
    ['Pagos a tiempo', punt >= 90 && venc === 0, num(punt, 0) + '%', venc ? venc + ' pago(s) vencido(s) hoy' : 'Últimos 90 días'],
    ['Fondo de reserva', reserveBalance() > 0, money(reserveBalance()), 'Muestra disciplina con el dinero']
  ];
  const ok = checks.filter(c => c[1]).length;
  return { ventasMes, checks, nivel: ok >= 4 ? 'Alta' : ok >= 2 ? 'Media' : 'Baja', ok };
}
function finOut() {
  const f = ui.fin, P = perfilCredito(), T = today();
  const M = Number(f.monto) || 0, n = Number(f.plazo) || 6, r = 0.025;
  const cuota = M * r / (1 - Math.pow(1 + r, -n)); const total = cuota * n;
  const extras = [{ fecha: T, monto: -M }]; const d0 = pd(T);
  for (let k = 1; k <= n; k++) extras.push({ fecha: ds(new Date(d0.getFullYear(), d0.getMonth() + k, Math.min(d0.getDate(), 28))), monto: cuota, concepto: 'Pago del crédito' });
  const alB = alerta(proyeccion(90)), alE = alerta(proyeccion(90, { extras }));
  const pctV = P.ventasMes ? cuota / P.ventasMes * 100 : 0;
  const j = pctV <= 8 && !alE ? ['ok', 'Recomendable', 'La mensualidad es manejable para tu negocio.'] : pctV <= 12 ? ['warn', 'Con cuidado', 'La mensualidad es alta; úsalo solo en algo que te genere más ventas.'] : ['bad', 'No recomendable', 'La mensualidad es muy alta para lo que vendes hoy.'];
  return `<div class="veredicto ${j[0]} mt">${j[1]}: ${j[2]}</div>
    <table class="t mt" data-nocards><tbody>
      <tr><td>Pago mensual</td><td class="num"><b class="serif" style="font-size:1.2rem">${money(cuota)}</b></td></tr>
      <tr><td>Total a pagar</td><td class="num">${money(total)}</td></tr>
      <tr><td>Lo que te cuesta el crédito</td><td class="num">${money(total - M)}</td></tr>
      <tr><td>La mensualidad frente a tus ventas</td><td class="num">${num(pctV)}%</td></tr>
      <tr><td>Alerta de liquidez</td><td class="num">${alB ? 'Hoy: en ' + alB.dias + ' días' : 'Hoy: sin alerta'}<br><b>${alE ? 'Con el crédito: en ' + alE.dias + ' días' : 'Con el crédito: sin alerta'}</b></td></tr>
    </tbody></table>
    <div class="row mt"><button class="btn" data-a="solicitar">Solicitar con un aliado</button></div>`;
}

/* ============ Administrador (sin acceso a finanzas) ============ */
let ADMIN = null;
const FN_LBL = {
  simulador: ['Simulador', 'Probar decisiones antes de tomarlas'],
  promos: ['Promociones', 'Detectar el día flojo y medir promociones'],
  credito: ['Crédito', 'Precalificación de crédito con sus números. Si está apagada, el dueño la ve con candado como “Próximamente”.'],
  comunidad: ['Comunidad', 'Publicar y comentar con otros dueños'],
  equipo: ['Accesos para el equipo', 'Dar acceso a encargados o cajeros']
};
let adminLoading = false;
async function loadAdmin() {
  if (MODE !== 'cloud' || !isAdmin() || adminLoading) return; adminLoading = true;
  try { ADMIN = await api('adminResumen'); if (['admin', 'asesores'].includes(ui.view) && !document.getElementById('overlay')) render(); }
  catch (e) { toast(e.message); }
  finally { adminLoading = false; }
}
const asesorDe = id => (ADMIN && ADMIN.asesores.find(a => a.id === id)) || null;
const clientesDe = id => ADMIN ? ADMIN.restaurantes.filter(r => r.plan === 'acompanamiento' && r.asesorId === id) : [];
function vAdmin() {
  if (!ADMIN) return `<section class="panel">${empty('equipo', 'Cargando restaurantes…', '')}</section>`;
  const R = ADMIN.restaurantes, A = ADMIN.asesores.filter(a => a.activo);
  const sol = R.filter(r => r.solicitud && r.plan !== 'acompanamiento');
  const acomp = R.filter(r => r.plan === 'acompanamiento'), sinAs = acomp.filter(r => !r.asesorId);
  const f = ui.adminFiltro || 'todos';
  const filtros = [['todos', 'Todos', R.length], ['acomp', 'Acompañamiento', acomp.length], ['auto', 'Autogestión', R.filter(r => r.plan !== 'acompanamiento').length], ['sinasesor', 'Sin asesor', sinAs.length], ['susp', 'Suspendidos', R.filter(r => r.suspendido).length]];
  const pasa = r => f === 'acomp' ? r.plan === 'acompanamiento' : f === 'auto' ? r.plan !== 'acompanamiento' : f === 'sinasesor' ? r.plan === 'acompanamiento' && !r.asesorId : f === 'susp' ? r.suspendido : true;
  const lista = R.filter(pasa).sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
  const off = r => Object.entries(r.funciones || {}).filter(([k, v]) => v === false && k !== 'credito').map(([k]) => FN_LBL[k] ? FN_LBL[k][0] : k);
  return `
  <p class="aviso info">${icon('candado')} Desde aquí activas planes y funciones y asignas asesores. Esta cuenta no puede abrir las finanzas de ningún restaurante.</p>
  <div class="grid3" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    <section class="panel dato"><div class="label">Restaurantes</div><div class="value">${R.length}</div><div class="note">${R.filter(r => r.suspendido).length ? R.filter(r => r.suspendido).length + ' suspendidos' : 'Todos activos'}</div></section>
    <section class="panel dato"><div class="label">Con Acompañamiento</div><div class="value">${acomp.length}</div><div class="note">${sinAs.length ? `<span class="down">${sinAs.length} sin asesor</span>` : 'Todos con asesor'}</div></section>
    <section class="panel dato"><div class="label">Solicitudes por atender</div><div class="value ${sol.length ? 'down' : ''}">${sol.length}</div><div class="note">Quieren Acompañamiento</div></section>
    <section class="panel dato"><div class="label">Asesores activos</div><div class="value">${A.length}</div><div class="note"><button class="linkbtn" data-a="nav" data-v="asesores">Ver asesores</button></div></section>
  </div>
  ${sol.length ? `<section class="panel"><div class="ph"><div><h2>Solicitudes de Acompañamiento</h2><p>Cuando confirmes el pago, activa el plan y asígnale un asesor.</p></div></div>
    <div class="tablewrap"><table class="t"><thead><tr><th>Restaurante</th><th>Dueño</th><th>Alta</th><th></th></tr></thead><tbody>
    ${sol.map(r => `<tr><td>${h(r.nombre)}<br><span class="hint">${h(r.ciudad || '')}</span></td><td>${h(r.dueno.nombre)}<br><span class="hint">${h(r.dueno.email)}</span></td><td>${r.creado ? fd(String(r.creado).slice(0, 10)) : '—'}</td><td class="right"><div class="acts"><button class="btn sm" data-a="adminEdit" data-id="${r.id}" data-plan="acompanamiento">Activar y asignar asesor</button><button class="btn sec sm" data-a="rechazarSolicitud" data-id="${r.id}">Rechazar</button></div></td></tr>`).join('')}
    </tbody></table></div></section>` : ''}
  <section class="panel"><div class="ph"><div><h2>Restaurantes</h2><p>Plan, asesor, funciones y estado de cada cuenta.</p></div><button class="btn sec sm" data-a="refreshAdmin">Actualizar</button></div>
    <div class="row" style="margin-bottom:12px"><div class="tabs" role="tablist" style="margin:0">${filtros.map(([k, l, n]) => `<button class="tab" role="tab" aria-selected="${f === k}" data-a="adminFiltro" data-v="${k}">${l} (${n})</button>`).join('')}</div><span class="spacer"></span><input type="search" placeholder="Buscar restaurante o dueño" data-adminsearch style="max-width:260px" aria-label="Buscar"></div>
    ${lista.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Restaurante</th><th>Dueño</th><th>Plan</th><th>Asesor</th><th>Estado</th><th></th></tr></thead><tbody>
    ${lista.map(r => { const a = asesorDe(r.asesorId); const o = off(r); return `<tr data-text="${h((r.nombre + ' ' + r.ciudad + ' ' + r.dueno.nombre + ' ' + r.dueno.email).toLowerCase())}">
      <td>${h(r.nombre)}<br><span class="hint">${h(r.ciudad || '')}${r.creado ? ', desde ' + fds(String(r.creado).slice(0, 10)) : ''}</span></td>
      <td>${h(r.dueno.nombre)}<br><span class="hint">${h(r.dueno.email)}</span></td>
      <td>${r.plan === 'acompanamiento' ? '<span class="tag acc">Acompañamiento</span>' : '<span class="tag">Autogestión</span>'}${r.solicitud && r.plan !== 'acompanamiento' ? '<br><span class="tag warn">Pidió Acompañamiento</span>' : ''}${r.funciones && r.funciones.credito ? '<br><span class="tag ok">Crédito activo</span>' : ''}${o.length ? `<br><span class="hint">Apagado: ${h(o.join(', '))}</span>` : ''}</td>
      <td>${r.plan !== 'acompanamiento' ? '<span class="hint">No aplica</span>' : a ? h(a.nombre) : '<span class="tag warn">Sin asesor</span>'}</td>
      <td>${r.suspendido ? '<span class="tag bad">Suspendido</span>' : '<span class="tag ok">Activo</span>'}</td>
      <td class="right"><div class="acts"><button class="btn sec sm" data-a="adminEdit" data-id="${r.id}">Administrar</button></div></td></tr>`; }).join('')}
    </tbody></table></div>` : empty('equipo', f === 'todos' ? 'Todavía no hay restaurantes' : 'No hay restaurantes en este filtro', f === 'todos' ? 'Aparecerán aquí cuando alguien cree su cuenta.' : '')}
  </section>`;
}
function openAdminModal(rid, planPre) {
  const r = ADMIN && ADMIN.restaurantes.find(x => x.id === rid); if (!r) return;
  const plan = planPre || r.plan; const act = ADMIN.asesores.filter(a => a.activo);
  openModal(`<h2>${h(r.nombre)}</h2><p class="muted">${h(r.dueno.nombre)}, ${h(r.dueno.email)}${r.ciudad ? ', ' + h(r.ciudad) : ''}</p>
  <form class="stack mt" data-f="adminRest" data-id="${r.id}">
    <fieldset><legend>Plan</legend>
      ${[['autogestion', 'Autogestión', 'El dueño usa la app por su cuenta.'], ['acompanamiento', 'Acompañamiento', 'Activa cuando confirmes el pago. Incluye asesor.']].map(([k, l, d]) => `<label class="check"><input type="radio" name="plan" value="${k}" ${plan === k ? 'checked' : ''}><span><b>${l}</b><br><span class="muted">${d}</span></span></label>`).join('')}
    </fieldset>
    <fieldset><legend>Asesor asignado</legend>
      <select name="asesorId" ${plan !== 'acompanamiento' ? 'disabled' : ''}><option value="">Sin asignar</option>${act.map(a => `<option value="${a.id}" ${r.asesorId === a.id ? 'selected' : ''}>${h(a.nombre)} (${clientesDe(a.id).length} restaurantes)</option>`).join('')}</select>
      <p class="hint mt">${act.length ? 'Solo aplica con Acompañamiento. El asesor podrá ver los números de este restaurante, sin cambiarlos.' : 'Todavía no hay asesores. Créalos en la sección Asesores.'}</p>
    </fieldset>
    <fieldset><legend>Funciones activas</legend>
      ${(ADMIN.funciones || Object.keys(FN_LBL)).map(k => `<label class="check"><input type="checkbox" name="fn_${k}" ${(k === 'credito' ? r.funciones[k] === true : r.funciones[k] !== false) ? 'checked' : ''}><span><b>${FN_LBL[k] ? FN_LBL[k][0] : k}</b><br><span class="muted">${FN_LBL[k] ? FN_LBL[k][1] : ''}</span></span></label>`).join('')}
    </fieldset>
    <fieldset><legend>Estado de la cuenta</legend>
      <label class="check"><input type="radio" name="estado" value="activo" ${!r.suspendido ? 'checked' : ''}><span><b>Activa</b></span></label>
      <label class="check"><input type="radio" name="estado" value="suspendido" ${r.suspendido ? 'checked' : ''}><span><b>Suspendida</b><br><span class="muted">Nadie del restaurante puede entrar. Sus datos se conservan.</span></span></label>
    </fieldset>
    <div class="actions"><button type="button" class="btn sec" data-a="close">Cancelar</button><button class="btn" type="submit">Guardar cambios</button></div>
  </form>
  <div class="zona-peligro"><div><b>Eliminar esta cuenta</b><p class="hint">Borra el restaurante con todos sus datos y usuarios. No se puede deshacer.</p></div><button class="btn danger sm" data-a="adminBorrarAsk" data-id="${r.id}">Eliminar cuenta</button></div>`);
}
function vAsesores() {
  if (!ADMIN) return `<section class="panel">${empty('equipo', 'Cargando asesores…', '')}</section>`;
  const A = ADMIN.asesores.slice().sort((a, b) => (b.activo - a.activo) || a.nombre.localeCompare(b.nombre));
  return `
  <div class="g75">
    <section class="panel"><div class="ph"><div><h2>Asesores del equipo</h2><p>Cada asesor solo ve los restaurantes que tú le asignas, y solo mientras tengan Acompañamiento.</p></div></div>
      ${A.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Asesor</th><th>Restaurantes asignados</th><th>Estado</th><th></th></tr></thead><tbody>
      ${A.map(a => { const cs = clientesDe(a.id); return `<tr><td>${h(a.nombre)}<br><span class="hint">${h(a.email)}</span></td><td>${cs.length ? h(cs.map(c => c.nombre).join(', ')) : '<span class="hint">Ninguno</span>'}</td><td>${a.activo ? '<span class="tag ok">Activo</span>' : '<span class="tag">Desactivado</span>'}</td><td class="right"><div class="acts">${a.activo ? `<button class="btn danger sm" data-a="adminAsesorToggle" data-id="${a.id}" data-v="0">Desactivar</button>` : `<button class="btn sec sm" data-a="adminAsesorToggle" data-id="${a.id}" data-v="1">Reactivar</button>`}</div></td></tr>`; }).join('')}
      </tbody></table></div>` : empty('equipo', 'Todavía no hay asesores', 'Crea el primero con el formulario.')}
    </section>
    <section class="panel"><div class="ph"><div><h2>Crear asesor</h2><p>Pásale su correo y contraseña; luego puede cambiarla con “Olvidé mi contraseña”.</p></div></div>
      <form class="fields" data-f="adminAsesor">
        <label class="wide">Nombre<input name="nombre" required></label>
        <label class="wide">Correo<input name="email" type="email" required></label>
        <label class="wide">Contraseña para entrar<input name="pass" minlength="6" required></label>
        <div class="form-actions"><button class="btn" type="submit">Crear asesor</button></div>
      </form>
    </section>
  </div>`;
}

/* ============ Comunidad ============ */
function feedPosts() {
  if (MODE === 'cloud') return FEED || [];
  return S.posts.filter(p => p.denuncias < 3).map(p => Object.assign({}, p, { mio: p.autorId === 'yo' }));
}
let feedLoading = false;
async function loadFeed(quiet) {
  if (MODE !== 'cloud' || feedLoading) return; feedLoading = true;
  try { const j = await api('feed'); const changed = JSON.stringify(j.posts) !== JSON.stringify(FEED); FEED = j.posts; if (ui.view === 'comunidad' && (!quiet || changed) && !typingIn('main')) render(); }
  catch (e) { if (!quiet) toast(e.message); }
  finally { feedLoading = false; }
}
function typingIn(sel) { const a = document.activeElement; return a && a.closest && a.closest(sel) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.value; }
function vComunidad() {
  const all = feedPosts(); const cat = ui.cat;
  const posts = all.filter(p => cat === 'Todas' || p.categoria === cat).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const me = USER ? USER.nombre : 'Tú';
  const loading = MODE === 'cloud' && FEED === null;
  return `
  <p class="aviso info">Pregunta y comparte lo que te ha funcionado con otros dueños de restaurantes. <b>Tus números nunca aparecen aquí</b>: solo tu nombre, tu restaurante y tu ciudad.</p>
  <div class="community">
    <aside class="cats" aria-label="Temas">
      ${['Todas'].concat(CATS_COM).map(c => `<button data-a="cat" data-v="${c}" aria-pressed="${cat === c}">${c === 'Todas' ? 'Todos los temas' : c}<span>${c === 'Todas' ? all.length : all.filter(p => p.categoria === c).length}</span></button>`).join('')}
    </aside>
    <div class="stack">
      <div class="row"><input type="search" placeholder="Buscar en la comunidad" data-search style="flex:1;min-width:200px" aria-label="Buscar"><button class="btn" data-a="newPost">${ui.newPost ? 'Cancelar' : icon('mas1') + 'Preguntar o compartir'}</button>${MODE === 'cloud' ? '<button class="btn sec" data-a="refreshFeed">Actualizar</button>' : ''}</div>
      ${ui.newPost ? `<section class="panel"><form class="fields" data-f="post">
        <label class="wide">Título<input name="titulo" maxlength="120" required placeholder="Ej. ¿Cómo controlan la merma de verdura?"></label>
        <label>Tema<select name="categoria">${CATS_COM.map(c => `<option>${c}</option>`).join('')}</select></label>
        <label class="wide">Tu pregunta o experiencia<textarea name="cuerpo" required placeholder="Cuenta qué te pasó o qué quieres saber"></textarea></label>
        <div class="form-actions"><button class="btn" type="submit">Publicar</button></div>
      </form></section>` : ''}
      ${loading ? `<section class="panel">${empty('platica', 'Cargando la comunidad…', '')}</section>` : posts.map(p => `
      <article class="post" data-text="${h((p.titulo + ' ' + p.cuerpo + ' ' + p.restaurante).toLowerCase())}">
        <div class="post-meta"><span class="avatar">${initials(p.autor)}</span><span><b>${h(p.autor)}</b>, ${h(p.restaurante)}${p.ciudad ? ' en ' + h(p.ciudad) : ''}<br>${ago(String(p.fecha).slice(0, 10))}</span><span class="tag acc" style="margin-left:auto">${h(p.categoria)}</span></div>
        <h3>${h(p.titulo)}</h3>
        <p class="body">${h(p.cuerpo)}</p>
        <div class="post-actions">
          <button data-a="util" data-id="${p.id}" aria-pressed="${!!p.miUtil}">${icon('sirvio')}Me sirvió${p.utiles ? ' (' + p.utiles + ')' : ''}</button>
          <button data-a="toggleCom" data-id="${p.id}" aria-pressed="${!!ui.open[p.id]}">${icon('coment')}${p.comentarios.length ? p.comentarios.length + ' comentarios' : 'Comentar'}</button>
          ${isAdmin() ? (p.oculta ? `<span class="tag bad">Oculta${p.denuncias ? ', ' + p.denuncias + ' reportes' : ''}</span><button data-a="modPost" data-v="restaurar" data-id="${p.id}">Volver a mostrar</button><button data-a="modPost" data-v="borrar" data-id="${p.id}">Borrar</button>` : `${p.denuncias ? `<span class="tag warn">${p.denuncias} reportes</span>` : ''}<button data-a="modPost" data-v="ocultar" data-id="${p.id}">Ocultar</button>`) : p.mio ? '' : `<button data-a="report" data-id="${p.id}">${icon('bandera')}Reportar</button>`}
        </div>
        ${ui.open[p.id] ? `<div class="comments">
          ${p.comentarios.map(c => `<div class="comment"><span class="avatar">${initials(c.autor)}</span><div><div class="who"><b>${h(c.autor)}</b>, ${h(c.restaurante)}, ${ago(String(c.fecha).slice(0, 10))}</div><div>${h(c.texto)}</div></div></div>`).join('') || '<p class="hint">Sé el primero en comentar.</p>'}
          <form data-f="comment" data-id="${p.id}" class="row"><input name="texto" placeholder="Comenta como ${h(me)}" required style="flex:1;min-width:200px" aria-label="Comentario"><button class="btn sm" type="submit">Comentar</button></form>
        </div>` : ''}
      </article>`).join('') || `<section class="panel">${empty('platica', cat === 'Todas' ? 'Todavía no hay publicaciones' : 'No hay publicaciones de este tema', 'Haz la primera pregunta: a alguien más le está pasando lo mismo.')}</section>`}
    </div>
  </div>`;
}

/* ============ Asesor ============ */
async function loadMsgs(quiet) {
  if (MODE !== 'cloud' || !S) return;
  try {
    const j = await api('mensajes', VIEWING ? { restauranteId: VIEWING.id } : {});
    const changed = JSON.stringify(j.mensajes) !== JSON.stringify(S.msgs) || JSON.stringify(j.asesor) !== JSON.stringify(S.advisor);
    S.msgs = j.mensajes; S.advisor = Object.assign({ nombre: '', proxima: null }, j.asesor || {});
    if (SNAP) { const m = {}; S.msgs.forEach(r => m[r.id] = JSON.stringify(r)); SNAP.mensajes = m; }
    if (ui.view === 'asesor' && changed && !typingIn('main')) render();
  } catch (e) { if (!quiet) toast(e.message); }
}
function planCTA() {
  if (MODE !== 'cloud') return '<button class="btn" data-a="setPlan" data-v="acompanamiento">Cambiar a Acompañamiento</button>';
  if (S.config.plan === 'acompanamiento') return '<span class="tag ok">Tienes el plan Acompañamiento</span>';
  if (S.solicitud) return '<div class="row"><span class="tag warn">Solicitud enviada</span><span class="hint">El equipo te contactará para confirmar el pago y asignarte un asesor.</span><button class="linkbtn" data-a="solicitarPlan" data-v="cancelar">Cancelar solicitud</button></div>';
  return '<div class="row"><button class="btn" data-a="solicitarPlan">Solicitar Acompañamiento</button><span class="hint">El equipo te contacta y lo activa al confirmar tu pago.</span></div>';
}
function vAsesor() {
  const asesorView = isAsesor() && VIEWING;
  if (!asesorView && S.config.plan !== 'acompanamiento' && !S.msgs.length) return `
  <section class="panel" style="max-width:760px">
    <div class="ph"><div><h2>Tu plan actual es Autogestión</h2><p>Con Acompañamiento tienes a una persona del equipo que revisa tus números contigo cada mes, te avisa antes de que haya un problema y te ayuda a decidir compras, retiros y pagos.</p></div></div>
    <table class="t" data-nocards><thead><tr><th></th><th>Autogestión</th><th>Acompañamiento</th></tr></thead><tbody>
      <tr><td>Tu dinero, pagos, nómina, compras y proyecciones</td><td>Sí</td><td>Sí</td></tr>
      <tr><td>Alertas, simulador y comunidad</td><td>Sí</td><td>Sí</td></tr>
      <tr><td>Asesor que te escribe y revisa contigo cada mes</td><td>No</td><td>Sí</td></tr>
      <tr><td>Plan de promociones según tus ventas reales</td><td>No</td><td>Sí</td></tr>
      <tr><td>Acceso prioritario a financiamiento</td><td>No</td><td>Sí</td></tr>
      <tr><td><b>Precio</b></td><td>Desde $349 al mes</td><td>Desde $890 al mes</td></tr>
    </tbody></table>
    ${isOwner() ? `<div class="mt">${planCTA()}</div>` : ''}
  </section>`;
  const A = S.advisor || {}; const prox = A.proxima ? String(A.proxima).split('T') : null;
  const meDe = asesorView ? 'asesor' : 'dueno';
  const otro = asesorView ? S.restaurant.nombre : (A.nombre || 'Tu asesor');
  return `
  <div class="g48">
    <section class="panel stack">
      <div class="row" style="flex-wrap:nowrap"><span class="avatar" style="width:48px;height:48px;font-size:1rem">${initials(otro)}</span><div><h2>${h(otro)}</h2><p class="muted small">${asesorView ? 'Tu cliente' : A.nombre ? 'Tu asesor del equipo .Py México' : 'Te asignaremos un asesor pronto'}</p></div></div>
      <div><p class="muted small">Próxima sesión</p><p><b>${prox ? cap(fdl(prox[0])) + (prox[1] ? ', ' + prox[1] + ' h' : '') : 'Sin agendar'}</b></p><p class="hint">Videollamada de 45 minutos para revisar el mes.</p></div>
      ${asesorView ? `<form class="fields" data-f="advSession"><label>Agendar sesión<input name="fecha" type="date" value="${prox ? prox[0] : addD(today(), 3)}" required></label><label>Hora<input name="hora" type="time" value="${prox && prox[1] ? prox[1] : '17:00'}" required></label><div class="form-actions"><button class="btn sec" type="submit">Guardar sesión</button></div></form>` : `<div><p class="muted small">Qué revisan juntos</p><ul class="small" style="margin:4px 0 0;padding-left:18px"><li>Tu dinero disponible y las alertas</li><li>Merma y compras de perecederos</li><li>Promociones según lo que más vendes</li><li>Cuánto puedes retirar sin riesgo</li></ul></div>`}
      <p class="hint">${asesorView ? 'Solo tú y el dueño ven esta conversación.' : 'Tu asesor puede ver tus números para ayudarte. Nadie más de la comunidad los ve.'}</p>
    </section>
    <section class="panel"><div class="ph"><h2>Mensajes</h2>${MODE === 'cloud' ? '<button class="btn sec sm" data-a="refreshMsgs">Actualizar</button>' : ''}</div>
      <div class="thread" id="thread">${S.msgs.length ? S.msgs.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map(m => `<div class="msg ${m.de === meDe ? 'me' : ''}">${h(m.texto)}<span class="when">${m.de === meDe ? 'Tú' : h(m.autor || (m.de === 'asesor' ? 'Asesor' : 'Dueño'))}, ${ago(String(m.fecha).slice(0, 10))}</span></div>`).join('') : empty('platica', 'Aún no hay mensajes', asesorView ? 'Escríbele para presentarte.' : 'Escríbele a tu asesor cualquier duda sobre tu negocio.')}</div>
      <form data-f="msg" class="row mt"><input name="texto" placeholder="${asesorView ? 'Escribe al dueño' : 'Escribe a tu asesor'}" required style="flex:1;min-width:200px" aria-label="Mensaje"><button class="btn" type="submit">Enviar</button></form>
    </section>
  </div>`;
}
async function loadClientes() {
  if (MODE !== 'cloud' || !isAsesor()) return;
  try { const j = await api('clientes'); CLIENTES = j.clientes; if (ui.view === 'clientes') render(); } catch (e) { toast(e.message); }
}
function vClientes() {
  if (CLIENTES === null) return `<section class="panel">${empty('equipo', 'Cargando tus clientes…', '')}</section>`;
  const card = c => `<tr><td>${h(c.nombre)}<br><span class="hint">${h(c.ciudad || '')}</span></td><td>${c.ultimo ? `${c.ultimo.de === 'dueno' ? '<span class="tag warn">Te escribió</span> ' : ''}<span class="small">${h(String(c.ultimo.texto).slice(0, 70))}${String(c.ultimo.texto).length > 70 ? '…' : ''}</span><br><span class="hint">${ago(String(c.ultimo.fecha).slice(0, 10))}</span>` : '<span class="hint">Sin mensajes</span>'}</td><td>${c.proxima ? fds(String(c.proxima).slice(0, 10)) : '—'}</td><td class="right"><div class="acts"><button class="btn sm" data-a="openCliente" data-id="${c.id}">Abrir</button></div></td></tr>`;
  return `
  <section class="panel"><div class="ph"><div><h2>Tus restaurantes</h2><p>Los que el administrador te asignó. Ábrelos para revisar sus números, ver sus alertas y escribirles.</p></div><button class="btn sec sm" data-a="refreshClientes">Actualizar</button></div>
    ${CLIENTES.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Restaurante</th><th>Último mensaje</th><th>Próxima sesión</th><th></th></tr></thead><tbody>${CLIENTES.map(card).join('')}</tbody></table></div>` : empty('equipo', 'Todavía no tienes restaurantes asignados', 'Cuando el administrador te asigne uno con plan Acompañamiento, aparecerá aquí.')}
  </section>`;
}

/* ============ Configuración ============ */
async function loadTeam() { try { const j = await api('equipo'); TEAM = j.equipo; if (ui.view === 'config') render(); } catch (e) { } }
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
function vConfig() {
  const c = S ? S.config : {}, r = S ? S.restaurant : {};
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const cuenta = `<section class="panel"><div class="ph"><h2>Tu cuenta</h2></div>
    <p><b>${h(USER.nombre)}</b><br><span class="muted">${h(USER.email || '')}</span></p>
    <p class="hint mt">${isAdmin() ? 'Eres administrador: activas planes y funciones y asignas asesores. No puedes ver las finanzas de los restaurantes.' : isAsesor() ? 'Eres asesor del equipo .Py México: solo ves los restaurantes que te asignaron.' : isStaff() ? 'Eres encargado: puedes registrar ventas, cortes, compras y cierres.' : 'Eres el dueño de este restaurante.'} ${MODE === 'cloud' ? 'Tus datos se guardan en la nube.' : 'Tus datos se guardan solo en este equipo.'}</p>
    <div class="row mt"><button class="btn sec" data-a="logout">${icon('salir')}Cerrar sesión</button></div></section>`;
  const instalar = `<section class="panel"><div class="ph"><div><h2>Instalar la app</h2><p>Tenla con su ícono en tu celular, iPad o computadora, sin pasar por la tienda de apps.</p></div></div>
    ${standalone ? '<p class="tag ok">Ya la estás usando instalada</p>' : deferredInstall ? '<button class="btn" data-a="install">Instalar .Py México</button>' : ios ? '<p>En iPhone o iPad: abre esta página en Safari, toca el botón de compartir y elige <b>Agregar a pantalla de inicio</b>.</p>' : '<p>En Chrome o Edge: busca el ícono de instalar en la barra de direcciones. En Android: menú de tres puntos y <b>Instalar app</b>.</p>'}</section>`;
  const tema = `<section class="panel"><div class="ph"><h2>Apariencia</h2></div>
    <div class="seg" role="group" aria-label="Tema">${[['sistema', 'Como mi equipo'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([k, l]) => `<button data-a="tema" data-v="${k}" aria-pressed="${ui.tema === k}">${l}</button>`).join('')}</div>
    <p class="hint mt">${ui.tourDone ? '<button class="linkbtn" data-a="tourAgain">Ver otra vez el recorrido de bienvenida</button>' : ''}</p></section>`;
  const priv = `<section class="panel"><div class="ph"><div><h2>Privacidad</h2><p>Qué datos guardamos, quién puede verlos y cómo borrarlos.</p></div></div>
    <a class="btn sec" href="privacidad.html" target="_blank" rel="noopener">${icon('escudo')}Leer el aviso de privacidad</a>
    ${isOwner() && MODE === 'cloud' ? `<div class="mt2"><p class="small"><b>Borrar mi cuenta.</b> Se borran tu restaurante, tus registros, los accesos de tu equipo y tus publicaciones. No se puede deshacer.</p><button class="btn danger mt" data-a="borrarCuenta">Borrar mi cuenta y mis datos</button></div>` : ''}</section>`;
  if (!isOwner() || !S) return `<div class="grid2">${cuenta}${priv}${instalar}${tema}</div>`;
  return `
  <div class="grid2">
    <section class="panel"><div class="ph"><h2>Tu restaurante</h2></div>
      <form class="fields" data-f="cfgRest">
        <label class="wide">Nombre<input name="nombre" value="${h(r.nombre)}" required></label>
        <label>Ciudad<input name="ciudad" value="${h(r.ciudad)}"></label>
        <label>Giro<input name="giro" value="${h(r.giro || '')}" placeholder="Ej. Taquería"></label>
        <div class="form-actions"><button class="btn sec" type="submit">Guardar</button></div>
      </form>
    </section>
    <section class="panel"><div class="ph"><h2>Cómo calculamos tu dinero</h2></div>
      <form class="fields" data-f="cfgFin">
        <label>Saldo con el que empezaste<input id="cfgSaldo" name="saldoInicial" type="number" step="1" value="${c.saldoInicial}"></label>
        <label>Días de pagos a apartar<input name="dias" type="number" min="1" max="30" value="${c.diasCompromisos}"></label>
        <label>Margen para semáforo verde<input name="umbral" type="number" min="0" value="${c.umbralVerde}"></label>
        <label>% estimado de cuotas en nómina<input name="cuotas" type="number" min="0" max="60" step="0.5" value="${c.cuotasPct}"></label>
        <div class="form-actions"><button class="btn sec" type="submit">Guardar</button></div>
      </form>
      <details class="qs"><summary>¿Qué es cada cosa?</summary><ul><li><b>Saldo con el que empezaste:</b> lo que tenías en banco y caja el día que empezaste a usar la app.</li><li><b>Días de pagos a apartar:</b> cuántos días hacia adelante se descuentan de tu dinero disponible.</li><li><b>Margen para verde:</b> desde cuánto dinero libre el semáforo se pone en verde.</li></ul></details>
    </section>
    <section class="panel"><div class="ph"><h2>Tu plan</h2></div>
      ${MODE === 'cloud' ? `<p><b>${c.plan === 'acompanamiento' ? 'Acompañamiento' : 'Autogestión'}</b></p><p class="hint">${c.plan === 'acompanamiento' ? (S.advisor && S.advisor.nombre ? 'Tu asesor es ' + h(S.advisor.nombre) + '.' : 'Pronto te asignaremos un asesor.') : 'Tú llevas el control con la app. Con Acompañamiento, una persona del equipo revisa tus números contigo cada mes.'}</p><div class="mt">${planCTA()}</div>`
      : `<div class="stack">${[['autogestion', 'Autogestión', 'Tú llevas el control con la app. Desde $349 al mes.'], ['acompanamiento', 'Acompañamiento', 'Incluye un asesor que te escribe y revisa contigo cada mes. Desde $890 al mes.']].map(([k, l, d]) => `<label style="flex-direction:row;gap:10px;align-items:flex-start;color:var(--ink);font-weight:500"><input type="radio" name="plan" value="${k}" ${c.plan === k ? 'checked' : ''} data-a-change="plan" style="margin-top:5px"><span><b>${l}</b><br><span class="muted">${d}</span></span></label>`).join('')}</div>`}
    </section>
    ${MODE === 'cloud' && S.funciones.equipo !== false ? `<section class="panel"><div class="ph"><div><h2>Tu equipo en la app</h2><p>Dale acceso a tu encargado o cajera. Pueden registrar ventas, cortes, compras y cierres, pero no ven nómina, retiros ni tu dinero disponible.</p></div></div>
      ${TEAM === null ? '<p class="hint">Cargando…</p>' : TEAM.length ? `<table class="t"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th></th></tr></thead><tbody>${TEAM.map(m => `<tr><td>${h(m.nombre)}</td><td>${h(m.email)}</td><td>${m.rol === 'dueno' ? 'Dueño' : 'Encargado'}</td><td class="right"><div class="acts">${m.rol === 'staff' ? `<button class="btn danger sm" data-a="removeMember" data-id="${m.id}">Quitar acceso</button>` : ''}</div></td></tr>`).join('')}</tbody></table>` : ''}
      <form class="fields mt" data-f="invite"><label>Nombre<input name="nombre" required></label><label>Correo<input name="email" type="email" required></label><label>Contraseña para entrar<input name="pass" minlength="6" required></label><div class="form-actions"><button class="btn sec" type="submit">Dar acceso</button></div></form>
      <p class="hint mt">Pásale su correo y contraseña; puede cambiar la contraseña con “Olvidé mi contraseña”.</p></section>` : ''}
    ${cuenta}${priv}${instalar}${tema}
    <section class="panel"><div class="ph"><div><h2>Datos de ejemplo</h2><p>Para practicar o presentar: carga tres meses de datos de una taquería en tu cuenta, o empieza en blanco.</p></div></div>
      <div class="row"><button class="btn sec" data-a="resetDemo">Cargar datos de ejemplo</button><button class="btn danger" data-a="wipe">Borrar todos mis datos</button></div>
      ${MODE === 'cloud' ? '<p class="hint mt">Esto reemplaza lo que tienes guardado en la nube para este restaurante.</p>' : ''}</section>
  </div>`;
}

/* ============ Avisos, modales y menú ============ */
function openModal(html) { closeModal(); const o = document.createElement('div'); o.className = 'overlay'; o.id = 'overlay'; o.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(o); const f = o.querySelector('input,select,textarea,button'); if (f) f.focus(); }
function closeModal() { const o = document.getElementById('overlay'); if (o) o.remove(); const s = document.getElementById('sheet'); if (s) s.remove(); }
let toastT = null;
function toast(msg) { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3400); }
function csvModal(title, csv) { openModal(`<h2>${h(title)}</h2><p class="hint">Copia el texto y pégalo donde lo necesites.</p><textarea id="csvBox" style="min-height:220px;font-size:.88rem" readonly>${h(csv)}</textarea><div class="actions"><button class="btn sec" data-a="close">Cerrar</button><button class="btn" data-a="copyCsv">Copiar</button></div>`); }
function copyText(t, ok) { try { navigator.clipboard.writeText(t).then(() => toast(ok || 'Copiado'), () => csvModal('Copia el texto', t)); } catch (e) { csvModal('Copia el texto', t); } }
function openSheet() {
  closeModal(); const v = ui.view;
  const o = document.createElement('div'); o.className = 'overlay'; o.id = 'overlay'; o.style.alignItems = 'flex-end'; o.style.padding = '0';
  o.innerHTML = `<div class="sheet" role="dialog" aria-label="Todas las secciones"><nav class="nav">${navGroups().map(([g, items]) => `<div class="navgroup"><span>${g}</span>${items.map(([k, l]) => `<button class="navbtn" data-a="nav" data-v="${k}" ${k === v ? 'aria-current="page"' : ''}>${icon(ICON_OF[k])}${l}</button>`).join('')}</div>`).join('')}</nav>
    <div class="row mt" style="justify-content:space-between"><span class="hint">${h(USER.nombre)}</span><button class="btn sec sm" data-a="logout">${icon('salir')}Cerrar sesión</button></div></div>`;
  document.body.appendChild(o);
}

/* ============ Acciones ============ */
const RO_OK = new Set(['nav', 'more', 'close', 'avisos', 'avGo', 'simFromAlert', 'simPreset', 'simReset', 'simRange', 'range', 'calMonth', 'calDay', 'copyPedido', 'copyCsv', 'csvReport', 'csvSales', 'print', 'cat', 'toggleCom', 'vtab', 'ptab', 'etab', 'gtab', 'logout', 'backClientes', 'openCliente', 'refreshFeed', 'refreshMsgs', 'refreshClientes', 'tema', 'util', 'report', 'newPost', 'viewPayroll', 'goNomina', 'goSugerida', 'goCierre', 'tourNext', 'tourEnd', 'install', 'copyPromo']);
const actions = {
  nav: el => go(el.dataset.v),
  more: () => openSheet(),
  goNomina: () => { ui.eTab = 'nomina'; go('nomina'); },
  goCierre: () => { ui.pTab = 'cierre'; ui.closeDate = addD(today(), -1); go('perecederos'); },
  goSugerida: () => { ui.pTab = 'sugerida'; go('perecederos'); },
  goFijos: () => { ui.gTab = 'fijos'; go('pagos'); },
  goEquipo: () => { ui.eTab = 'equipo'; go('nomina'); },
  goCatalogo: () => { ui.pTab = 'catalogo'; go('perecederos'); },
  goReserva: () => go('reserva'),
  vtab: el => { ui.vTab = el.dataset.v; render(); },
  ptab: el => { ui.pTab = el.dataset.v; render(); },
  etab: el => { ui.eTab = el.dataset.v; render(); },
  gtab: el => { ui.gTab = el.dataset.v; render(); },
  tourNext: () => { ui.tourStep = (ui.tourStep || 0) + 1; if (ui.tourStep >= TOUR.length) endTour(); else showTour(); },
  tourEnd: () => endTour(),
  tourAgain: () => { ui.tourDone = false; ui.tourStep = 0; saveUI(); go('inicio'); },
  avisos: () => { const av = avisos(); openModal(`<h2>Avisos</h2>${av.length ? `<ul class="avlist">${av.map((x, i) => `<li class="av-${x.k}"><div><b>${h(x.t)}</b><p class="small muted">${h(x.d)}</p></div><button class="btn sec sm" data-a="avGo" data-i="${i}">${h(x.l)}</button></li>`).join('')}</ul>` : empty('calendario', 'Todo en orden', 'No tienes avisos pendientes.')}<div class="actions"><button class="btn sec" data-a="close">Cerrar</button></div>`); },
  avGo: el => { const x = avisos()[Number(el.dataset.i)]; closeModal(); if (!x) return; if (x.a === 'nav') go(x.v); else actions[x.a]({ dataset: {} }); },
  simFromAlert: () => { const s = soluciones(alerta()); ui.sim = s.length ? Object.assign(SIM0(), s[0].sim) : SIM0(); go('simulador'); },
  simPreset: el => { const s = (ui.sols || [])[Number(el.dataset.i)]; ui.sim = Object.assign(SIM0(), s ? s.sim : {}); go('simulador'); },
  simReset: () => { ui.sim = SIM0(); render(); },
  simRange: el => { ui.simRange = Number(el.dataset.v); document.getElementById('simOut').innerHTML = simOut(); },
  range: el => { ui.range = Number(el.dataset.v); saveUI(); render(); },
  retiro: el => openModal(`<h2>Registrar retiro</h2><p class="muted">Según tu proyección, hoy puedes sacar hasta ${money(Number(el.dataset.v))} sin poner en riesgo tus pagos ni tu fondo de reserva.</p><form class="fields mt" data-f="retiro"><label>Monto<input name="monto" type="number" min="1" value="${el.dataset.v}" required inputmode="numeric"></label><div class="wide actions"><button type="button" class="btn sec" data-a="close">Cancelar</button><button class="btn" type="submit">Registrar retiro</button></div></form>`),
  calMonth: el => { ui.calMonth = el.dataset.v; render(); },
  calDay: el => { const d = el.dataset.v; const pp = pendientes().concat(nominaEstimada(45)).filter(p => p.vence === d); const pg = S.payables.filter(p => p.estado === 'pagado' && p.pagadoEl === d); openModal(`<h2>${cap(fdl(d))}</h2>${pp.length ? `<h3 class="mt">Por pagar</h3><div class="stack mt">${pp.map(itemRow).join('')}</div>` : ''}${pg.length ? `<h3 class="mt2">Pagado</h3><table class="t mt" data-nocards><tbody>${pg.map(p => `<tr><td>${h(p.concepto)}</td><td class="num">${money(p.monto)}</td></tr>`).join('')}</tbody></table>` : ''}${!pp.length && !pg.length ? empty('calendario', 'No hay pagos este día', '') : ''}<div class="actions"><button class="btn sec" data-a="close">Cerrar</button></div>`); },
  copyPedido: el => { const o = (ui.pedidos || {})[el.dataset.v]; if (o) copyText(pedidoTxt(el.dataset.v, o.rs), 'Pedido copiado'); },
  copyPromo: () => { const t = document.querySelector('[data-promo-preview]'); if (t) copyText(t.textContent, 'Mensaje copiado'); },
  togglePromo: el => { const p = S.promos.find(x => x.id === el.dataset.id); p.activa = !p.activa; commit(p.activa ? 'Promoción activada' : 'Promoción en pausa'); },
  solicitar: () => openModal(`<h2>Solicitud de crédito</h2><p>En la versión final, con tu autorización, enviaríamos tu historial de ventas y pagos a una institución aliada para que te haga una propuesta. Nunca se comparte sin tu permiso.</p><div class="actions"><button class="btn" data-a="close">Entendido</button></div>`),
  loginTab: el => { ui.loginTab = el.dataset.v; ui.loginError = ''; ui.loginOk = ''; ui.recStep = false; render(); },
  toSignup: () => { USER = null; S = null; MODE = null; if (LOCAL) { LOCAL.session = false; LS.set(K_LOCAL, LOCAL); } ui.loginTab = 'crear'; render(); },
  demo: () => {
    let L = LS.get(K_LOCAL, null);
    if (!L || !L.account || !L.account.demo || L.ver !== 3) { L = { account: { nombre: 'Lupita Hernández', email: 'demo@pymexico.mx', demo: true }, data: seedDemo(), ver: 3 }; }
    L.session = true; LOCAL = L; LS.set(K_LOCAL, L); MODE = 'local'; USER = { id: 'yo', nombre: L.account.nombre, email: L.account.email, rol: 'dueno' }; S = L.data; READONLY = false; VIEWING = null;
    ui.view = 'inicio'; saveUI(); render();
  },
  quickSale: () => { ui.view = 'ventas'; ui.vTab = 'registro'; ui.focus = 'saleMonto'; saveUI(); render(); window.scrollTo(0, 0); },
  quickPay: () => openModal(`<h2>Registrar pago</h2><form class="fields" data-f="payable">
      <label class="wide">Concepto<input name="concepto" required placeholder="Ej. Reparación del refrigerador"></label>
      <label>Categoría<select name="categoria">${CATS_PAGO.map(c => `<option>${c}</option>`).join('')}</select></label>
      <label>Monto<input name="monto" type="number" min="1" required inputmode="numeric"></label>
      <label>Fecha<input name="vence" type="date" value="${today()}" required></label>
      <label>¿Ya lo pagaste?<select name="estado"><option value="pendiente">No, está pendiente</option><option value="pagado">Sí, ya lo pagué</option></select></label>
      <div class="wide actions"><button type="button" class="btn sec" data-a="close">Cancelar</button><button class="btn" type="submit">Registrar pago</button></div></form>`),
  close: () => closeModal(),
  markPaid: el => { const p = S.payables.find(x => x.id === el.dataset.id); if (!p) return; openModal(`<h2>Marcar como pagado</h2><p class="muted">${h(p.concepto)}</p><form class="fields mt" data-f="pay" data-id="${p.id}"><label>Monto pagado<input name="monto" type="number" min="1" value="${p.monto}" required inputmode="numeric"></label><label>Fecha de pago<input name="fecha" type="date" value="${today()}" max="${today()}" required></label><div class="wide actions"><button type="button" class="btn sec" data-a="close">Cancelar</button><button class="btn" type="submit">Marcar pagado</button></div></form>`); },
  unpay: el => { const p = S.payables.find(x => x.id === el.dataset.id); if (!p) return; p.estado = 'pendiente'; delete p.pagadoEl; if (p.payrollId) { const pr = S.payrolls.find(x => x.id === p.payrollId); if (pr) pr.estado = 'pendiente'; } commit('El pago volvió a pendientes'); },
  delPay: el => { if (!confirm('¿Eliminar este pago?')) return; S.payables = S.payables.filter(p => p.id !== el.dataset.id); commit('Pago eliminado'); },
  delSale: el => { if (!confirm('¿Eliminar esta venta?')) return; S.sales = S.sales.filter(s => s.id !== el.dataset.id); commit('Venta eliminada'); },
  importCsv: () => openModal(`<h2>Importar ventas</h2><p class="hint">Exporta las ventas de tu punto de venta o de Excel y pega aquí el contenido: fecha, monto y forma de pago, una venta por línea. Fechas como 01/10/2026 o 2026-10-01.</p><textarea id="csvIn" style="min-height:180px" placeholder="fecha,monto,forma de pago&#10;01/10/2026,8450,Tarjeta&#10;01/10/2026,3200,Efectivo"></textarea><p id="csvPrev" class="hint mt"></p><div class="actions"><button class="btn sec" data-a="close">Cancelar</button><button class="btn sec" data-a="csvPreview">Revisar</button><button class="btn" data-a="csvImport">Importar</button></div>`),
  csvPreview: () => { const r = parseCsv(document.getElementById('csvIn').value); document.getElementById('csvPrev').innerHTML = `${r.ok.length} ventas válidas por ${money(sum(r.ok, 'monto'))}.${r.bad ? ` ${r.bad} líneas no se pudieron leer y se omitirán.` : ''}`; },
  csvImport: () => { const r = parseCsv(document.getElementById('csvIn').value); if (!r.ok.length) { document.getElementById('csvPrev').textContent = 'No encontramos ventas válidas. Revisa que cada línea tenga fecha y monto.'; return; } r.ok.forEach(s => S.sales.push({ id: uid(), ...s })); closeModal(); commit(r.ok.length + ' ventas importadas'); },
  delPurchase: el => { if (!confirm('¿Eliminar esta compra? También se elimina su pago.')) return; S.purchases = S.purchases.filter(p => p.id !== el.dataset.id); S.payables = S.payables.filter(p => p.key !== 'comp:' + el.dataset.id); commit('Compra eliminada'); },
  delProduct: el => { if (!confirm('¿Eliminar este producto? Las compras registradas se conservan.')) return; S.products = S.products.filter(p => p.id !== el.dataset.id); commit('Producto eliminado'); },
  delSupplier: el => { if (!confirm('¿Eliminar este proveedor?')) return; S.suppliers = S.suppliers.filter(p => p.id !== el.dataset.id); commit('Proveedor eliminado'); },
  editEmp: el => { const e = S.employees.find(x => x.id === el.dataset.id); openModal(`<h2>Editar</h2><form class="fields" data-f="employee"><input type="hidden" name="id" value="${e.id}"><label class="wide">Nombre completo<input name="nombre" value="${h(e.nombre)}" required></label><label>Puesto<input name="puesto" value="${h(e.puesto)}" required></label><label>Sueldo por periodo<input name="sueldo" type="number" min="1" value="${e.sueldo}" required></label><label>Se le paga<select name="periodicidad"><option value="semanal" ${e.periodicidad === 'semanal' ? 'selected' : ''}>Cada semana</option><option value="quincenal" ${e.periodicidad === 'quincenal' ? 'selected' : ''}>Cada quincena</option></select></label><label>Fecha de ingreso<input name="ingreso" type="date" value="${e.ingreso}" required></label><div class="wide actions"><button type="button" class="btn sec" data-a="close">Cancelar</button><button class="btn" type="submit">Guardar cambios</button></div></form>`); },
  toggleEmp: el => { const e = S.employees.find(x => x.id === el.dataset.id); e.activo = !e.activo; commit(e.activo ? 'Reactivado' : 'Dado de baja'); },
  viewPayroll: el => { const p = S.payrolls.find(x => x.id === el.dataset.id); openModal(`<h2>Nómina del ${fd(p.fechaPago)}</h2><p class="muted">Del ${fd(p.inicio)} al ${fd(p.fin)}</p><div class="tablewrap mt"><table class="t" data-nocards><thead><tr><th>Persona</th><th class="num">Días</th><th class="num">Bonos</th><th class="num">Descuentos</th><th class="num">Neto</th></tr></thead><tbody>${p.items.map(i => `<tr><td>${h(i.nombre)}</td><td class="num">${num(i.dias)}</td><td class="num">${money(i.bonos)}</td><td class="num">${money(i.deducciones)}</td><td class="num">${money(i.neto)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="4">Total</td><td class="num">${money(p.total)}</td></tr></tfoot></table></div><div class="actions"><button class="btn" data-a="close">Cerrar</button></div>`); },
  editRec: el => { const r = S.recurring.find(x => x.id === el.dataset.id); openModal(`<h2>Editar gasto fijo</h2>${recForm(r)}<div class="actions"><button class="btn sec" data-a="close">Cancelar</button></div>`); },
  toggleRec: el => { const r = S.recurring.find(x => x.id === el.dataset.id); r.activo = !r.activo; if (!r.activo) clearFutureRec(r.id); commit(r.activo ? 'Gasto fijo activado' : 'Gasto fijo en pausa'); },
  delRec: el => { if (!confirm('¿Eliminar este gasto fijo? Se quitan sus pagos pendientes futuros; los pagados se conservan.')) return; clearFutureRec(el.dataset.id); S.recurring = S.recurring.filter(r => r.id !== el.dataset.id); commit('Gasto fijo eliminado'); },
  cat: el => { ui.cat = el.dataset.v; render(); },
  newPost: () => { ui.newPost = !ui.newPost; render(); },
  toggleCom: el => { ui.open[el.dataset.id] = !ui.open[el.dataset.id]; render(); },
  util: async el => {
    if (MODE === 'cloud') { try { await api('votar', { postId: el.dataset.id }); loadFeed(); } catch (e) { toast(e.message); } return; }
    const p = S.posts.find(x => x.id === el.dataset.id); p.miUtil = !p.miUtil; p.utiles += p.miUtil ? 1 : -1; commit();
  },
  report: async el => {
    if (!confirm('¿Reportar esta publicación por contenido inapropiado? Se oculta si varios dueños la reportan.')) return;
    if (MODE === 'cloud') { try { await api('reportar', { postId: el.dataset.id }); toast('Gracias. Revisaremos la publicación.'); loadFeed(); } catch (e) { toast(e.message); } return; }
    const p = S.posts.find(x => x.id === el.dataset.id); p.denuncias++; commit('Gracias. Revisaremos la publicación.');
  },
  refreshFeed: () => { loadFeed(); toast('Comunidad actualizada'); },
  refreshMsgs: () => loadMsgs(),
  refreshClientes: () => { CLIENTES = null; render(); loadClientes(); },
  openCliente: async el => { try { await loadRestaurant(el.dataset.id, true); ui.view = 'inicio'; render(); window.scrollTo(0, 0); } catch (e) { BOOTING = null; render(); toast(e.message); } },
  backClientes: () => { S = null; READONLY = false; VIEWING = null; SNAP = null; ui.view = 'clientes'; render(); loadClientes(); },
  setPlan: el => { S.config.plan = el.dataset.v; commit('Plan actualizado'); },
  solicitarPlan: async el => {
    const cancelar = el.dataset.v === 'cancelar';
    try { const j = await api('solicitarPlan', { cancelar }); S.solicitud = j.solicitud; render(); toast(cancelar ? 'Solicitud cancelada' : 'Listo. El equipo te contactará para activar Acompañamiento.'); } catch (e) { toast(e.message); }
  },
  borrarCuenta: () => openModal(`<h2>Borrar mi cuenta</h2><p>Se borrarán <b>${h(S.restaurant.nombre)}</b>, todos tus registros, los accesos de tu equipo, tus mensajes y tus publicaciones en la comunidad. No se puede deshacer.</p><form class="fields mt" data-f="borrarCuenta"><label class="wide">Escribe tu contraseña para confirmar<input name="pass" type="password" required autocomplete="current-password"></label><div class="wide actions"><button type="button" class="btn sec" data-a="close">Cancelar</button><button class="btn danger" type="submit">Borrar todo</button></div></form>`),
  refreshAdmin: () => { ADMIN = null; render(); loadAdmin(); },
  adminFiltro: el => { ui.adminFiltro = el.dataset.v; render(); },
  adminEdit: el => openAdminModal(el.dataset.id, el.dataset.plan),
  adminAsesorToggle: async el => {
    const activo = el.dataset.v === '1';
    if (!activo && !confirm('¿Desactivar a este asesor? Ya no podrá entrar y sus restaurantes quedarán sin asesor asignado.')) return;
    try { await api('adminAsesorActivo', { userId: el.dataset.id, activo }); toast(activo ? 'Asesor reactivado' : 'Asesor desactivado'); loadAdmin(); } catch (e) { toast(e.message); }
  },
  rechazarSolicitud: async el => { if (!confirm('¿Rechazar la solicitud de Acompañamiento?')) return; try { await api('adminRestaurante', { restauranteId: el.dataset.id, rechazarSolicitud: true }); toast('Solicitud rechazada'); loadAdmin(); } catch (e) { toast(e.message); } },
  modPost: async el => {
    const accion = el.dataset.v;
    if (accion === 'borrar' && !confirm('¿Borrar esta publicación y sus comentarios? No se puede deshacer.')) return;
    try { await api('adminPost', { postId: el.dataset.id, accion }); toast({ ocultar: 'Publicación oculta', restaurar: 'Publicación visible otra vez', borrar: 'Publicación borrada' }[accion]); loadFeed(); } catch (e) { toast(e.message); }
  },
  tema: el => { ui.tema = el.dataset.v; saveUI(); render(); },
  install: async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; render(); },
  removeMember: async el => { if (!confirm('¿Quitar el acceso a esta persona?')) return; try { await api('quitar', { userId: el.dataset.id }); toast('Acceso quitado'); loadTeam(); } catch (e) { toast(e.message); } },
  resetDemo: async () => {
    if (!confirm('Se reemplazarán tus datos por tres meses de datos de ejemplo. ¿Continuar?')) return;
    const keep = S.restaurant; const D = seedDemo();
    if (MODE === 'cloud') { D.restaurant = Object.assign({}, keep); D.config.plan = S.config.plan; D.posts = []; await replaceAll(D, 'Datos de ejemplo cargados'); }
    else { LOCAL.data = D; S = D; commit('Datos de ejemplo cargados'); }
  },
  wipe: async () => {
    if (!confirm('Se borrarán tus ventas, compras, equipo, pagos y demás registros. ¿Continuar?')) return;
    const D = blankData(S.restaurant); D.config.plan = S.config.plan;
    if (MODE === 'cloud') await replaceAll(D, 'Datos borrados');
    else { LOCAL.data = D; S = D; commit('Datos borrados'); }
  },
  logout: async () => {
    closeModal(); endTourSilently();
    if (MODE === 'cloud') { try { await flush(); } catch (e) { } try { await api('salir'); } catch (e) { } SESSION = null; LS.del(K_SES); }
    else if (LOCAL) { LOCAL.session = false; LS.set(K_LOCAL, LOCAL); }
    USER = null; S = null; MODE = null; READONLY = false; VIEWING = null; FEED = null; CLIENTES = null; TEAM = null; ADMIN = null; ui.loginTab = 'entrar'; ui.loginError = ''; render();
  },
  csvReport: el => { const mk = el.dataset.v, r = reportData(mk); const lines = ['concepto,monto', 'Ventas,' + Math.round(r.ventas)]; Object.entries(r.byCat).forEach(([c, v]) => { if (v) lines.push(c + ',' + Math.round(-v)); }); lines.push('Merma (informativo),' + Math.round(r.merma)); csvModal('Resumen de ' + monthName(mk), lines.join('\n')); },
  csvSales: el => { const mk = el.dataset.v; const rows = S.sales.filter(s => monthKey(s.fecha) === mk).sort((a, b) => a.fecha.localeCompare(b.fecha)); csvModal('Ventas de ' + monthName(mk), ['fecha,monto,forma de pago'].concat(rows.map(s => fd(s.fecha) + ',' + s.monto + ',' + s.metodo)).join('\n')); },
  copyCsv: () => { const t = document.getElementById('csvBox'); t.select(); copyText(t.value); },
  print: () => window.print()
};
function endTourSilently() { const t = document.getElementById('tour'); if (t) t.remove(); }
async function replaceAll(D, msg) {
  try {
    BOOTING = 'Guardando en la nube…'; render();
    await api('reemplazar', { cols: allCols(D), restaurante: (() => { const prev = S; S = D; const r = restOf(); S = prev; return r; })() });
    LS.set(outKey(), { ups: {}, dels: {}, rest: null });
    await loadRestaurant(); render(); toast(msg);
  } catch (e) { BOOTING = null; render(); toast(e.message); }
}
function clearFutureRec(id) { const T = today(); S.payables = S.payables.filter(p => !(p.key && p.key.startsWith('rec:' + id + ':') && p.estado === 'pendiente' && p.vence >= T)); }
function parseCsv(txt) {
  const ok = []; let bad = 0;
  txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach((l, i) => {
    const c = l.split(/[,;\t]/).map(x => x.trim().replace(/^"|"$/g, ''));
    if (i === 0 && /fecha/i.test(c[0])) return;
    let f = c[0]; const m = Number(String(c[1] || '').replace(/[$\s,]/g, ''));
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(f)) { const [d, mo, y] = f.split('/'); f = y + '-' + pad(mo) + '-' + pad(d); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !(m > 0)) { bad++; return; }
    const met = METODOS.find(x => x.toLowerCase().startsWith(String(c[2] || '').toLowerCase().slice(0, 4))) || 'Efectivo';
    ok.push({ fecha: f, monto: Math.round(m), metodo: met });
  });
  return { ok, bad };
}

/* ============ Formularios ============ */
async function startCloud(j) {
  SESSION = { token: j.token, user: j.user, restauranteId: j.user.restauranteId }; USER = j.user; MODE = 'cloud'; LS.set(K_SES, SESSION);
  ui.loginError = ''; FEED = null; CLIENTES = null; TEAM = null;
  if (isAdmin()) { S = null; BOOTING = null; ui.view = 'admin'; render(); loadAdmin(); return; }
  if (isAsesor()) { S = null; BOOTING = null; ui.view = 'clientes'; render(); loadClientes(); return; }
  await loadRestaurant(); ui.view = isStaff() ? 'ventas' : 'inicio'; saveUI(); render();
}
const forms = {
  login: async fd => {
    const e = String(fd.get('email')).trim().toLowerCase(), p = String(fd.get('pass'));
    if (e === 'demo@pymexico.mx') { actions.demo(); return; }
    if (API) {
      try { BOOTING = 'Entrando…'; render(); const j = await api('entrar', { email: e, pass: p }); await startCloud(j); }
      catch (er) { BOOTING = null; ui.loginError = er.message; render(); }
      return;
    }
    const L = LS.get(K_LOCAL, null);
    if (L && L.account && L.account.email === e && L.account.pass === p) { L.session = true; LOCAL = L; LS.set(K_LOCAL, L); MODE = 'local'; USER = { id: 'yo', nombre: L.account.nombre, email: e, rol: 'dueno' }; S = L.data; render(); return; }
    ui.loginError = 'El correo o la contraseña no coinciden. Revisa e intenta de nuevo.'; render();
  },
  signup: async fd => {
    const data = { nombre: String(fd.get('nombre')).trim(), email: String(fd.get('email')).trim().toLowerCase(), pass: String(fd.get('pass')), restaurante: String(fd.get('rest')).trim(), ciudad: String(fd.get('ciudad')).trim(), saldo: Number(fd.get('saldo')) || 0, plan: fd.get('plan'), aviso: fd.get('aviso') === 'on' };
    if (API) {
      try { BOOTING = 'Creando tu restaurante…'; render(); const j = await api('registro', data); ui.tourDone = false; ui.tourStep = 0; await startCloud(j); toast('Listo. Empieza con los pasos de “Empieza en tres pasos”.'); }
      catch (er) { BOOTING = null; ui.loginError = er.message; render(); }
      return;
    }
    const prev = LS.get(K_LOCAL, null);
    if (prev && prev.account && !prev.account.demo && !confirm('En esta copia sin conexión solo cabe una cuenta por equipo. Si continúas, se reemplaza la anterior.')) return;
    const D = blankData({ nombre: data.restaurante, ciudad: data.ciudad, giro: '' }); D.config.saldoInicial = data.saldo; D.config.plan = data.plan;
    LOCAL = { account: { nombre: data.nombre, email: data.email, pass: data.pass }, data: D, session: true, ver: 3 }; LS.set(K_LOCAL, LOCAL);
    MODE = 'local'; USER = { id: 'yo', nombre: data.nombre, email: data.email, rol: 'dueno' }; S = D; ui.view = 'inicio'; ui.tourDone = false; ui.tourStep = 0; saveUI(); render();
  },
  recover: async fd => { const e = String(fd.get('email')).trim().toLowerCase(); try { await api('recuperar', { email: e }); ui.recStep = true; ui.recEmail = e; ui.loginError = ''; render(); } catch (er) { ui.loginError = er.message; render(); } },
  reset: async fd => { try { await api('restablecer', { email: ui.recEmail, code: String(fd.get('code')).trim(), pass: String(fd.get('pass')) }); ui.recStep = false; ui.loginTab = 'entrar'; ui.loginError = ''; ui.loginOk = 'Listo, ya puedes entrar con tu nueva contraseña.'; render(); } catch (er) { ui.loginError = er.message; render(); } },
  sale: fd => { const m = Number(fd.get('monto')); if (!(m > 0)) return; S.sales.push({ id: uid(), fecha: fd.get('fecha'), monto: Math.round(m), metodo: fd.get('metodo'), nota: fd.get('nota') || '' }); ui.focus = 'saleMonto'; commit('Venta registrada: ' + money(m)); },
  payable: fd => { const est = fd.get('estado'); S.payables.push({ id: uid(), concepto: fd.get('concepto'), categoria: fd.get('categoria'), monto: Math.round(Number(fd.get('monto'))), vence: fd.get('vence'), estado: est, pagadoEl: est === 'pagado' ? fd.get('vence') : undefined, origen: 'manual' }); closeModal(); commit('Pago registrado'); },
  pay: (fd, f) => { const p = S.payables.find(x => x.id === f.dataset.id); p.estado = 'pagado'; p.monto = Math.round(Number(fd.get('monto'))); p.pagadoEl = fd.get('fecha'); p.estimado = false; if (p.payrollId) { const pr = S.payrolls.find(x => x.id === p.payrollId); if (pr) pr.estado = 'pagada'; } closeModal(); commit('Marcado como pagado'); },
  purchase: fd => {
    const id = uid(); const costo = Math.round(Number(fd.get('costo'))); const sup = S.suppliers.find(s => s.id === fd.get('supplierId')); const prod = S.products.find(p => p.id === fd.get('productId')); const cred = fd.get('pago') === 'credito'; const fecha = fd.get('fecha');
    S.purchases.push({ id, fecha, productId: prod.id, cantidad: Number(fd.get('cantidad')), costo, supplierId: sup.id });
    S.payables.push({ id: keyId('comp:' + id), key: 'comp:' + id, concepto: 'Compra: ' + prod.nombre, categoria: 'Proveedores', monto: costo, vence: cred ? (fd.get('vence') || addD(fecha, sup.credito || 7)) : fecha, estado: cred ? 'pendiente' : 'pagado', pagadoEl: cred ? undefined : fecha, proveedor: sup.nombre, origen: 'compra' });
    commit(cred ? 'Compra registrada y agregada a tus pagos' : 'Compra registrada');
  },
  closing: data => { const f = data.get('fecha'); S.closings = S.closings.filter(c => c.fecha !== f); let n = 0; S.products.forEach(p => { const s = data.get('s_' + p.id), m = data.get('m_' + p.id); if (s === '' && m === '') return; S.closings.push({ id: uid(), fecha: f, productId: p.id, sobrante: Number(s) || 0, merma: Number(m) || 0 }); n++; }); commit(n ? 'Cierre del ' + fd(f) + ' guardado' : 'El cierre está vacío; no se guardó nada'); },
  product: fd => { S.products.push({ id: uid(), nombre: fd.get('nombre'), unidad: fd.get('unidad'), precioRef: 0 }); commit('Producto agregado'); },
  supplier: fd => { S.suppliers.push({ id: uid(), nombre: fd.get('nombre'), telefono: fd.get('telefono'), credito: Number(fd.get('credito')) || 0 }); commit('Proveedor agregado'); },
  employee: fd => { const id = fd.get('id'); const data = { nombre: fd.get('nombre'), puesto: fd.get('puesto'), sueldo: Math.round(Number(fd.get('sueldo'))), periodicidad: fd.get('periodicidad'), ingreso: fd.get('ingreso') }; if (id) { Object.assign(S.employees.find(e => e.id === id), data); closeModal(); commit('Cambios guardados'); } else { S.employees.push({ id: uid(), activo: true, ...data }); commit('Agregado a tu equipo'); } },
  payroll: fd => {
    const tipo = fd.get('tipo'), fecha = fd.get('fecha'); const base = tipo === 'semanal' ? 6 : 15; const emps = S.employees.filter(e => e.activo && e.periodicidad === tipo); if (!emps.length) return;
    if (S.payrolls.some(p => p.fechaPago === fecha && p.tipo === tipo) && !confirm('Ya existe una nómina ' + tipo + ' con esa fecha de pago. ¿Crear otra?')) return;
    const items = emps.map(e => { const dias = Number(fd.get('d_' + e.id)) || 0, b = Number(fd.get('b_' + e.id)) || 0, x = Number(fd.get('x_' + e.id)) || 0; return { empId: e.id, nombre: e.nombre, sueldo: e.sueldo, dias, bonos: b, deducciones: x, neto: Math.round(e.sueldo * dias / base + b - x) }; });
    const id = uid(), total = sum(items, 'neto'); const d = pd(fecha);
    const inicio = tipo === 'semanal' ? addD(fecha, -6) : (d.getDate() <= 15 ? ds(new Date(d.getFullYear(), d.getMonth(), 1)) : ds(new Date(d.getFullYear(), d.getMonth(), 16)));
    S.payrolls.push({ id, tipo, inicio, fin: fecha, fechaPago: fecha, items, total, estado: 'pendiente' });
    S.payables.push({ id: keyId('nom:' + id), key: 'nom:' + id, concepto: 'Nómina ' + tipo, categoria: 'Nómina', monto: total, vence: fecha, estado: 'pendiente', payrollId: id });
    ui.genFecha = null; commit('Nómina guardada por ' + money(total) + ' y agregada a tus pagos');
  },
  recurring: fd => {
    const id = fd.get('id'); const data = { nombre: fd.get('nombre'), categoria: fd.get('categoria'), monto: Math.round(Number(fd.get('monto'))), frecuencia: fd.get('frecuencia'), dia: Number(fd.get('dia')) || 1, diaSemana: Number(fd.get('diaSemana')) };
    if (id) { const r = S.recurring.find(x => x.id === id); Object.assign(r, data); clearFutureRec(id); r.desde = r.desde > today() ? r.desde : today(); closeModal(); commit('Gasto fijo actualizado'); }
    else { S.recurring.push({ id: uid(), activo: true, desde: today(), ...data }); commit('Gasto fijo agregado. Sus próximos pagos ya aparecen.'); }
  },
  taxPct: fd => { S.config.impuestoPct = Number(fd.get('pct')) || 0; if (!S.config.impuestoPct) S.payables = S.payables.filter(p => !(p.estimado && p.estado === 'pendiente')); commit('Estimación actualizada'); },
  taxPay: fd => {
    const f = fd.get('fecha'), m = Math.round(Number(fd.get('monto'))); const est = S.payables.find(p => p.estimado && p.estado === 'pendiente' && monthKey(p.vence) === monthKey(f));
    if (est && fd.get('concepto').startsWith('ISR')) { est.estado = 'pagado'; est.monto = m; est.pagadoEl = f; est.concepto = fd.get('concepto'); est.estimado = false; }
    else S.payables.push({ id: uid(), concepto: fd.get('concepto'), categoria: 'Impuestos', monto: m, vence: f, estado: 'pagado', pagadoEl: f, origen: 'manual' });
    commit('Pago de impuestos registrado');
  },
  corte: fd => { const f = fd.get('fecha'); S.cortes = S.cortes.filter(c => c.fecha !== f); const c = { id: 'corte_' + f, fecha: f, fondo: Number(fd.get('fondo')) || 0, ventasEf: Number(fd.get('ventasEf')) || 0, gastosEf: Number(fd.get('gastosEf')) || 0, contado: Number(fd.get('contado')) || 0, nota: fd.get('nota') }; S.cortes.push(c); S.config.fondoCaja = c.fondo; const d = c.contado - (c.fondo + c.ventasEf - c.gastosEf); commit(Math.abs(d) < 1 ? 'Corte guardado: la caja cuadra' : d > 0 ? 'Corte guardado: sobran ' + money(d) : 'Corte guardado: faltan ' + money(-d)); },
  retiro: fd => { const m = Math.round(Number(fd.get('monto'))); S.payables.push({ id: uid(), concepto: 'Retiro del dueño', categoria: 'Retiro del dueño', monto: m, vence: today(), estado: 'pagado', pagadoEl: today(), origen: 'manual' }); closeModal(); commit('Retiro de ' + money(m) + ' registrado'); },
  promo: fd => { const p = { id: uid(), nombre: fd.get('nombre'), dia: Number(fd.get('dia')), tipo: fd.get('tipo'), desc: fd.get('desc'), precio: fd.get('precio'), horario: fd.get('horario'), inicio: today(), activa: true }; S.promos.unshift(p); ui.promoDraft = null; commit('Promoción guardada. Medimos su resultado desde hoy.'); },
  reserveMeta: fd => { S.reserve.meta = Number(fd.get('meta')) || 0; commit('Meta guardada'); },
  reserveMov: fd => { const tipo = fd.get('tipo'), m = Math.round(Number(fd.get('monto'))); if (tipo === 'retiro' && m > reserveBalance()) { toast('No puedes sacar más de lo que tiene el fondo (' + money(reserveBalance()) + ')'); return; } S.reserve.movs.push({ id: uid(), fecha: today(), tipo, monto: m, nota: fd.get('nota') }); commit(tipo === 'aporte' ? 'Aportación registrada' : 'Retiro del fondo registrado'); },
  post: async fd => {
    const d = { titulo: String(fd.get('titulo')).trim(), cuerpo: String(fd.get('cuerpo')).trim(), categoria: fd.get('categoria') };
    if (MODE === 'cloud') { try { await api('publicar', d); ui.newPost = false; ui.cat = 'Todas'; toast('Publicado'); await loadFeed(); render(); } catch (e) { toast(e.message); } return; }
    S.posts.push({ id: uid(), autorId: 'yo', autor: USER.nombre, restaurante: S.restaurant.nombre, ciudad: S.restaurant.ciudad, fecha: today(), utiles: 0, miUtil: false, denuncias: 0, comentarios: [], ...d }); ui.newPost = false; ui.cat = 'Todas'; commit('Publicado');
  },
  comment: async (fd, f) => {
    const texto = String(fd.get('texto')).trim(); const id = f.dataset.id;
    if (MODE === 'cloud') { try { await api('comentar', { postId: id, texto }); ui.open[id] = true; await loadFeed(); render(); } catch (e) { toast(e.message); } return; }
    const p = S.posts.find(x => x.id === id); p.comentarios.push({ id: uid(), autor: USER.nombre, restaurante: S.restaurant.nombre, fecha: today(), texto }); ui.open[id] = true; commit('Comentario publicado');
  },
  msg: async fd => {
    const texto = String(fd.get('texto')).trim(); if (!texto) return;
    if (READONLY && isAsesor()) { try { const j = await api('asesorMsg', { restauranteId: VIEWING.id, texto }); S.msgs.push(j.mensaje); render(); scrollThread(); } catch (e) { toast(e.message); } return; }
    S.msgs.push({ id: uid(), fecha: new Date().toISOString(), de: 'dueno', autor: USER.nombre, texto }); commit(); scrollThread();
  },
  advSession: async fd => { const proxima = fd.get('fecha') + 'T' + fd.get('hora'); try { const j = await api('asesorSesion', { restauranteId: VIEWING.id, proxima }); S.advisor = j.asesor; render(); toast('Sesión agendada'); } catch (e) { toast(e.message); } },
  borrarCuenta: async fd => {
    try {
      BOOTING = 'Borrando tu cuenta…'; closeModal(); render();
      await api('borrarCuenta', { pass: String(fd.get('pass')) });
      const rid = SESSION && SESSION.restauranteId; LS.del('pymx_cache_' + rid); LS.del(outKey()); LS.del(K_SES);
      SESSION = null; USER = null; S = null; MODE = null; BOOTING = null; ui.loginTab = 'entrar'; ui.loginError = ''; ui.loginOk = 'Tu cuenta y todos tus datos se borraron.'; render();
    } catch (e) { BOOTING = null; render(); toast(e.message); }
  },
  adminRest: async (fd, f) => {
    const rid = f.dataset.id; const plan = fd.get('plan');
    const funciones = {}; (ADMIN.funciones || []).forEach(k => funciones[k] = fd.get('fn_' + k) === 'on');
    const data = { restauranteId: rid, plan, funciones, suspendido: fd.get('estado') === 'suspendido', asesorId: plan === 'acompanamiento' ? (fd.get('asesorId') || '') : '' };
    try { await api('adminRestaurante', data); closeModal(); toast('Cambios guardados'); loadAdmin(); } catch (e) { toast(e.message); }
  },
  adminAsesor: async (fd, f) => {
    try { await api('adminCrearAsesor', { nombre: String(fd.get('nombre')).trim(), email: String(fd.get('email')).trim().toLowerCase(), pass: String(fd.get('pass')) }); f.reset(); toast('Asesor creado. Pásale su correo y contraseña.'); loadAdmin(); } catch (e) { toast(e.message); }
  },
  invite: async fd => { try { await api('invitar', { nombre: String(fd.get('nombre')).trim(), email: String(fd.get('email')).trim().toLowerCase(), pass: String(fd.get('pass')) }); toast('Listo, ya puede entrar con ese correo'); loadTeam(); } catch (e) { toast(e.message); } },
  cfgRest: fd => { Object.assign(S.restaurant, { nombre: fd.get('nombre'), ciudad: fd.get('ciudad'), giro: fd.get('giro') }); commit('Datos guardados'); },
  cfgFin: fd => { Object.assign(S.config, { saldoInicial: Number(fd.get('saldoInicial')) || 0, diasCompromisos: Math.max(1, Number(fd.get('dias')) || 7), umbralVerde: Number(fd.get('umbral')) || 0, cuotasPct: Number(fd.get('cuotas')) || 0, saldoOk: true }); commit('Guardado'); }
};
function scrollThread() { const t = document.getElementById('thread'); if (t) t.scrollTop = t.scrollHeight; }
const FORMS_RO = new Set(['msg', 'advSession', 'post', 'comment', 'login', 'signup', 'recover', 'reset']);
const ADMIN_OK = new Set(['adminRest', 'adminAsesor']);

/* ============ Eventos ============ */
document.addEventListener('click', e => {
  if (e.target.id === 'overlay') { closeModal(); return; }
  const a = e.target.closest('[data-a]'); if (!a || a.tagName === 'SELECT' || a.tagName === 'INPUT') return;
  const fn = actions[a.dataset.a]; if (!fn) return;
  e.preventDefault();
  if (READONLY && !RO_OK.has(a.dataset.a)) { toast('Como asesor solo puedes revisar y escribir mensajes.'); return; }
  fn(a, e);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-f]'); if (!f) return; e.preventDefault();
  if (READONLY && !FORMS_RO.has(f.dataset.f)) { toast('Como asesor solo puedes revisar y escribir mensajes.'); return; }
  const fn = forms[f.dataset.f]; if (fn) fn(new FormData(f), f);
});
document.addEventListener('change', e => {
  const el = e.target; const k = el.dataset ? el.dataset.aChange : null; if (!k) return;
  if (k === 'closeDate') { ui.closeDate = el.value; render(); }
  else if (k === 'corteDate') { ui.corteDate = el.value; render(); }
  else if (k === 'payFilter') { ui.payFilter = el.value; render(); }
  else if (k === 'repMonth') { ui.repMonth = el.value; render(); }
  else if (k === 'genTipo') { ui.genTipo = el.value; ui.genFecha = null; render(); }
  else if (k === 'plan') { if (READONLY) return; S.config.plan = el.value; commit('Plan actualizado'); }
});
document.addEventListener('input', e => {
  if (e.target.matches('[data-adminsearch]')) { const q = e.target.value.trim().toLowerCase(); document.querySelectorAll('tr[data-text]').forEach(tr => { tr.style.display = !q || tr.dataset.text.includes(q) ? '' : 'none'; }); return; }
  const ar = e.target.closest('form[data-f="adminRest"]');
  if (ar && e.target.name === 'plan') { ar.asesorId.disabled = e.target.value !== 'acompanamiento'; return; }
  const sim = e.target.closest('form[data-sim]');
  if (sim) {
    const fdd = new FormData(sim); const prevMover = ui.sim.moverId, prevModo = ui.sim.moverModo; for (const [k, v] of fdd.entries()) ui.sim[k] = v; if (!fdd.has('moverModo')) ui.sim.moverModo = 'mover';
    const o = sim.querySelector('[data-out="ventasPct"]'); if (o) o.textContent = (ui.sim.ventasPct > 0 ? '+' : '') + ui.sim.ventasPct + '%';
    if (ui.sim.moverId !== prevMover || ui.sim.moverModo !== prevModo) { const p0 = S.payables.find(x => x.id === ui.sim.moverId); if (p0) { ui.sim.f1 = ui.sim.moverModo === 'dividir' ? p0.vence : addD(p0.vence, 14); ui.sim.f2 = addD(p0.vence, 30); } render(); return; }
    document.getElementById('simOut').innerHTML = simOut(); decorateTables(); return;
  }
  const fin = e.target.closest('form[data-fin]');
  if (fin) { ui.fin.monto = Number(fin.monto.value) || 0; ui.fin.plazo = Number(fin.plazo.value) || 6; document.getElementById('finOut').innerHTML = finOut(); return; }
  const cf = e.target.closest('form[data-calc="corte"]');
  if (cf) { document.querySelector('[data-corte-res]').innerHTML = corteTicket(cf.fondo.value, cf.ventasEf.value, cf.gastosEf.value, cf.contado.value, cf.fecha.value); return; }
  const pf = e.target.closest('form[data-calc="promo"]');
  if (pf) { const fdd = new FormData(pf); const prevTipo = ui.promoDraft.tipo; for (const [k, v] of fdd.entries()) ui.promoDraft[k] = v; ui.promoDraft.dia = Number(ui.promoDraft.dia); if (ui.promoDraft.tipo !== prevTipo) { render(); return; } pf.querySelector('[data-promo-preview]').textContent = ui.promoDraft.desc && ui.promoDraft.precio ? promoMsg(ui.promoDraft) : 'Completa la promoción para ver el mensaje.'; return; }
  if (e.target.matches('[data-search]')) { const q = e.target.value.trim().toLowerCase(); document.querySelectorAll('.post').forEach(p => { p.style.display = !q || p.dataset.text.includes(q) ? '' : 'none'; }); return; }
  const f = e.target.closest('form[data-calc="pay"]'); if (!f) return;
  let tot = 0, bruto = 0;
  f.querySelectorAll('tr[data-row]').forEach(tr => { const id = tr.dataset.row, s = Number(tr.dataset.sueldo), b = Number(tr.dataset.base); const v = n => Number(f.querySelector(`[name="${n}_${id}"]`).value) || 0; const neto = Math.round(s * v('d') / b + v('b') - v('x')); bruto += s * v('d') / b; tot += neto; tr.querySelector('[data-neto]').textContent = money(neto); });
  const t = f.querySelector('[data-total]'); if (t) t.textContent = money(tot);
  const c = f.querySelector('[data-cuotas]'); if (c) c.textContent = `Cuotas patronales e impuestos estimados (${S.config.cuotasPct}%): ${money(bruto * S.config.cuotasPct / 100)}. Es una estimación y no se suma al pago; confírmala con tu contador.`;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); } });

/* Actualizaciones periódicas en la nube */
setInterval(() => {
  if (MODE !== 'cloud' || document.visibilityState !== 'visible') return;
  if (ui.view === 'comunidad') loadFeed(true);
  if (ui.view === 'asesor' && S) loadMsgs(true);
}, 30000);
setInterval(() => { if (MODE === 'cloud' && S && !READONLY && SESSION) LS.set('pymx_cache_' + SESSION.restauranteId, { R: Object.assign({ id: SESSION.restauranteId, asesor: S.advisor }, restOf()), cols: allCols(S) }); }, 8000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && MODE === 'cloud') { collectChanges(); flush(); } });

/* ============ Arranque ============ */
async function boot() {
  const ses = API ? LS.get(K_SES, null) : null;
  LOCAL = LS.get(K_LOCAL, null);
  if (ses && ses.token && ses.user) {
    SESSION = ses; USER = ses.user; MODE = 'cloud';
    if (isAdmin()) { if (!['admin', 'asesores', 'comunidad', 'config'].includes(ui.view)) ui.view = 'admin'; render(); loadAdmin(); if (ui.view === 'comunidad') loadFeed(); return; }
    if (isAsesor()) { ui.view = 'clientes'; render(); loadClientes(); return; }
    const c = LS.get('pymx_cache_' + ses.restauranteId, null);
    if (c) {
      S = buildS(c.R, c.cols); SNAP = snapshot(); render(); flush();
      try { await flush(); const box = LS.get(outKey(), null); if (boxEmpty(box)) { const j = await api('cargar'); S = buildS(j.restaurante, j.cols); SNAP = snapshot(); if (!typingIn('main') && !document.getElementById('overlay')) render(); } } catch (e) { if (e.code === 'red') setSync('off'); }
    } else {
      try { await loadRestaurant(); } catch (e) { BOOTING = null; if (e.code !== 'sesion') { ui.loginError = e.message; USER = null; SESSION = null; } }
      render();
    }
    return;
  }
  if (LOCAL && LOCAL.session) {
    if (LOCAL.account.demo && LOCAL.ver !== 3) { LOCAL.data = seedDemo(); LOCAL.ver = 3; LS.set(K_LOCAL, LOCAL); }
    MODE = 'local'; USER = { id: 'yo', nombre: LOCAL.account.nombre, email: LOCAL.account.email, rol: 'dueno' }; S = LOCAL.data;
  }
  render();
}
if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));

/* ============ Cerrar el día (la pantalla principal del día a día) ============ */
function diaCerrado(d) { return S.sales.some(s => s.fecha === d); }
function ventasDe(d) { const o = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 }; S.sales.filter(s => s.fecha === d).forEach(s => o[s.metodo] = (o[s.metodo] || 0) + s.monto); return o; }
function gastoRow(g) {
  return `<div class="gasto-row" data-gasto>
    <label>Concepto<input name="g_concepto" value="${h(g.concepto || '')}" placeholder="Ej. Gas, tortillas, hielo"></label>
    <label>Tipo<select name="g_cat">${CATS_PAGO.filter(c => c !== 'Nómina' && c !== 'Retiro del dueño').map(c => `<option ${g.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label>Monto<input name="g_monto" type="number" min="0" step="1" value="${g.monto || ''}" placeholder="$0" inputmode="numeric"></label>
    <button type="button" class="btn ghost sm" data-a="diaDelGasto" aria-label="Quitar este gasto">Quitar</button>
  </div>`;
}
function diaResumen(ef, tj, tr, gastos, fecha) {
  const tot = ef + tj + tr; const prom = avgByWeekday()[pd(fecha).getDay()];
  const comp = !tot || !prom ? '' : tot >= prom ? `<span class="up">${num((tot - prom) / prom * 100, 0)}% más</span> que un ${DIAS[pd(fecha).getDay()]} normal (${money(prom)})` : `<span class="down">${num((prom - tot) / prom * 100, 0)}% menos</span> que un ${DIAS[pd(fecha).getDay()]} normal (${money(prom)})`;
  return `<div class="label">Vendiste</div><div class="value">${money(tot)}</div><div class="note">${comp || (tot ? 'Todavía no hay suficientes días para comparar.' : 'Escribe lo que vendiste.')}</div>
    ${isStaff() ? '' : `<div class="dia-cuenta"><div><span>Pagaste</span><b>${money(gastos)}</b></div><div><span>Te quedó del día</span><b class="${tot - gastos < 0 ? 'down' : ''}">${money(tot - gastos)}</b></div></div>`}`;
}
function vDia() {
  const T = today(); const f = ui.diaDate || T;
  const v = ventasDe(f), gastos = S.payables.filter(p => p.origen === 'dia' && p.pagadoEl === f);
  const ex = S.cortes.find(c => c.fecha === f);
  const cerrado = diaCerrado(f);
  const venceHoy = isStaff() || f !== T ? [] : pendientes().filter(p => p.vence <= T);
  const hecho = ui.diaHecho === f && cerrado;
  const last7 = []; for (let i = 0; i < 7; i++) last7.push(addD(T, -i));
  const racha = (() => { let n = 0; for (let i = diaCerrado(T) ? 0 : 1; i < 60; i++) { if (diaCerrado(addD(T, -i))) n++; else break; } return n; })();
  const vf = v.Efectivo + v.Tarjeta + v.Transferencia, gf = sum(gastos, 'monto');
  return `
  ${hecho ? `<section class="dia-ok"><div>${icon('sirvio')}<div><b>Listo, ${f === T ? 'cerraste el día de hoy' : 'guardaste el ' + fdl(f)}.</b><p>Vendiste ${money(vf)}${isStaff() ? '' : ` y pagaste ${money(gf)}. Hoy puedes usar ${money(Math.max(0, disponible()))} sin apretarte`}.</p></div></div>${isStaff() ? '' : '<button class="btn sec" data-a="nav" data-v="inicio">Ver mi dinero</button>'}</section>` : ''}
  <div class="g75">
    <section class="panel">
      <div class="ph"><div><h2>${f === T ? 'Cierra tu día' : 'Cierre del ' + fdl(f)}</h2><p>${cerrado ? 'Este día ya tiene registro. Si cambias algo, se reemplaza.' : 'Contesta dos preguntas. Toma un minuto.'}</p></div>
        <label class="inline-date">Día<input type="date" value="${f}" max="${T}" data-a-change="diaDate"></label></div>
      <form class="dia-form" data-f="dia" data-calc="dia">
        <input type="hidden" name="fecha" value="${f}">
        <fieldset><legend><span class="num-paso">1</span>¿Cuánto vendiste?</legend>
          <p class="hint">Lo que dice tu terminal y lo que hay en caja. Si no sabes cuánto fue de cada cosa, ponlo todo en efectivo.</p>
          <div class="fields">
            <label>En efectivo<input name="ef" class="money-in" type="number" min="0" step="1" value="${v.Efectivo || ''}" placeholder="$0" inputmode="numeric" id="diaEf"></label>
            <label>Con tarjeta<input name="tj" class="money-in" type="number" min="0" step="1" value="${v.Tarjeta || ''}" placeholder="$0" inputmode="numeric"></label>
            <label>Por transferencia<input name="tr" class="money-in" type="number" min="0" step="1" value="${v.Transferencia || ''}" placeholder="$0" inputmode="numeric"></label>
          </div>
        </fieldset>
        ${isStaff() ? '' : `<fieldset><legend><span class="num-paso">2</span>¿Pagaste algo ${f === T ? 'hoy' : 'ese día'}?</legend>
          <p class="hint">Lo que salió del negocio: compras al momento, gas, hielo, una reparación. Si no pagaste nada, déjalo vacío.</p>
          <div data-gastos>${(gastos.length ? gastos : [{}]).map(gastoRow).join('')}</div>
          <button type="button" class="btn sec sm mt" data-a="diaAddGasto">${icon('mas1')}Agregar otro gasto</button>
        </fieldset>`}
        <details class="dia-caja" ${ex ? 'open' : ''}><summary><span class="num-paso">${isStaff() ? 2 : 3}</span>Contar la caja <span class="hint">(opcional)</span></summary>
          <p class="hint">Cuenta el efectivo al cerrar y te decimos si cuadra.</p>
          <div class="fields">
            <label>Fondo con el que abriste<input name="fondo" type="number" min="0" value="${ex ? ex.fondo : S.config.fondoCaja}" inputmode="numeric"></label>
            <label>Efectivo que contaste<input name="contado" type="number" min="0" value="${ex ? ex.contado : ''}" placeholder="$0" inputmode="numeric"></label>
          </div>
          <div data-dia-caja></div>
        </details>
        <div class="form-actions"><button class="btn big" type="submit">${icon('sirvio')}${cerrado ? 'Guardar cambios' : f === T ? 'Cerrar el día' : 'Guardar este día'}</button></div>
      </form>
    </section>
    <div class="stack">
      <section class="panel dato" data-dia-res>${diaResumen(v.Efectivo, v.Tarjeta, v.Transferencia, gf, f)}</section>
      ${venceHoy.length ? `<section class="panel"><div class="ph"><div><h2>Pagos que vencen hoy</h2><p>Si ya los pagaste, márcalos.</p></div></div><div class="stack">${venceHoy.slice(0, 5).map(itemRow).join('')}</div></section>` : ''}
      <section class="panel"><div class="ph"><div><h2>Tu semana</h2><p>${racha >= 2 ? `Llevas ${racha} días seguidos cerrando. Así tus números son confiables.` : 'Cerrar cada día hace que tus números sean confiables.'}</p></div></div>
        <ul class="semana">${last7.map(d => { const ok = diaCerrado(d); const t = sum(S.sales.filter(s => s.fecha === d), 'monto'); return `<li class="${ok ? 'ok' : ''} ${d === f ? 'sel' : ''}"><span class="d">${d === T ? 'Hoy' : cap(DIAS[pd(d).getDay()]).slice(0, 3) + ' ' + pd(d).getDate()}</span>${ok ? `<b>${money(t)}</b>` : '<span class="hint">Sin cerrar</span>'}${d !== f ? `<button class="linkbtn" data-a="diaVer" data-v="${d}">${ok ? 'Ver' : 'Cerrar'}</button>` : '<span class="hint">Abierto</span>'}</li>`; }).join('')}</ul>
      </section>
    </div>
  </div>`;
}
function diaCajaTxt(form) {
  const n = k => Number(form[k] && form[k].value) || 0;
  if (!form.contado || form.contado.value === '') return '';
  const gastos = [...form.querySelectorAll('[name="g_monto"]')].reduce((a, i) => a + (Number(i.value) || 0), 0);
  const esp = n('fondo') + n('ef') - gastos; const d = n('contado') - esp;
  return `<p class="lectura ${Math.abs(d) < 1 ? '' : d > 0 ? 'warn' : 'bad'}">Debería haber ${money(esp)}: fondo, más ventas en efectivo, menos lo que pagaste. ${Math.abs(d) < 1 ? '<b>La caja cuadra.</b>' : d > 0 ? `<b>Sobran ${money(d)}.</b>` : `<b>Faltan ${money(-d)}.</b> Revisa el cambio y los gastos que no anotaste.`}</p>`;
}
document.addEventListener('input', e => {
  const f = e.target.closest('form[data-calc="dia"]'); if (!f) return;
  const n = k => Number(f[k] && f[k].value) || 0;
  const gastos = [...f.querySelectorAll('[name="g_monto"]')].reduce((a, i) => a + (Number(i.value) || 0), 0);
  const r = document.querySelector('[data-dia-res]'); if (r) r.innerHTML = diaResumen(n('ef'), n('tj'), n('tr'), gastos, f.fecha.value);
  const c = f.querySelector('[data-dia-caja]'); if (c) c.innerHTML = diaCajaTxt(f);
});
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.aChange === 'diaDate') { ui.diaDate = e.target.value; ui.diaHecho = null; render(); } });
document.addEventListener('toggle', e => { if (e.target.matches && e.target.matches('[data-detalle]')) ui.detalleOpen = e.target.open; }, true);

/* ============ Herramientas ============ */
function vHerramientas() {
  const list = HERR.filter(([k]) => fnOk(k));
  return `<p class="aviso info">${icon('herr')} Elige solo lo que de verdad usas; así la app se mantiene sencilla. Puedes cambiarlo cuando quieras y tus datos no se borran al quitar una herramienta.</p>
  <div class="herr-grid">${list.map(([k, l, d]) => { const on = herrOn(k); return `<section class="panel herr ${on ? 'on' : ''}"><div class="herr-h">${icon(ICON_OF[k])}<b>${l}</b>${on ? '<span class="tag ok">En tu menú</span>' : ''}</div><p>${d}</p><div class="row">${on ? `<button class="btn sec sm" data-a="nav" data-v="${k}">Abrir</button><button class="btn ghost sm" data-a="herrToggle" data-v="${k}">Quitar del menú</button>` : `<button class="btn sm" data-a="herrToggle" data-v="${k}">${icon('mas1')}Agregar al menú</button>`}</div></section>`; }).join('')}</div>`;
}

/* ============ Crédito: precalificación con los datos del negocio ============ */
const TASA_EJ = 0.025, PLAZO_PRE = 12;
function precalif() {
  const T = today(), ventanas = [];
  for (let k = 0; k < 6; k++) {
    const hasta = addD(T, -1 - 30 * k), desde = addD(hasta, -29);
    const ventas = sum(S.sales.filter(s => s.fecha >= desde && s.fecha <= hasta), 'monto');
    const egresos = sum(S.payables.filter(p => p.estado === 'pagado' && p.pagadoEl >= desde && p.pagadoEl <= hasta && p.categoria !== 'Retiro del dueño' && p.categoria !== 'Créditos'), 'monto');
    if (ventas > 0) ventanas.push({ desde, hasta, ventas, queda: ventas - egresos });
  }
  const n = ventanas.length;
  const ventasMes = n ? sum(ventanas, 'ventas') / n : 0, quedaMes = n ? sum(ventanas, 'queda') / n : 0;
  const pos = ventanas.filter(w => w.queda > 0).length;
  const weeks = []; for (let k = 1; k <= 12; k++) { const e = addD(T, -7 * (k - 1) - 1), st = addD(e, -6); weeks.push(sum(S.sales.filter(s => s.fecha >= st && s.fecha <= e), 'monto')); }
  const wk = weeks.filter(v => v > 0), mean = wk.length ? sum(wk, v => v) / wk.length : 0;
  const cv = mean && wk.length > 2 ? Math.sqrt(sum(wk, v => (v - mean) ** 2) / wk.length) / mean : 1;
  const paid = S.payables.filter(p => p.estado === 'pagado' && p.pagadoEl >= addD(T, -180) && p.origen !== 'dia' && p.categoria !== 'Retiro del dueño');
  const punt = paid.length ? paid.filter(p => p.pagadoEl <= p.vence).length / paid.length : 0;
  const dias30 = new Set(S.sales.filter(s => s.fecha >= addD(T, -30) && s.fecha < T).map(s => s.fecha)).size;
  const f = [
    ['Historial', Math.min(n, 6) / 6 * 30, 30, `${n} de 6 meses con ventas registradas`, 'Sigue cerrando tus días: cada mes suma.'],
    ['Ventas estables', wk.length < 3 ? 0 : cv < 0.15 ? 25 : cv < 0.25 ? 17 : cv < 0.4 ? 9 : 3, 25, wk.length < 3 ? 'Faltan semanas con ventas para medirlo' : cv < 0.15 ? 'Tus ventas semanales son parejas' : cv < 0.25 ? 'Tus ventas varían un poco' : 'Tus ventas cambian mucho de semana a semana', 'Mientras más parejo vendes, más confianza das.'],
    ['Pagos a tiempo', punt * 25, 25, paid.length ? `${num(punt * 100, 0)}% de tus pagos, a tiempo o antes` : 'Todavía no hay pagos programados registrados', 'Marca tus pagos el día que los haces.'],
    ['Te sobra dinero', n ? pos / n * 20 : 0, 20, n ? `${pos} de ${n} meses te quedó dinero después de pagar todo` : 'Sin meses para revisar', 'Si un mes sale en rojo, revisa a dónde se fue el dinero.']
  ];
  const score = Math.round(sum(f, x => x[1]));
  const nivel = n < 3 ? ['', 'Todavía no'] : score >= 75 ? ['ok', 'Muy buena'] : score >= 55 ? ['ok', 'Buena'] : score >= 35 ? ['warn', 'Regular'] : ['bad', 'Baja'];
  const pago = n >= 3 && score >= 35 ? Math.max(0, Math.min(quedaMes * 0.35, ventasMes * 0.10)) : 0;
  const monto = Math.floor(pago * (1 - Math.pow(1 + TASA_EJ, -PLAZO_PRE)) / TASA_EJ / 1000) * 1000;
  return { n, ventasMes, quedaMes, pos, cv, punt, dias30, f, score, nivel, pago: monto ? monto * TASA_EJ / (1 - Math.pow(1 + TASA_EJ, -PLAZO_PRE)) : 0, monto };
}
function vFinanciamiento() {
  const P = precalif();
  const factores = `<ul class="factores">${P.f.map(([l, v, mx, txt]) => `<li><div class="row" style="justify-content:space-between"><b>${l}</b><span class="hint">${Math.round(v)} de ${mx}</span></div><div class="progress"><span style="width:${v / mx * 100}%"></span></div><span class="hint">${txt}</span></li>`).join('')}</ul>`;
  if (!creditoOn()) {
    return `
    <section class="credito-lock">
      <div>${icon('candado')}<span class="tag">Próximamente</span></div>
      <h2>Crédito para tu negocio</h2>
      <p>Con los números que ya registras en la app te diremos cuánto te podrían prestar y con qué pago mensual, sin buró y sin papeleo. El equipo de .Py México la activará para tu restaurante pronto.</p>
    </section>
    <div class="grid2">
      <section class="panel"><div class="ph"><div><h2>Así te ves hoy</h2><p>Esto es lo que usaremos para precalificarte. Puedes irlo mejorando desde ya.</p></div></div>${factores}</section>
      <section class="panel"><div class="ph"><h2>Cómo prepararte</h2></div>
        <ol class="pasos">
          <li class="${P.dias30 >= 24 ? 'done' : ''}"><span class="n">${P.dias30 >= 24 ? '✓' : 1}</span><span class="t">Cierra tu día casi todos los días. Este mes llevas ${P.dias30} de 30.</span></li>
          <li class="${P.punt >= 0.8 ? 'done' : ''}"><span class="n">${P.punt >= 0.8 ? '✓' : 2}</span><span class="t">Registra tus pagos programados y márcalos cuando los hagas.</span></li>
          <li class="${P.n >= 6 ? 'done' : ''}"><span class="n">${P.n >= 6 ? '✓' : 3}</span><span class="t">Junta 6 meses de historial. Llevas ${P.n}.</span></li>
        </ol>
        ${isOwner() && !READONLY ? '<button class="btn mt" data-a="nav" data-v="dia">Cerrar el día de hoy</button>' : ''}
      </section>
    </div>`;
  }
  const max = Math.max(10000, Math.round(P.ventasMes * 0.5 / 1000) * 1000);
  ui.fin = Object.assign({ monto: P.monto ? Math.min(P.monto, max * 2) : Math.min(30000, max), plazo: 12 }, ui.fin || {});
  const R = S.restaurant;
  return `
  <p class="aviso">Precalificación de ejemplo con una tasa de 2.5% mensual. Es una simulación educativa, no una oferta de crédito.</p>
  <section class="credito-hero print-area">
    <div class="ch-main">
      <span class="k">${P.monto ? 'Te podrían prestar hasta' : 'Precalificación'}</span>
      ${P.monto ? `<div class="big">${money(P.monto)}</div><p>con pagos de <b>${money(P.pago)}</b> al mes durante ${PLAZO_PRE} meses.</p>`
      : `<div class="big sm">${P.n < 3 ? 'Faltan datos' : 'Por ahora no'}</div><p>${P.n < 3 ? `Necesitamos al menos 3 meses de ventas registradas para precalificarte. Llevas ${P.n}.` : 'Con tus números de hoy, un crédito apretaría tu caja. Revisa abajo qué mejorar.'}</p>`}
      <span class="tag ${P.nivel[0]}">Calificación: ${P.nivel[1]}${P.n >= 3 ? ` (${P.score} de 100)` : ''}</span>
    </div>
    <div class="ch-why">
      <b>¿De dónde sale?</b>
      <ul>
        <li>Vendes en promedio <b>${money(P.ventasMes)}</b> al mes.</li>
        <li>Después de pagar todo te quedan en promedio <b>${money(P.quedaMes)}</b> al mes.</li>
        <li>El pago se calcula para no pasar del 35% de lo que te queda ni del 10% de lo que vendes. Así no te ahoga.</li>
      </ul>
    </div>
  </section>
  <div class="grid2">
    <section class="panel print-area"><div class="ph"><div><h2>Qué cuenta en tu calificación</h2><p>${h(R.nombre)}${R.ciudad ? ', ' + h(R.ciudad.replace(/\.$/, '')) : ''}. Datos al ${fdl(today())}.</p></div></div>${factores}
      <div class="row mt no-print"><button class="btn sec" data-a="print">Descargar reporte para el banco</button></div>
      <p class="hint mt no-print">Se abre la ventana de imprimir: elige “Guardar como PDF”.</p></section>
    <section class="panel no-print"><div class="ph"><div><h2>Simula tu crédito</h2><p>Antes de pedirlo, mira si lo puedes pagar sin apretar tu caja.</p></div></div>
      <form class="fields" data-fin>
        <label>Monto<input name="monto" type="number" min="5000" max="${Math.max(max * 2, P.monto)}" step="1000" value="${ui.fin.monto}" inputmode="numeric"></label>
        <label>Plazo<select name="plazo">${[3, 6, 12].map(n => `<option value="${n}" ${Number(ui.fin.plazo) === n ? 'selected' : ''}>${n} meses</option>`).join('')}</select></label>
      </form>
      <div id="finOut">${finOut()}</div>
    </section>
  </div>`;
}

/* ============ Acciones y formularios nuevos ============ */
Object.assign(actions, {
  goDia: () => go('dia'),
  goSaldo: () => { ui.focus = 'cfgSaldo'; go('config'); },
  diaVer: el => { ui.diaDate = el.dataset.v; ui.diaHecho = null; render(); window.scrollTo(0, 0); },
  diaAddGasto: () => { const c = document.querySelector('[data-gastos]'); if (!c) return; c.insertAdjacentHTML('beforeend', gastoRow({})); const i = c.querySelectorAll('[name="g_concepto"]'); i[i.length - 1].focus(); },
  diaDelGasto: el => { const r = el.closest('[data-gasto]'); const c = r.parentElement; if (c.querySelectorAll('[data-gasto]').length > 1) r.remove(); else r.querySelectorAll('input').forEach(i => i.value = ''); const f = c.closest('form'); if (f) f.dispatchEvent(new Event('input', { bubbles: true })); },
  herrToggle: el => { const k = el.dataset.v; const on = !herrOn(k); S.config.herramientas = Object.assign(herrMap(), { [k]: on }); const l = HERR.find(x => x[0] === k)[1]; commit(on ? l + ' está en tu menú' : l + ' salió de tu menú'); },
  adminBorrarAsk: el => {
    const r = ADMIN && ADMIN.restaurantes.find(x => x.id === el.dataset.id); if (!r) return;
    openModal(`<h2>Eliminar cuenta</h2><p>Se borrarán <b>${h(r.nombre)}</b>, todos sus registros, los accesos de su equipo, sus mensajes y sus publicaciones. No se puede deshacer.</p>
    <form class="fields mt" data-f="adminBorrar" data-id="${r.id}"><label class="wide">Para confirmar, escribe el nombre del restaurante: <b>${h(r.nombre)}</b><input name="confirmar" required autocomplete="off"></label>
    <div class="wide actions"><button type="button" class="btn sec" data-a="close">Cancelar</button><button class="btn danger" type="submit">Eliminar para siempre</button></div></form>`);
  }
});
Object.assign(forms, {
  dia: fd => {
    const fecha = fd.get('fecha'); const n = k => Math.max(0, Math.round(Number(fd.get(k)) || 0));
    const v = { Efectivo: n('ef'), Tarjeta: n('tj'), Transferencia: n('tr') };
    const tot = v.Efectivo + v.Tarjeta + v.Transferencia;
    if (!tot) { toast('Escribe cuánto vendiste, aunque sea aproximado.'); const i = document.getElementById('diaEf'); if (i) i.focus(); return; }
    S.sales = S.sales.filter(s => s.fecha !== fecha);
    METODOS.forEach(m => { if (v[m]) S.sales.push({ id: uid(), fecha, monto: v[m], metodo: m, nota: 'Cierre del día', dia: true }); });
    let gastos = 0;
    if (!isStaff()) {
      const cs = fd.getAll('g_concepto'), ks = fd.getAll('g_cat'), ms = fd.getAll('g_monto');
      S.payables = S.payables.filter(p => !(p.origen === 'dia' && p.pagadoEl === fecha));
      cs.forEach((c, i) => { const m = Math.round(Number(ms[i]) || 0); if (m > 0) { gastos += m; S.payables.push({ id: uid(), concepto: String(c).trim() || ks[i] || 'Gasto del día', categoria: ks[i] || 'Otros', monto: m, vence: fecha, estado: 'pagado', pagadoEl: fecha, origen: 'dia' }); } });
    }
    const contado = fd.get('contado');
    if (contado !== null && contado !== '') {
      S.cortes = S.cortes.filter(c => c.fecha !== fecha);
      const c = { id: 'corte_' + fecha, fecha, fondo: n('fondo'), ventasEf: v.Efectivo, gastosEf: gastos, contado: n('contado'), nota: 'Cierre del día' };
      S.cortes.push(c); S.config.fondoCaja = c.fondo;
    }
    ui.diaHecho = fecha; window.scrollTo(0, 0);
    commit('Día cerrado: vendiste ' + money(tot));
  },
  adminBorrar: async (fd, f) => {
    try { await api('adminBorrar', { restauranteId: f.dataset.id, confirmar: String(fd.get('confirmar') || '') }); closeModal(); toast('Cuenta eliminada'); loadAdmin(); } catch (e) { toast(e.message); }
  }
});

boot();
