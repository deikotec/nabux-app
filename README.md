# Nabux — Inventario y Punto de Venta en la nube

Aplicación web para que cualquier persona cree su cuenta, registre su negocio y lleve el control de **inventario, ventas, caja, personal y reportes**. Todo corre sobre **Firebase** (Hosting, Authentication, Firestore y Storage), sin servidor propio.

## Funciones

| Módulo | Qué hace |
| --- | --- |
| **Cuenta y negocios** | Registro con correo o Google, verificación de correo, recuperación de contraseña. Asistente para crear el negocio (giro, moneda, impuestos, categorías, logo). Un usuario puede tener o pertenecer a varios negocios. |
| **Panel principal** | Ventas del día/semana/mes con comparación, ticket promedio, valorización del inventario, stock crítico, curva de ingresos, últimas ventas, categorías más vendidas y primeros pasos para negocios nuevos. |
| **Terminal POS** | Búsqueda y escaneo de códigos (lector USB/Bluetooth), multiplicador `3*CODIGO`, monto libre, descuentos con tope, efectivo/tarjeta/transferencia, cálculo de cambio, tickets en espera, ticket imprimible de 80 mm y atajos de teclado (F2, F8, F9, F10). **Funciona sin internet**: las ventas se sincronizan al volver la conexión. |
| **Inventario** | Catálogo con filtros, márgenes, niveles de stock, fotos (Storage), entradas de mercancía, mermas, ajustes por conteo, kardex por producto, importación/exportación CSV. |
| **Caja** | Apertura con fondo inicial y corte de caja (efectivo esperado vs. contado, diferencias, impresión del corte). |
| **Ventas** | Historial con filtros, reimpresión de tickets y anulación con motivo (devuelve el stock). |
| **Reportes** | Ingresos, utilidad, ticket promedio, mermas, rendimiento diario vs. meta, top productos, métodos de pago, mapa de calor por horario, ventas por cajero y categoría, histórico de cortes. |
| **Personal** | Invitaciones por correo con rol y permisos, suspensión/baja, matriz de roles y **bitácora de auditoría inmutable**. |
| **Configuración** | Datos del negocio y logo, impuestos y pie de ticket con vista previa, reglas de inventario, categorías, proveedores y consola de prueba del lector. |

## Stack

- Vite + React 19 + TypeScript + Tailwind CSS 4
- Firebase JS SDK (Auth, Firestore con caché persistente offline, Storage)
- React Router 7, íconos lucide-react
- Diseño basado en `retail_inventory_pos_system/DESIGN.md` y los mockups de cada carpeta de pantallas.

## Puesta en marcha

### 1. Crear el proyecto en Firebase

1. Entra a <https://console.firebase.google.com> y crea un proyecto.
2. **Authentication → Método de acceso**: habilita **Correo electrónico/contraseña** y **Google**.
3. **Firestore Database**: créala en modo producción (elige la región más cercana, p. ej. `us-central1` o `southamerica-east1`).
4. **Storage**: créalo. Nota: Firebase exige el **plan Blaze** (pago por uso, con nivel gratuito) para usar Cloud Storage en proyectos nuevos; el uso normal de una tienda pequeña queda dentro del nivel gratuito.
5. **Configuración del proyecto → Tus apps → Web (`</>`)**: registra una app web y copia el objeto `firebaseConfig`.

### 2. Configurar el proyecto local

```bash
npm install
cp .env.example .env.local   # en Windows: copy .env.example .env.local
```

Pega los valores de `firebaseConfig` en `.env.local`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Edita `.firebaserc` y cambia `tu-proyecto-firebase` por el ID real de tu proyecto.

### 3. Publicar reglas e índices (obligatorio antes de usar la app)

```bash
npm install -g firebase-tools
firebase login
npm run deploy:rules
```

Esto sube `firestore.rules`, `firestore.indexes.json` y `storage.rules`. La primera vez, la CLI pedirá autorizar que Storage lea Firestore (las reglas de Storage verifican la membresía al negocio): responde **sí**. Los índices tardan unos minutos en construirse.

