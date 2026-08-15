# GolfSaber

App de registro de sesiones de practica de golf (rango y putting). PWA
instalable, pensada para usarse parado en el driving range o en el green,
sin depender de wifi. El nombre es un guino al motor "Saber" del Tempo
Trainer (ring-modulation, ex "Star Wars"), no describe la app entera - la
app en si es un registro de practica con 5 variantes + warm-up + tempo
trainer, ver mas abajo. La URL/repo se mantiene como `golf-range-app` por
compatibilidad con el icono ya instalado (ver seccion de instalacion).

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
  al resto de la curva; el label del preset muestra el detalle "(1,00 / 0,33 s)"
  en texto chico al lado del nombre). Sonido: **Natural** (ruido filtrado) y
  **Saber** (ring-modulation, ex "Star Wars"/"Sintetico"/"GolfSaber" -
  renombrado para no chocar con el nombre de la app) sin cambios de sintesis;
  **Relax** (cuenco tibetano: parciales inarmonicos con *beating* entre
  osciladores destemplados) reemplaza al Organo original. Reverb/eco
  (bus de 4 delays en paralelo, sin archivo de impulso) y contraste dinamico
  ajustables, colapsados bajo "Ajustes de sonido" para no ocupar la pantalla
  inicial. Cada motor recuerda su propio grave/agudo/reverb/dinamica.
  Preferencias persistidas en el store `settings`. Acceso desde el home,
  desde el bloque final del Warm-up, y desde dentro de una sesion de
  practica (para escucharlo mientras registras tiros).
  Reverb, dinamica y el motor Relax se disenaron primero en un artifact
  aparte ("Tempo Sound Lab") antes de llevarlos a la app.
- **Mini-reproductor**: el Tempo Trainer sigue sonando al navegar a otra
  pantalla (por ejemplo, volver a la sesion de practica) - una franja fija
  abajo (`#gc-mini-player` en `index.html`, fuera de `#gc-app` para
  sobrevivir a los re-render) muestra el preset activo y un boton de
  Detener desde cualquier lado. Se esconde sola en la pantalla completa del
  Tempo Trainer (los controles ya estan ahi).

Detalles de arquitectura no obvios:
- `src/tempo/player.js` es el motor + preferencias + wake lock como
  singleton global (sobrevive a la navegacion entre pantallas, a proposito,
  para el mini-reproductor). `src/tempo/engine.js` (el motor de audio en
  si, factory `createTempoEngine` con `dispose()` explicito) no cambio -
  player.js es la capa que decide CUANDO crearlo/destruirlo. Antes esa
  decision vivia en `screens/tempo.js` y se disparaba con cada navegacion;
  ahora solo se destruye cuando el usuario toca "Detener" (desde la
  pantalla completa o el mini-reproductor), nunca por navegar.
- `screens/tempo.js` (la pantalla completa) es una "vista" sobre player.js
  y sigue siendo la unica pantalla que NO hace un re-render completo en
  cada interaccion (el resto de la app reconstruye todo el innerHTML en
  cada cambio) - el marcador anima via `requestAnimationFrame` en paralelo
  al audio, y reconstruir el DOM del track en cada click cortaria esa
  animacion. Actualiza el DOM de forma imperativa, igual que el prototipo.
- `main.js` tiene un mecanismo generico de cleanup-al-navegar-afuera
  (`SCREEN_CLEANUP`) para las pantallas que dejan algo vivo entre renders
  (el timer del warm-up, el wake lock de la sesion). El Tempo Trainer es la
  excepcion: su cleanup al salir de la pantalla completa solo para la
  animacion local (rafId), no el audio - eso es justo el punto del
  mini-reproductor.

## Otras piezas

