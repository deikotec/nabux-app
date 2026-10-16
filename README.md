# Nabux — Inventario y Punto de Venta en la nube

Aplicación web para que cualquier persona cree su cuenta, registre su negocio y lleve el control de **inventario, ventas, caja, personal y reportes**. Todo corre sobre **Firebase** (Hosting, Authentication, Firestore y Storage), sin servidor propio.

## Funciones

| Módulo | Qué hace |
| --- | --- |
| **Cuenta y negocios** | Registro con correo o Google, verificación de correo, recuperación de contraseña. Asistente para crear el negocio (giro, moneda, impuestos, categorías, logo). Un usuario puede tener o pertenecer a varios negocios. |
| **Panel principal** | Ventas del día/semana/mes con comparación, ticket promedio, valorización del inventario, stock crítico, curva de ingresos, últimas ventas, categorías más vendidas y primeros pasos para negocios nuevos. |
| **Terminal POS** | Búsqueda y escaneo de códigos (lector USB/Bluetooth), multiplicador `3*CODIGO`, monto libre, descuentos con tope, efectivo/tarjeta/transferencia, cálculo de cambio, tickets en espera, ticket imprimible de 80 mm y atajos de teclado (F2, F8, F9, F10). **Funciona sin internet** (la app es instalable y abre sin conexión): las ventas se sincronizan al volver la conexión. |
| **Inventario** | Catálogo con filtros, márgenes, niveles de stock, fotos (Storage), entradas de mercancía, mermas, ajustes por conteo, kardex por producto, cambio de categoría en lote y exportación CSV. **Importación** desde Excel (con las fotos de los productos incrustadas), CSV o fotos de listas, facturas y productos (ver abajo). |
| **Caja** | Apertura con fondo inicial y corte de caja (efectivo esperado vs. contado, diferencias, impresión del corte). |
| **Ventas** | Historial con filtros, reimpresión de tickets y anulación con motivo (devuelve el stock). |
| **Reportes** | Ingresos, utilidad, ticket promedio, mermas, rendimiento diario vs. meta, top productos, métodos de pago, mapa de calor por horario, ventas por cajero y categoría, histórico de cortes. |
| **Personal** | Invitaciones por correo con rol y permisos, suspensión/baja, matriz de roles y **bitácora de auditoría inmutable**. |
| **Configuración** | Datos del negocio y logo, impuestos y pie de ticket con vista previa, reglas de inventario, categorías, proveedores y consola de prueba del lector. |

## Venezuela: modo bimonetario (USD + Bs)

Al crear el negocio elige **"Venezuela · Dólar + Bolívar (bimonetario)"** (o actívalo en *Configuración → Moneda y tasas*):

