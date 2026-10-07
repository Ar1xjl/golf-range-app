# GolfSaber

PWA offline (Vite + JS vanilla + IndexedDB). Arquitectura y features: ver README.md.

## Comandos
- `npm run build` — unica verificacion automatica que existe (no hay tests ni lint).
- Preview: launch.json `golf-range-preview` (puerto 4173) para probar service
  worker/offline; `golf-range-dev` (5173) NO registra el SW.
- `npm run icons` solo si cambia `src/icon.svg`. `public/icons/` no se edita a mano.

## Deploy = push
Push a `main` deploya a GitHub Pages y actualiza la app instalada en el iPhone de
Juan (registerType autoUpdate). Nunca pushear sin que Juan lo pida (ver `/ship`).

## Datos reales (critico)
El historial de practica real de Juan vive en IndexedDB en su iPhone.
- Cualquier cambio de forma de sesion/bloque/tiro: migracion en `upgrade()` de
  `src/db.js` + bump de `DB_VERSION`. Proponer el plan de migracion ANTES de codear.
- `exportCSV`/`importCSV` (src/csv.js) son el backup de recuperacion: si cambia el
  modelo, ambos tienen que seguir haciendo round-trip, incluso con CSVs viejos.

## Convenciones
- Comentarios y commits en castellano, sin tildes. Commit: titulo corto + cuerpo
  que explique el por que.
- Al agregar una feature, actualizar README.md (incluida la seccion Estructura).
- No renombrar repo/URL `golf-range-app` (rompe el icono instalado). `base: './'`.

## Gotchas
- Re-render por innerHTML de `#gc-app`: los listeners se re-atan en cada render.
  `#gc-mini-player` vive fuera de `#gc-app` a proposito.
- iOS: el AudioContext se suspende al bloquear pantalla (ver handleVisibilityChange
  en tempo/engine.js); el Wake Lock se pierde al ir a segundo plano.
- Se usa con una mano, parado en el range: disenar y verificar a ~375px de ancho.