- **Explorar antes de iniciar**: tocar una variante en el home ya no pasa
  por un boton "Empezar sesion" separado - va directo a la pantalla de esa
  sesion. Si hay una sin terminar para esa variante, la retoma ahi mismo
  (salta al primer tiro sin responder via `firstIncompleteFlatIndex` en
  `variants.js`); si no, arma una sesion nueva **en memoria, sin
  persistir** (`VARIANT_DEFS[key].factory()`, sin `id`/`date`) para poder
  navegarla con Anterior/Siguiente antes de comprometerse. `!state.session.id`
  es la señal que usan `sessionShots.js`/`sessionBlocks.js` para saber si
  mostrar el hint + boton "Iniciar" + "Volver atras" (modo explorar) o
  "Pausar y salir" + "Empezar una sesion nueva" + "Cancelar sesion" (modo
  iniciado). `startCurrentSession()` en `main.js` es lo unico que le pone
  `id`/`date`/`sessionNumber` y la guarda por primera vez - se llama al
  tocar "Iniciar" (y defensivamente desde `finishSession()` por si algun
  camino raro llega a Finalizar sin haber iniciado). "Empezar una sesion
  nueva" (solo visible ya iniciada) arma otra exploracion desde cero sin
  tocar la sesion pausada, que sigue guardada y visible en el Historial.
- **Cancelar sesion**: en las 3 pantallas de sesion (tiro-a-tiro, bloques,
  warm-up) hay un boton "Cancelar sesion" (`src/confirmDiscard.js`, dos
  pasos de confirmacion) que descarta sin dejar nada guardado - distinto de
  "Pausar y salir", que persiste como `finished:false` (y se puede
  retomar). Solo aparece en modo iniciado (si la sesion todavia se esta
  explorando, "Volver atras" ya alcanza porque no hay nada persistido); como
  en ese punto la sesion ya tiene `id` (se guardo al tocar "Iniciar"),
  descartar tambien borra ese registro (`db.deleteSession`) para no dejarlo
  huerfano en IndexedDB.
- **Wake Lock**: la pantalla no se apaga sola durante una sesion de
  practica, un warm-up, o mientras suena el Tempo Trainer
  (`src/wakeLock.js`, factory `createWakeLockHandle()` - cada feature tiene
  su propio sentinel independiente a proposito, para que liberar uno no
  apague el de otro si estan activos al mismo tiempo).
- **Historial con borrado**: `screens/history.js` muestra tambien las
  sesiones sin terminar (antes invisibles, solo rescatables via CSV) con
  tag "En progreso" y boton borrar (confirmacion en dos pasos,
  `db.deleteSession`). El grafico de tendencia y el foco sugerido siguen
  usando solo las sesiones finalizadas.
- **Menu**: icono ☰ arriba a la derecha del home (`screens/menu.js`) con
  Reportes, Exportar a CSV y Acerca de - antes sueltos en el home.
- **Reportes**: `screens/reports.js` + `computeGlobalReport()` en
  `stats.js` - resumen de TODA la practica (todas las variantes juntas):
  sesiones totales, tiros/putts, racha de semanas seguidas, dias desde la
  ultima, Think/Play Box global (promedio ponderado por tamaño de sesion,
  no promedio simple de porcentajes), tendencia de resultado promedio, y
  6 analisis cruzados. Complementa al Historial (que sigue siendo el
  detalle sesion-por-sesion de UNA variante), no lo reemplaza.
  - `reportsStats.js` (agregaciones sobre TODO el historial - distinto de
    `stats.js`, que es "una sesion a la vez") + `screens/reportsCharts.js`
    (renderers): **gapping por palo** (agrupado por `club+target`, no solo
    club - en Variante A el mismo 56° se usa para dos objetivos de
    distancia distinta, agrupar solo por palo mezclaria dos tiros bien
    ejecutados en una barra que parece "muy dispersa" sin serlo); **rutina
    vs. resultado** (scatter por bloque, con regresion lineal simple solo a
    partir de 8 puntos); **tendencia por bloque** en TODO el historial (a
    diferencia del foco sugerido del home, que solo mira las ultimas 3
    sesiones); **fatiga por tercios** (tiros divididos por posicion
    cronologica dentro de la sesion - asume que se completa en secuencia,
    no hay timestamp por tiro - cruzando resultado% con rutina% para ver
    cual cae primero); **comparacion entre variantes**; y **circulo de 3
    pies vs. resultado** en Variante D. El resultado (escala 1-3) se
    normaliza a % (`/RESULT_MAX*100`) en los graficos que lo cruzan con
    otro porcentaje, para no terminar con un grafico de doble eje.
  - Sin libreria de graficos nueva: barras en HTML/CSS (mas simple que
    calcular geometria SVG para algo que ya resuelve bien flexbox),
    SVG a mano para lineas/scatter - mismo patron que ya usaba el trend
    chart original.
  - Paleta categorica de los graficos: `--chart-green/--chart-gold/
    --chart-blue/--chart-plum` en `styles.css`, separada de `--green`/
    `--gold` de la UI porque esos son mas oscuros/de menor croma de lo que
    conviene para series de un grafico. Los 4 tonos se validaron con el
    validador de paletas categoricas de la skill `dataviz` (banda de
    luminosidad, piso de croma, separacion CVD adyacente y de vision
    normal) entre si y contra el fondo de las cards. No se reusa `--brick`
    (ya es el color de "peligro" en el resto de la app - Cancelar, Borrar)
    como cuarto color de serie. Asignacion de color siempre por indice fijo
    de bloque/serie, nunca por nombre.
