# Registro de Rango

App de registro de sesiones de practica de golf (rango y putting). PWA
instalable, pensada para usarse parado en el driving range o en el green,
sin depender de wifi.

Migrada desde un artifact de un solo archivo HTML (ver [`legacy/`](legacy/))
a un proyecto propio con Vite, IndexedDB y service worker.

## Variantes de sesion

- **A** — Approach corto (<120 yds)
- **B** — Distancia media (120-150 yds)
- **C** — Precision hierros largos (150-185 yds)
- **D** — Putting semanal (registro por bloque, no tiro a tiro)
- **E** — Drive y recuperacion

Cada tiro (o bloque, en D) registra Think Box, Play Box, resultado post-shot
(1-5) y, en algunos casos, distancia real. La app guarda el historial y
calcula un "foco sugerido" para la proxima practica en base al bloque de
peor rendimiento reciente.

## Antes de jugar (Warm-up + Tempo Trainer)

Dos modulos separados de las 5 variantes de practica (no son "practica", son
prep pre-ronda: no tienen Think Box/Play Box/resultado).

- **Warm-up**: 3 planes fijos segun tiempo disponible (10 / 20-30 / 45 min),
  escritos a mano en `src/warmup.js`. Estructura siempre movilidad -> wedges
  -> medios -> largos/driver -> putting; si el tiempo es corto se recorta el
  bloque medio primero, nunca movilidad ni putting. Timer de referencia por
  bloque (avance manual, no auto-avanza). Guarda historial liviano
  (`fecha + duracion elegida`) en el store `warmups`, fuera del CSV export.
- **Tempo Trainer**: metronomo de audio 3:1 (Tour Tempo / Sonic Golf).
  Velocidad: slider de 6 presets estilo Garmin Tempo Trainer Pro (Amateur/Pro
  x Lento/Medio/Rapido, `TEMPOS` en `src/tempo/engine.js`; Garmin publica
  solo back/down en segundos, pausa/tail/rest se derivaron proporcionalmente
  al resto de la curva). Sonido: **Natural** (ruido filtrado) y **GolfSaber**
  (ring-modulation, ex "Star Wars"/"Sintetico") sin cambios de sintesis;
  **Relax** (cuenco tibetano: parciales inarmonicos con *beating* entre
  osciladores destemplados) reemplaza al Organo original. Reverb/eco
  (bus de 4 delays en paralelo, sin archivo de impulso) y contraste dinamico
  ajustables, colapsados bajo "Ajustes de sonido" para no ocupar la pantalla
  inicial. Cada motor recuerda su propio grave/agudo/reverb/dinamica.
  Preferencias persistidas en el store `settings`. Acceso desde el home y
  desde el bloque final del Warm-up.
  Reverb, dinamica y el motor Relax se disenaron primero en un artifact
  aparte ("Tempo Sound Lab") antes de llevarlos a la app.

Detalles de arquitectura no obvios:
- `src/tempo/engine.js` es una factory (`createTempoEngine`) con
  `dispose()` explicito: a diferencia del prototipo (pagina estatica), esta
  app intercambia pantallas sin recargar, asi que el AudioContext y el
  `setTimeout` que encadena ciclos necesitan un cierre manual o quedan
  sonando en segundo plano para siempre.
- `screens/tempo.js` es la unica pantalla que NO hace un re-render completo
  en cada interaccion (el resto de la app reconstruye todo el innerHTML en
  cada cambio) - el marcador anima via `requestAnimationFrame` en paralelo
  al audio, y reconstruir el DOM del track en cada click cortaria esa
  animacion. Actualiza el DOM de forma imperativa, igual que el prototipo.
- `main.js` tiene un mecanismo generico de cleanup-al-navegar-afuera
  (`SCREEN_CLEANUP`) para las pantallas que dejan algo vivo entre renders
  (el motor de audio, el timer del warm-up).

## Otras piezas

- **Cancelar sesion**: en las 3 pantallas de sesion (tiro-a-tiro, bloques,
  warm-up) hay un boton "Cancelar sesion" (`src/confirmDiscard.js`, dos
  pasos de confirmacion) que descarta sin escribir nada en IndexedDB -
  distinto de "Guardar y salir", que persiste como `finished:false`.
- **Historial con borrado**: `screens/history.js` muestra tambien las
  sesiones sin terminar (antes invisibles, solo rescatables via CSV) con
  tag "En progreso" y boton borrar (confirmacion en dos pasos,
  `db.deleteSession`). El grafico de tendencia y el foco sugerido siguen
  usando solo las sesiones finalizadas.
- **Acerca de**: `screens/about.js`, accesible desde un link al pie del home.
- **Safe area**: `.gc-header` y `.gc-sea-banner` usan
  `env(safe-area-inset-top)` (Dynamic Island/notch) y el body
  `env(safe-area-inset-bottom)` (home indicator) - necesario corriendo como
  PWA instalada a pantalla completa.

## Desarrollo

```bash
npm install
npm run dev
```

Abre en `http://localhost:5173`.

## Build de produccion

```bash
npm run build
npm run preview
```

`npm run build` genera `dist/` con el service worker (precache del app
shell completo: JS, CSS, fuentes, iconos) via `vite-plugin-pwa`.

## Estructura

```
index.html
vite.config.js        # config de Vite + manifest/SW (vite-plugin-pwa)
src/
  main.js              # entry point, orquesta estado y dispatcher de pantallas
  variants.js           # las 5 variantes (A-E) + builders de tiros/bloques
  warmup.js               # los 3 planes de warm-up (10/20-30/45 min)
  stats.js               # computeStats + suggestFocus (foco sugerido)
  csv.js                 # export a CSV
  db.js                   # capa de persistencia (IndexedDB)
  confirmDiscard.js        # boton "Cancelar sesion" compartido (2 pasos)
  styles.css
  tempo/
    engine.js            # motor de audio del Tempo Trainer (Web Audio API)
  screens/
    home.js, sessionShots.js, sessionBlocks.js, summary.js, history.js,
    warmupSelect.js, warmupSession.js, tempo.js, about.js
scripts/
  generate-icons.mjs    # genera los PNG del icono desde src/icon.svg
public/icons/           # iconos PWA generados (no editar a mano)
legacy/                 # prototipos originales (artifacts de un solo archivo), como referencia
```

## Datos y storage

Todo se guarda localmente en IndexedDB (base `golf-range-db`), no hay
backend ni sync remoto:
- `sessions`: las 5 variantes de practica (variante, bloques, tiros,
  `finished`). El export a CSV recorre este store.
- `warmups`: historial liviano de warm-ups (`fecha + duracion`), fuera del CSV.
- `settings`: preferencias persistidas (hoy solo las del Tempo Trainer).

Si en algun momento cambia el modelo de datos, hay que sumar una migracion
en el `upgrade()` de `src/db.js` (bump de `DB_VERSION`).

## Icono

Para regenerar los PNG del icono despues de tocar `src/icon.svg`:

```bash
npm run icons
```

## Instalar en iPhone (Agregar a inicio)

Un service worker no funciona por `file://` (salvo en localhost), asi que
para instalarla como icono real hace falta servirla por HTTPS. Plan:
GitHub Pages, sirviendo el contenido de `dist/` (build de produccion).
