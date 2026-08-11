# Dashboard de reservas — Terron Studio

Panel privado que usan los restaurantes para gestionar sus reservas, más el área de
administración de Terron Studio para dar de alta restaurantes nuevos.

**No** es la web pública de reservas. La web pública y el motor de asignación de
mesas viven en n8n; este panel los consume.

Producción: `https://reservations.terron-studio.com`

---

## Índice

1. [Arrancar en local](#1-arrancar-en-local)
2. [Variables de entorno](#2-variables-de-entorno)
3. [Despliegue en Vercel](#3-despliegue-en-vercel)
4. [Quién entra y qué ve](#4-quién-entra-y-qué-ve)
5. [Uso diario: dashboard del restaurante](#5-uso-diario-dashboard-del-restaurante)
6. [Uso del área admin: dar de alta un restaurante](#6-uso-del-área-admin-dar-de-alta-un-restaurante)
7. [Configuración manual en Supabase](#7-configuración-manual-en-supabase-importante)
8. [Columnas que asume el código](#8-columnas-que-asume-el-código)
9. [Backend n8n](#9-backend-n8n)
10. [Errores frecuentes y qué significan](#10-errores-frecuentes-y-qué-significan)
11. [Validar antes de desplegar](#11-validar-antes-de-desplegar)
12. [Estructura del proyecto](#12-estructura-del-proyecto)
13. [Lo que todavía no está hecho](#13-lo-que-todavía-no-está-hecho)

---

## 1. Arrancar en local

```bash
npm install
cp .env.example .env.local   # y rellenar los dos valores
npm run dev
```

Abre `http://localhost:3000`. Si el 3000 está ocupado, Next coge el siguiente
libre (3001, 3002…) y lo dice en la consola — mira ahí el puerto real.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Auth + RLS).

> Al arrancar `next dev` se regenera `AGENTS.md` en la raíz. Es normal, lo crea
> Next; se puede commitear sin problema.

---

## 2. Variables de entorno

Solo dos, y las dos son públicas (van al navegador):

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

- Van en **`.env.local`** (está en `.gitignore`, nunca se sube a git).
- `.env` sería para valores por defecto compartidos; aquí no hace falta.
- **Nunca** metas la `service_role` / secret key en este proyecto. Todo el acceso
  a datos va con la sesión del usuario autenticado y RLS. Si algún día hace falta
  una operación privilegiada, va en n8n o en una edge function, no aquí.

Si cambias una variable, **reinicia el servidor**: las `NEXT_PUBLIC_*` se
incrustan en el bundle al compilar.

---

## 3. Despliegue en Vercel

No hace falta subir ningún `.env`. Las variables se definen en el dashboard:

**Project → Settings → Environment Variables** (o `vercel env add`).

Detalles que se olvidan:

- Las `NEXT_PUBLIC_*` se congelan **en build time**. Si las cambias en Vercel,
  hay que **redeploy**, no basta con reiniciar.
- `vercel env pull .env.local` te baja a local las que hay en Vercel.
- Dominio: apunta `reservations.terron-studio.com` al proyecto en
  Settings → Domains.

---

## 4. Quién entra y qué ve

No hay registro público. Las cuentas se crean desde Supabase Auth.

| Tipo de usuario | Cómo se identifica | Qué ve |
|---|---|---|
| Personal de restaurante | tiene fila en `restaurant_users` | su dashboard (`/`, `/reservations`, …) |
| Superadmin (Terron Studio) | `user_profiles.global_role = 'superadmin'` | además el área `/admin`: alta de restaurantes y plano de mesas de cualquiera |

Cómo funciona por dentro:

- **Sin sesión** → cualquier ruta redirige a `/login` (lo hace `src/proxy.ts`,
  que en Next 16 es lo que antes se llamaba middleware).
- **Restaurante**: el restaurante se resuelve desde `restaurant_users` con el
  `user_id` de la sesión. El ID **nunca** se coge de la URL. Si el usuario tiene
  un solo restaurante, se selecciona solo.
- **Admin**: `/admin` comprueba `global_role`. Si no eres superadmin te manda a
  `/`. Además **cada acción de admin vuelve a comprobarlo** en el servidor, así
  que no basta con adivinar una URL.
- Si un superadmin no tiene restaurante propio, en `/` le sale un acceso directo
  al área admin en lugar de una pantalla muerta.

Logout: icono de salida abajo en la barra lateral.

---

## 5. Uso diario: dashboard del restaurante

Barra lateral en dos grupos: **operación** (lo que pasa hoy) y **configuración**.

### Today (`/`)
Pantalla de servicio. Reservas de hoy en orden cronológico, con resumen arriba
(reservas, cubiertos, próxima llegada, canceladas). A la derecha, en pantallas
grandes, el plano isométrico de mesas. Click en una reserva o en una mesa abre el
detalle.

#### Qué significa cada badge de una mesa

Cada mesa puede mostrar dos cosas **a la vez**:

| Badge | Significado |
|---|---|
| Círculo negro con un número | hay gente sentada **ahora**; el número son los **comensales** |
| Pastillas blancas con horas | reservas que **quedan por venir** hoy en esa mesa |
| `+N` | hay N reservas más además de las dos que se muestran |
| Sin nada | esa mesa no tiene nada más hoy |

**Cuándo se considera "sentada"**: desde `starts_at` hasta `ends_at`, tal cual
está en la base de datos. La duración de una reserva que ya existe **nunca** se
recalcula a partir del ajuste "Default reservation duration"; ese ajuste solo se
usa como respaldo si a una reserva le falta `ends_at`. Así el plano y el
calendario dicen siempre lo mismo, y cambiar el ajuste no reescribe el pasado.

Se comparan instantes, no horas de reloj, así que un turno que cruza medianoche
se sigue viendo correctamente.

#### Organizar el plano de mesas

Botón **Arrange tables** abajo a la derecha del plano. Sirve para colocar las
mesas más o menos como están en el local.

- **Arrastra** una mesa, o selecciónala y usa las **flechas del teclado**.
- Se mueve **de una posición a la vez**, siempre a lo largo de los dos ejes del
  cuadrado que simula la sala (en pantalla se ven en diagonal, porque la vista es
  isométrica).
- La sala son 6 × 6 posiciones. Si sueltas una mesa encima de otra, **se
  intercambian**; no se apilan nunca.
- **Save layout** guarda; **Discard** deja todo como estaba. Mientras organizas,
  las reservas no se pueden abrir: es un modo aparte.
- Si nunca has organizado el plano, se ve la distribución por defecto (cuatro por
  fila). Guardar solo afecta a la posición: no toca reservas ni capacidades.

Requiere las columnas `grid_x` y `grid_y` (ver §7.1). Sin ellas el plano funciona
igual, pero al guardar sale un aviso pidiendo la migración.

### Reservations (`/reservations`)
Listado completo. Rangos: Hoy, Próximas, Esta semana, Este mes, Pasadas,
Personalizado. El rango va **en la URL**, así que puedes guardar o compartir una
vista filtrada. El filtro de estado y la búsqueda (nombre o teléfono) son
instantáneos. Paginación con "Show more" de 60 en 60.

### Calendar (`/calendar`)
Vista **día** con línea de tiempo por horas y bandas sombreadas en las horas en
que se aceptan reservas. Vista **semana** con 7 columnas (a partir de 1280 px de
ancho); si hay más reservas solapadas de las que caben, aparece un badge **`+N`**
que abre ese día en vista día. Por debajo de 1280 px la semana se muestra como
lista por días, que se lee mucho mejor en tablet/móvil.

### Tables (`/tables`)
Dos pestañas:
- **Tables**: mesas por zona, con asientos. "Take out" / "Put back" saca o
  devuelve una mesa al servicio. Desde el dashboard **no se borran** mesas
  (rompería el histórico de reservas); solo se desactivan.
- **Combinations**: qué mesas se pueden juntar para grupos grandes. Se definen
  **a mano, siempre**: el sistema no junta mesas por su cuenta. Mínimo 2 mesas
  por combinación. Los asientos se proponen como suma de las mesas pero se pueden
  ajustar.

### Schedule (`/schedule`)
Horarios de reserva por día de la semana, empezando en lunes. Un día puede tener
**varios turnos** (13:00–16:00 y 20:00–23:30). Un día sin turnos activos = cerrado.

**Turnos que pasan de medianoche**: pon 20:00 → 01:30 y ya está. El sistema
detecta que cruza medianoche y lo guarda solo (`spans_next_day`); te lo confirma
con un aviso en el propio formulario. No hay que marcar nada.

"Pause" deja un turno guardado pero sin aceptar reservas. La papelera lo borra.

### Special dates (`/special-dates`)
Excepciones a los horarios semanales: festivos, cierres, eventos privados.
Dos opciones por fecha: **Cerrado** todo el día, u **horario distinto**. También
soporta pasar de medianoche (31 dic 20:00 → 02:00). Una fecha especial **siempre
manda** sobre el horario semanal de ese día. Se listan separadas en "Coming up" y
"Past".

### Settings (`/settings`)
Reglas de reserva, en lenguaje de restaurante:

| En pantalla | Qué controla |
|---|---|
| Time between available slots | cada cuánto se ofrece una hora (min) |
| Default reservation duration | cuánto se retiene una mesa (min) |
| Maximum online party size | grupo máximo que puede reservar solo |
| Minimum booking notice | antelación mínima (min) |
| How far in advance customers can book | ventana de reserva (días) |

También el nombre del restaurante y la **zona horaria** — todas las horas del
panel se muestran y se reservan en esa zona.

### Crear, modificar y cancelar reservas
Botón **+ New reservation**, presente en todas las pantallas de operación.

1. Fecha y número de personas.
2. El panel pide huecos al backend y solo muestra **los que devuelve**.
3. Hora, nombre, teléfono (obligatorios), email y notas (opcionales).

Modificar: solo fecha, hora y personas, y **siempre** se vuelven a consultar
huecos antes. El teléfono se coge internamente de la reserva, no se pide.
La asignación de mesa la decide el motor de reservas, no el panel.

Cancelar: pide confirmación. La reserva **no se borra**, queda marcada como
cancelada (tachada y atenuada) para conservar el histórico.

### Datos al día
Si entra una reserva desde la web pública, el panel se actualiza solo. Usa
Supabase Realtime cuando está disponible y, como red de seguridad, refresca al
volver a la pestaña y cada 60 s. No hace falta recargar a mano.

---

## 6. Uso del área admin: dar de alta un restaurante

Solo superadmins. `/admin` (resumen) y `/admin/restaurants` (listado).

En el listado ves nombre, dominio, estado (**Live** / **Setting up**) y fecha de
alta, con acciones para activar, desactivar, editar o **continuar un alta a medias**.

### El asistente, paso a paso

**+ New restaurant** → `/admin/restaurants/new`

**Paso 1 — Restaurant.** Nombre y dominio de producción.

El dominio es lo importante: se guarda en `restaurants.slug` y **es el
identificador con el que n8n reconoce al restaurante**. Se normaliza solo, y ves
el resultado en vivo mientras escribes:

| Escribes | Se guarda |
|---|---|
| `www.restaurant.com` | `restaurant.com` |
| `https://restaurant.com` | `restaurant.com` |
| `restaurant.com/` | `restaurant.com` |
| `HTTPS://WWW.Restaurant.COM/menu?x=1` | `restaurant.com` |
| `restaurant.com:3000` | `restaurant.com` |

Es decir: se quitan protocolo, `www.`, ruta, query, puerto y barra final, y se
pasa a minúsculas. Un dominio ya usado por otro restaurante da error explícito.

El restaurante se crea **desactivado** (`active = false`). No es reservable
todavía.

**Paso 2 — Booking settings.** Los mismos ajustes que ve el restaurante. Aquí
los campos salen **vacíos a propósito**, con el valor habitual solo como
sugerencia gris (placeholder). Hay que revisarlos y guardarlos con intención; no
se inventan valores de producción por ti.

**Paso 3 — Weekly schedule.** Turnos por día. Varios turnos por día, y turnos
que cruzan medianoche igual que en el panel del restaurante.

**Paso 4 — Tables.** Mesas físicas: nombre, asientos, zona (opcional). Aquí
**sí** se pueden borrar mesas, porque durante el alta todavía no hay historial.
Si una mesa ya ha tenido reservas, el borrado falla y el mensaje te dice que la
desactives en su lugar.

**Paso 5 — Combinations.** Opcional. Se puede saltar. Necesita al menos 2 mesas
creadas.

**Paso 6 — Review & activate.** Resumen completo: restaurante, dominio, ajustes,
horario por día, mesas y combinaciones. Lo que falte sale marcado como
**"Not set"**. Si falta algo imprescindible, el botón de activar está desactivado
y un aviso dice exactamente qué falta.

**Activar** pone `restaurants.active = true`. A partir de ese momento el motor de
reservas ya lo resuelve por su slug. **No hay que tocar n8n.**

### Ver el plano de mesas de un restaurante (`/admin/floors`)

Pestaña **Table map** en la barra lateral del admin. Muestra el servicio de hoy
de cualquier restaurante **activo**, exactamente como lo ve su propio equipo en
su pantalla Today: mismas mesas, mismo plano isométrico, misma zona horaria.

- Selector de restaurante arriba a la derecha. La selección va en la URL
  (`/admin/floors?restaurant=<id>`), así que se puede guardar o compartir.
- Resumen del día (reservas, cubiertos, próxima llegada, canceladas o mesas en
  servicio) y lista de reservas de hoy.
- El plano solo aparece a partir de 1024 px de ancho; por debajo se ve la lista,
  que es lo útil en móvil.
- Enlace **Config** para saltar a la configuración de ese restaurante.
- Se actualiza solo igual que el panel del restaurante (Realtime + refresco al
  volver a la pestaña).

Al abrir una reserva desde aquí, el detalle es **de solo lectura**: no salen
Modify ni Cancel. No es un olvido — esas acciones resuelven el restaurante desde
la sesión del usuario, y un superadmin no es miembro de los restaurantes que está
mirando. Para tocar una reserva hay que hacerlo desde el panel del restaurante.

Solo lista restaurantes activos: los que están en alta todavía no tienen un
servicio que mirar.

### Dejar el alta a medias y volver luego

Puedes cerrar el navegador en cualquier punto. El asistente **no guarda progreso
propio**: calcula qué pasos están hechos mirando los datos que hay en Supabase.

- Ajustes hechos = existe la fila de `restaurant_settings` con los 6 valores.
- Horario hecho = hay al menos un turno activo.
- Mesas hechas = hay al menos una mesa activa.
- Combinaciones = opcional, nunca bloquea.

Al entrar en un restaurante sin indicar paso, te deja directamente en **el primer
paso que falta**. Por eso "Continue setup" en el listado no requiere pensar. Y
funciona en otra sesión, otro ordenador u otro superadmin.

### Editar un restaurante ya activo
La misma pantalla `/admin/restaurants/[id]`. Los pasos hacen de secciones de
edición. Ahí también se **desactiva** un restaurante (deja de aceptar reservas
nuevas; las existentes no se tocan).

---

## 7. Configuración manual en Supabase (importante)

Esto es lo que **no** se puede hacer desde el código y hay que dejar listo en el
proyecto de Supabase.

### 7.1 Columnas necesarias
- `restaurants` necesita una columna **`active` boolean**. Si no existe, el alta
  de restaurantes falla al insertar. (El código trata un valor ausente como
  inactivo, nunca como "live", por seguridad.)
- `restaurant_settings` necesita un **índice único en `restaurant_id`**, porque
  el guardado usa `upsert ... onConflict: restaurant_id`.
- Para poder **organizar el plano de mesas**, `restaurant_tables` necesita dos
  columnas de posición. Comprobado contra tu proyecto: **todavía no existen**.

  ```sql
  alter table restaurant_tables
    add column if not exists grid_x smallint,
    add column if not exists grid_y smallint;
  ```

  Son opcionales (`null` = sin colocar) y solo las usa el plano. Hasta que
  existan, el mapa se ve con la distribución por defecto y al guardar aparece:
  *"Saving the floor plan needs two extra columns on the tables…"*.
- Recomendado: **índice único en `restaurants.slug`**. La app ya comprueba
  duplicados y da un mensaje legible, pero el índice evita una carrera entre dos
  altas simultáneas.

### 7.2 Políticas RLS
Nada en este proyecto salta RLS, así que si falta una política la pantalla carga
pero el guardado falla con *"You do not have permission to change this setting."*

**Personal de restaurante** — SELECT en `restaurant_users`, `restaurants`,
`restaurant_settings`, `restaurant_tables`, `table_combinations`,
`table_combination_members`, `booking_hours`, `special_dates`, `bookings`,
`booking_tables`; e INSERT/UPDATE/DELETE en las de configuración
(`restaurant_tables`, `table_combinations`, `table_combination_members`,
`booking_hours`, `special_dates`) y UPSERT en `restaurant_settings`, siempre
limitado a sus restaurantes vía `restaurant_users`.

**Superadmin** — lo mismo pero sobre **cualquier** restaurante, más INSERT y
UPDATE en `restaurants`. Se suele expresar con una condición del tipo:

```sql
(select global_role from user_profiles where id = auth.uid()) = 'superadmin'
```

### 7.3 Realtime (opcional)
Para que las reservas nuevas aparezcan al instante, añade la tabla `bookings` a
la publicación `supabase_realtime`. Si no lo haces, el panel sigue actualizándose
por foco de pestaña y cada 60 s.

### 7.4 Usuarios
- Crear las cuentas en Supabase Auth (no hay registro público).
- Personal: una fila en `restaurant_users (user_id, restaurant_id, role)`.
- Superadmin: fila en `user_profiles` con `global_role = 'superadmin'`.

---

## 8. Columnas que asume el código

Las **lecturas** son tolerantes: `src/lib/types.ts` acepta variantes habituales de
nombre (`customer_name` o `name`, `party_size` o `guests`…). Si un dato sale
vacío en pantalla, ahí se añade el nombre real de la columna.

Las **escrituras** usan nombres exactos, en un solo sitio:
`src/lib/restaurant-config.ts`. Si un guardado falla por columna desconocida, es
el único archivo que hay que tocar.

| Tabla | Columnas que se escriben |
|---|---|
| `restaurants` | `name`, `slug`, `active` |
| `restaurant_settings` | `restaurant_id`, `restaurant_name`, `timezone`, `slot_interval_minutes`, `default_booking_duration_minutes`, `max_online_party_size`, `min_advance_minutes`, `max_advance_days` |
| `restaurant_tables` | `restaurant_id`, `name`, `capacity`, `zone`, `active`, `grid_x`, `grid_y` |
| `table_combinations` | `restaurant_id`, `name`, `capacity`, `active` |
| `table_combination_members` | `combination_id`, `table_id` |
| `booking_hours` | `restaurant_id`, `day_of_week`, `start_time`, `end_time`, `spans_next_day`, `active` |
| `special_dates` | `restaurant_id`, `date`, `closed`, `start_time`, `end_time`, `spans_next_day`, `note` |

Notas:
- `day_of_week`: **0 = domingo**, 1 = lunes … 6 = sábado. En pantalla siempre se
  muestra empezando en lunes.
- Las reservas se leen por **`starts_at` / `ends_at`** (timestamptz). Las columnas
  antiguas `booking_date` / `start_time` / `end_time` no se usan.
- El **dominio se guarda en `slug`**, no hay columna `domain` aparte.
- Las reservas **nunca** se escriben desde aquí (ver siguiente sección).

---

## 9. Backend n8n

Regla: **Supabase es la fuente de verdad y se lee directo bajo RLS**, pero todo
lo que implique disponibilidad, asignación de mesa o concurrencia va por n8n. El
panel no reimplementa esa lógica ni escribe reservas en Supabase.

Base: `https://gonrodter.app.n8n.cloud/webhook/`

| Endpoint | Para qué |
|---|---|
| `restaurant-availability` | huecos disponibles |
| `restaurant-create-booking` | crear reserva |
| `restaurant-update-booking` | mover reserva |
| `restaurant-cancel-booking` | cancelar |

Se llaman **solo desde el servidor** (`src/lib/n8n.ts`). El `restaurantSlug` se
resuelve siempre desde la sesión, nunca lo manda el navegador. En modificar y
cancelar, el `bookingId` se comprueba antes bajo RLS y el teléfono se saca de la
propia reserva.

---

## 10. Errores frecuentes y qué significan

| Mensaje | Causa probable |
|---|---|
| "You do not have permission to change this setting." | falta política RLS para ese rol y tabla |
| "That already exists. Use a different name." | choque de unique (nombre de mesa, slug…) |
| "That change conflicts with existing records..." | borrado bloqueado por FK: desactiva en lugar de borrar |
| "`x.com` is already used by another restaurant." | ese dominio ya está dado de alta |
| "Your account has no restaurant assigned yet." | falta la fila en `restaurant_users` |
| "Saving the floor plan needs two extra columns…" | falta la migración `grid_x` / `grid_y` (§7.1) |
| "Could not reach the reservations service." | n8n caído o sin red |
| "The reservations service could not complete this request." | n8n respondió error |
| Login correcto pero pantallas vacías | RLS de SELECT o nombres de columna (ver §8) |
| Se ve "No tables in service" con mesas creadas | están todas desactivadas (`active = false`) |

Por diseño, la interfaz **nunca** muestra SQL, errores internos de Supabase o de
n8n, ni stack traces.

---

## 11. Validar antes de desplegar

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # build de producción
```

Comprobación rápida de que las rutas están protegidas (sin sesión todas deben dar
`307` a `/login`):

```bash
for p in / /reservations /calendar /tables /schedule /special-dates /settings \
         /admin /admin/restaurants /admin/restaurants/new; do
  printf "%-28s " "$p"
  curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" "http://localhost:3000$p"
done
```

Con sesión real conviene repasar: login/logout, que un usuario de restaurante
**no** entra en `/admin`, crear/modificar/cancelar una reserva, y que el alta de
un restaurante se puede interrumpir y retomar.

---

## 12. Estructura del proyecto

```
src/
  proxy.ts                  guard de sesión (el "middleware" de Next 16)
  app/
    login/                  email + contraseña
    (dashboard)/            panel del restaurante
      page.tsx              Today
      reservations/ calendar/ tables/ schedule/ special-dates/ settings/
    admin/                  área superadmin (layout comprueba global_role)
      restaurants/ new/ [id]/
      floors/               plano de mesas de cualquier restaurante activo
  lib/
    supabase/               clientes browser y server (@supabase/ssr)
    data.ts                 lecturas del restaurante (RLS)
    admin-data.ts           lecturas de admin + requireSuperadmin + estado del alta
    restaurant-config.ts    TODAS las escrituras de configuración validadas
    config-actions.ts       acciones del restaurante (id desde la sesión)
    admin-actions.ts        acciones de admin (id desde la URL, tras validar rol)
    n8n.ts                  llamadas al motor de reservas
    dates.ts                zonas horarias, semanas, turnos nocturnos
    slug.ts                 normalización de dominio
    floor-grid.ts           rejilla del plano y conversión de arrastre
    wizard-steps.ts         pasos del alta (módulo plano: lo usan servidor y cliente)
    types.ts                normalización de filas de Supabase
    errors.ts               mensajes de error para humanos
  components/
    editors/                Schedule, Tables, Combinations, Settings
                            (compartidos por el panel y el asistente)
    admin/                  listado, asistente, formulario de alta
```

Lo importante de la estructura: los editores de `components/editors/` y los
escritores de `restaurant-config.ts` son **los mismos** para el panel del
restaurante y para el asistente de admin. Solo cambia de dónde sale el ID del
restaurante. Si arreglas algo en un sitio, queda arreglado en los dos.

---

## 13. Lo que todavía no está hecho

- Invitar usuarios / crear personal del restaurante (siguiente paso previsto).
- Facturación, Stripe, suscripciones.
- Alta de dominios y despliegue de la web del restaurante.
- Analítica e informes.
- Reasignar mesa a mano en una reserva: lo decide el motor de reservas.
- Organizar el plano desde el área admin: solo puede el equipo del restaurante
  (el mapa de admin es de consulta).
- Selector de restaurante para usuarios con varios asignados: la arquitectura ya
  lo soporta (se resuelve una lista), pero solo se auto-selecciona el primero.