- **Safe area**: `.gc-header` y `.gc-sea-banner` usan
  `env(safe-area-inset-top)` (Dynamic Island/notch) y el body
  `env(safe-area-inset-bottom)` (home indicator) - necesario corriendo como
  PWA instalada a pantalla completa.
- **Swipe en la tarjeta del tiro**: `sessionShots.js` (`wireCardSwipe()`)
  escucha Pointer Events (no Touch Events, asi anda con dedo y con mouse
  por igual) sobre `.gc-card` para que Anterior/Siguiente tambien
  respondan a un swipe horizontal, sin pisar el scroll vertical de la
  pagina (`touch-action: pan-y` en `.gc-card`). El listener esta en la
  tarjeta, no en toda la pantalla, para no interferir con otros
  elementos; un tap normal sobre los toggles/pegs de adentro no dispara
  nada porque no supera el umbral de movimiento (50px, predominantemente
  horizontal). Solo en shots (A/B/C/E) - bloques (D) no tiene
  Anterior/Siguiente.
- **Escala de resultado (Post-shot / bloque)**: paso de 1-5 a 3 niveles
  con nombre - Malo/Bueno/Excelente (`src/resultScale.js`, `RESULT_LEVELS`
  / `RESULT_MAX`) - la escala de 5 era demasiado ancha para aplicar
  consistente parado en el driving range. Los pegs numerados se
  reemplazaron por un control segmentado de 3 palabras (mismo look que el
  Si/Parcial/No de Think/Play Box en Variante D, pero resaltado en dorado
  en vez de verde para diferenciarlo). El criterio de cada nivel esta
  documentado en About. Los datos ya guardados con la escala vieja se
  migran solos la primera vez que se abre la app con este cambio
  (`db.js`, `DB_VERSION` 2 -> 3, remap 1,2->Malo · 3,4->Bueno · 5->Excelente
  - colapsa preservando el orden, no hay forma de mapear 5 niveles a 3 sin
  perder resolucion).

- **Driver con tiros "sueltos"**: en Variante E, el bloque "Driver:
  precision de fairway" intercala 1 de cada 4 tiros como "Suelto - buscá tu
  velocidad maxima, sin preocuparte por la linea" (`buildAlternatingSituations`
  con 4 entradas: 3 controladas + 1 suelta, se repite el ciclo). Practicar
  siempre tentativo entrena un swing "steering" que no ayuda en la cancha;
  soltarse cada tanto libera tension. Mismo patron ya usado en el
  Calentamiento de Variante C ("Foco en soltar el swing").

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
  wakeLock.js               # factory de wake lock (sentinels independientes)
  sessionWakeLock.js         # wake lock de las pantallas de sesion
  styles.css
  tempo/
    engine.js            # motor de audio del Tempo Trainer (Web Audio API)
    player.js             # motor+prefs+wakelock como singleton global (mini-reproductor)
  screens/
    home.js, sessionShots.js, sessionBlocks.js, summary.js, history.js,
    warmupSelect.js, warmupSession.js, tempo.js, about.js, menu.js, reports.js
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

Si el nombre de la app cambia (manifest/meta tags) despues de ya haber
agregado el icono a la pantalla de inicio, iOS **no actualiza el label solo**
- hay que borrar el icono viejo y agregarlo de nuevo para que tome el
nombre nuevo.