### 4. Desarrollo

```bash
npm run dev
```

Abre <http://localhost:5173>, crea tu cuenta y tu negocio.

### 5. Desplegar en Firebase Hosting

```bash
npm run deploy          # build + reglas + índices + storage + hosting
# o solo la web:
npm run deploy:hosting
```

La app se publica en el sitio de Hosting indicado en `firebase.json` (`"site": "nibux"` → <https://nibux.web.app>). Agrega ese dominio (y cualquier dominio propio) en **Authentication → Configuración → Dominios autorizados** para que funcione el inicio de sesión con Google.

## Equipo, roles y permisos

- Quien crea el negocio es **Propietario** (acceso total; nadie puede editarlo ni darlo de baja).
- Roles con permisos predeterminados (personalizables por persona):

| Rol | Permisos por defecto |
| --- | --- |
| Administrador | Todos |
| Supervisor | Vender, descuentos, anular ventas, inventario, reportes |
| Cajero / Vendedor | Vender (y su propia caja) |
| Bodeguero / Almacén | Inventario |

- **Invitar**: en *Personal* se crea una invitación para un correo. La persona entra a la app con ese correo (Google o cuenta nueva **verificada**) y la acepta en la pantalla de bienvenida. Como no hay servidor de correo, la app ofrece copiar el mensaje o compartirlo por WhatsApp.
- Las reglas de seguridad de Firestore aplican estos permisos en el servidor (no solo en la interfaz): un cajero solo ve sus propias ventas, solo puede modificar el stock al vender, no puede borrar ventas, la bitácora no se puede editar, etc.

## Modelo de datos (Firestore)

```
users/{uid}                              perfil + negocios del usuario
invites/{businessId}_{email}             invitaciones pendientes
businesses/{bid}                         datos, impuestos, categorías y reglas
  ├─ members/{uid}                       rol, permisos, estado
  ├─ meta/counters                       folio consecutivo de tickets
  ├─ products/{id}                       catálogo y stock
  ├─ suppliers/{id}                      proveedores
  ├─ sales/{id}                          ventas (completadas / anuladas)
  ├─ movements/{id}                      kardex (entradas, salidas, ajustes, ventas)
  ├─ cashSessions/{id}                   aperturas y cortes de caja
  └─ activity/{id}                       bitácora de auditoría
```

Las ventas se registran con una **transacción** (folio consecutivo + validación de stock real + descuento de inventario + kardex). Sin conexión se guardan en cola con folio provisional `OFF-…` y se sincronizan solas.

## Estructura del código

```
src/
  app/            guardas de rutas y pantalla de configuración faltante
  components/     ui (kit de diseño), layout, charts, receipt (ticket)
  config/         constantes: roles, permisos, monedas, unidades…
  contexts/       Auth, Business (negocio activo), Catalog (productos), Cash (caja)
  features/       una carpeta por pantalla (auth, onboarding, dashboard, pos, inventory, sales, reports, staff, settings, profile)
  hooks/          suscripciones en tiempo real (ventas, kardex, equipo…)
  lib/            firebase, formato, fechas, totales, imágenes, utilidades
  services/       escrituras a Firestore (alineadas con firestore.rules)
  types/          tipos del modelo
```

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Verificación de tipos + build de producción en `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npm run deploy` | Build y despliegue completo a Firebase |
| `npm run deploy:hosting` | Solo la web |
| `npm run deploy:rules` | Solo reglas, índices y Storage |

## Emuladores (opcional)

Con Java instalado: `firebase emulators:start` y pon `VITE_USE_EMULATORS=true` en `.env.local`.

## Notas

- Los reportes se calculan en el navegador a partir de las ventas del rango elegido. Para volúmenes muy grandes (decenas de miles de tickets al mes) conviene agregar totales diarios con Cloud Functions.
- La carpeta raíz conserva los mockups originales (`dashboard_general/`, `terminal_de_ventas_pos/`, etc.) y el borrador `panel_de_inventario_comercial_y_pos.tsx` como referencia; no forman parte del build.
