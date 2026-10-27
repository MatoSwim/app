# .Py México

Aplicación para dueños de restaurantes pequeños: dice cuánto dinero pueden usar hoy, qué pagos vienen y cuándo podría faltarles efectivo. Cada restaurante tiene su propia cuenta; solo se encuentran en la comunidad.

- **La app** vive en GitHub Pages (estos archivos).
- **Los datos** viven en un Google Sheets, y un Apps Script hace de servidor.
- Se instala en celular, iPad y computadora como app, con su ícono.

Mientras `config.js` no tenga el enlace del Apps Script, la app funciona solo en el equipo de cada quien y la demostración sigue disponible.

---

## Conectar la app a Google Sheets (una sola vez)

### 1. Crea el Sheets
1. Entra a Google Drive con la cuenta del proyecto y crea una hoja de cálculo nueva.
2. Ponle de nombre **.Py México · datos**.

### 2. Pega el servidor
1. En el Sheets, ve a **Extensiones > Apps Script**.
2. Borra lo que aparece y pega todo el contenido de `apps-script/Codigo.gs`.
3. Guarda con el ícono del disquete.
4. Opcional: arriba, en la lista de funciones, elige **prepararHojas** y toca **Ejecutar**. Crea todas las hojas para que las veas desde el inicio. La primera vez Google pedirá permisos: elige tu cuenta, toca **Configuración avanzada > Ir a .Py México (no seguro)** y **Permitir**. Es tu propio código; el aviso sale porque Google no lo ha revisado.

### 3. Publícalo
1. Toca **Implementar > Nueva implementación**.
2. En el engrane de "Seleccionar tipo", elige **Aplicación web**.
3. Llena así:
   - Descripción: `servidor .Py México`
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
4. Toca **Implementar** y acepta los permisos si los pide.
5. Copia la **URL de la aplicación web**. Termina en `/exec`.
6. Para probarla, ábrela en el navegador: debe decir "El servidor de .Py México está funcionando".

### 4. Conecta la app
1. Abre `config.js` y pega la URL entre las comillas de `apiUrl`.
2. En GitHub Desktop: **Commit to main** y luego **Push origin**.
3. En un par de minutos, abre `https://matoswim.github.io/app/` y crea una cuenta. En el Sheets verás aparecer las hojas y los datos.

---

## Para el equipo

**Crear la cuenta de administrador (una sola vez).** En Apps Script, busca la función `crearAdmin`, escribe nombre, correo y contraseña entre las comillas, elígela en la lista de arriba y toca **Ejecutar**. Después **borra la contraseña del código** y guarda. Entra a la app con ese correo: verás el panel "Restaurantes".

**Qué puede hacer el administrador.** Ver la lista de restaurantes (nombre, dueño, plan; nunca sus números), activar o desactivar funciones (crédito, simulador, promociones, comunidad, equipo), cambiar el plan, suspender o eliminar una cuenta, moderar la comunidad y crear asesores.

**Crédito.** Empieza apagado en todos los restaurantes: el dueño lo ve en el menú con candado y "Próximamente". Para activarlo, en Restaurantes > Administrar marca **Crédito**.

**Eliminar una cuenta.** En Restaurantes > Administrar, abajo, **Eliminar cuenta**. Hay que escribir el nombre del restaurante para confirmar. Se borra todo y no se puede deshacer.

**Asesores.** Se crean desde el panel, en "Asesores". Cuando un restaurante pague el Acompañamiento, en "Restaurantes" toca **Administrar**, elige Acompañamiento y su asesor. El asesor solo ve los restaurantes que le asignaste y no puede cambiar nada.

**Solicitudes.** Si un dueño toca "Solicitar Acompañamiento", aparece arriba en el panel para que lo actives al recibir el pago o lo rechaces.

**Correo de contacto del aviso de privacidad.** En `config.js`, escribe un correo del equipo en `contacto`.

**Dar acceso a un encargado.** Lo hace el dueño desde la app, en Configuración > Tu equipo en la app.

**Ver los datos.** Todo está en el Sheets: una hoja por tabla (ventas, compras, pagos, usuarios, publicaciones…). Mejor no editar a mano las columnas `id`, `restauranteId`, `hash` ni `salt`.

**Si cambias el código del servidor.** Ve a **Implementar > Gestionar implementaciones**, toca el lápiz, en Versión elige **Nueva versión** y toca **Implementar**. Así el enlace no cambia.

**Si cambias la app.** Sube los archivos con GitHub Desktop. Si cambiaste `app.js` o `styles.css`, sube el número `VERSION` en `sw.js` para que los celulares que la tienen instalada reciban la versión nueva.

---

## Limitaciones conocidas

- Es un prototipo funcional para validar la idea, no un sistema de producción.
- Guardar tarda uno o dos segundos porque pasa por Google. Si no hay internet, los cambios se guardan cuando vuelve la conexión.
- Google limita el uso diario gratuito; para decenas de restaurantes alcanza de sobra.
- Las cifras de impuestos y cuotas son estimaciones; no sustituyen a un contador.
- La comunidad se actualiza cada 30 segundos o con el botón "Actualizar".
- La cuenta de administrador no ve finanzas, pero quien sea dueño del Sheets técnicamente sí podría abrirlo. Así lo dice el aviso de privacidad (`privacidad.html`).
- Usen datos de ejemplo para empleados mientras sea una prueba.