- **Precios y costos en dólares**, mostrados y cobrados también en bolívares a la tasa del día.
- **Tasas**: BCV (oficial), paralelo y tasa propia; eliges cuál usa el POS. Se actualizan solas desde [ve.dolarapi.com](https://ve.dolarapi.com) o a mano, con historial. Cada venta guarda la tasa con la que se cobró.
- **Formas de pago configurables**: efectivo $, efectivo Bs, pago móvil, punto de venta, transferencia, Zelle, Binance/USDT, Biopago, Cashea… con número de referencia cuando aplica.
- **Pagos mixtos** (ej. $10 en efectivo + resto por pago móvil) y **vuelto** en $, Bs o pago móvil.
- **IGTF** (3 %, configurable) sobre la parte pagada en divisas, e **IVA 16 %** con productos **exentos**.
- **Caja en dos monedas**: fondo inicial y corte de efectivo en $ y en Bs; los pagos electrónicos se totalizan por método para conciliar con el banco.
- **Ajuste masivo de precios** por porcentaje (inflación / cambio de proveedor).

## Importar productos (Excel, CSV y fotos)

*Inventario → Importar / Exportar → Importar productos*. Nada se guarda hasta revisar y confirmar.

- **Excel (.xlsx) y CSV**: encuentra la tabla aunque tenga títulos, logos o filas de totales; reconoce las columnas por su nombre y por sus datos ("Código" con 13 cifras es código de barras; "Precio" con textos no es un precio); entiende "1.234,56" y "1,234.56" mirando toda la columna; precios en Bs se pasan a $ con la tasa del día.
- **Fotos dentro del Excel**: las que flotan sobre la hoja y las de "Colocar en celda" (Excel 365) se asignan a su fila y se suben como foto del producto. También acepta una columna `imagen` con enlaces.
- **Productos que ya existen** (mismo SKU, código de barras o nombre): se omiten o se actualizan solo los campos que trae el archivo; el stock puede no tocarse, **sumarse como entrada** (facturas de compra, queda en el kárdex) o reemplazarse (conteo).
- **Revisión**: filas nuevas / a actualizar / omitidas / con errores, corrección fila por fila, quitar filas, renombrar o unir categorías, y calcular el precio de venta desde el costo con un margen.
- **Con IA** (opcional, ver *IA* más abajo): propone qué es cada columna, las categorías del catálogo (reutilizando las tuyas) y clasifica los productos sin categoría; lee **fotos de listas de precios, facturas y catálogos**, y reconoce productos a partir de su foto. Sin IA, una foto por producto usa el nombre del archivo (`7591234567890.jpg` → código de barras, `PRD-0042.png` → SKU, `Harina PAN 1kg.jpg` → nombre): sirve para ponerle foto a productos que ya tienes.
- **Organizar categorías con IA**: propone categoría para los productos en "General" (o todo el catálogo, o los seleccionados); tú revisas y apruebas.

## IA (Gemini con Firebase AI Logic)

La IA corre desde el navegador con **Firebase AI Logic** (sin servidor y sin claves en el código). Firebase exige **App Check** para usarla:

1. **Google Cloud Console → Seguridad → reCAPTCHA** (mismo proyecto): crea una clave de tipo *sitio web* con los dominios `nabuxx.web.app`, `<proyecto>.firebaseapp.com` y `localhost`.
2. **Firebase → App Check → Apps**: registra la app web con **reCAPTCHA Enterprise** y esa clave.
3. **Firebase → AI Logic**: actívalo con la *Gemini Developer API*.
4. Pon la clave en `.env.local` (`VITE_RECAPTCHA_SITE_KEY=...`), `npm run deploy:hosting`, usa la IA una vez y comprueba en *App Check → APIs* que las solicitudes salen verificadas.
5. **App Check → APIs → Firebase AI Logic → Aplicar** (*Enforce*). **No** apliques App Check a Firestore, Storage ni Authentication si el proyecto lo comparte otra app.

En local, pon `VITE_APPCHECK_DEBUG_TOKEN=true`, copia el token que aparece en la consola del navegador y regístralo en *App Check → Administrar tokens de depuración*. Sin la clave, todo funciona con reglas automáticas y la pantalla lo indica. Los modelos por defecto son `gemini-3.5-flash-lite` (texto) y `gemini-3.6-flash` (fotos); se cambian con `VITE_AI_MODEL` / `VITE_AI_VISION_MODEL`.

## App instalable (PWA) y uso sin internet

Nabux se instala como app desde el navegador: en Android/Chrome, menú **⋮ → Instalar app** (o el aviso de instalación); en iPhone/Safari, **Compartir → Agregar a inicio**; en computadora, el ícono de instalar de la barra de direcciones. El ícono abre directo en el inicio de sesión (sin la landing) y tiene accesos directos a *Nueva venta*, *Inventario* y *Ventas*.

- **Abre sin internet.** El service worker (`vite-plugin-pwa` + Workbox, configurado en `vite.config.ts`) guarda toda la app en el dispositivo la primera vez que se visita; los datos los guarda la caché persistente de Firestore. Sin red se puede abrir, recargar y navegar a cualquier sección, y las ventas se sincronizan al volver la conexión. También se guardan las fotos de productos y la tipografía.
- **Actualizaciones.** Tras un `deploy`, la app avisa *"Hay una versión nueva"* y se actualiza cuando la persona toca **Actualizar** (nunca a mitad de una venta). Busca versiones nuevas al abrir y cada hora.
- **Móvil.** Barra de navegación inferior tipo app (Inicio, Vender, Inventario, Ventas y *Más* para el resto, según los permisos). Respeta la muesca y la barra de inicio del iPhone (`viewport-fit=cover` + `env(safe-area-inset-*)`), oculta los atajos de teclado en pantallas táctiles y muestra el estado *Sin conexión* en la barra superior.
- **Tickets en el celular.** La impresión automática al cobrar viene activada solo en computadoras; en celulares y tabletas queda apagada (se puede activar en el POS si hay una impresora Bluetooth). El ticket se puede **compartir** como texto (WhatsApp, correo…) con el menú nativo del teléfono.
- **Probarlo en local:** `npm run build && npm run preview`, abre la app, y en DevTools → *Application → Service workers* marca *Offline* y recarga. En `npm run dev` el service worker está desactivado.

## Stack

- Vite + React 19 + TypeScript + Tailwind CSS 4
- Firebase JS SDK (Auth, Firestore con caché persistente offline, Storage, AI Logic + App Check cargados bajo demanda)
- Lector de Excel propio (`src/lib/xlsx.ts`, sin dependencias: ZIP + XML con `DecompressionStream`)
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

La app se publica en el sitio de Hosting indicado en `firebase.json` (`"site": "nabuxx"` → <https://nabuxx.web.app>). Agrega ese dominio (y cualquier dominio propio) en **Authentication → Configuración → Dominios autorizados** para que funcione el inicio de sesión con Google.

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
                  inventory/import: importador (tabla, columnas, validación, IA, pantalla)
  hooks/          suscripciones en tiempo real (ventas, kardex, equipo…)
  lib/            firebase, IA (ai.ts), lector de Excel (xlsx.ts), formato, fechas, totales, imágenes, utilidades
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
