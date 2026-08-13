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
  stats.js               # computeStats + suggestFocus (foco sugerido)
  csv.js                 # export a CSV
  db.js                   # capa de persistencia (IndexedDB)
  styles.css
  screens/
    home.js, sessionShots.js, sessionBlocks.js, summary.js, history.js
scripts/
  generate-icons.mjs    # genera los PNG del icono desde src/icon.svg
public/icons/           # iconos PWA generados (no editar a mano)
legacy/                 # prototipo original (artifact de un solo archivo), como referencia
```

## Datos y storage

Todo se guarda localmente en IndexedDB (base `golf-range-db`, store
`sessions`), no hay backend ni sync remoto. Cada sesion queda en un solo
registro (variante, bloques, tiros, `finished`). El export a CSV recorre
todas las sesiones guardadas.

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
