---
name: ship
description: Verifica, commitea y deploya GolfSaber a produccion (push a main = deploy al iPhone)
disable-model-invocation: true
---

Llevar los cambios pendientes a produccion. Parar y avisar ante cualquier falla.

1. `git status` + `git diff`: entender que se va a shippear. Si no hay cambios, decirlo y terminar.
2. `npm run build` — si falla, parar.
3. Preview `golf-range-preview` a 375x812: recorrer la(s) pantalla(s) que cambiaron
   y confirmar cero errores de consola. Screenshot como prueba.
4. Si el diff toca `db.js`, `csv.js`, `variants.js` o la forma de session/bloque/tiro:
   confirmar migracion en `upgrade()` + bump de `DB_VERSION`, y que export/import CSV
   siga haciendo round-trip (incluso con CSVs exportados antes del cambio).
   Si hay cualquier duda, parar y preguntar.
5. README.md actualizado: la feature descripta y la seccion Estructura al dia si hay
   archivos nuevos.
6. Commit en castellano sin tildes: titulo corto + cuerpo con el por que.
7. Mostrar resumen (commit, archivos, resultado de la verificacion) y pedir OK
   explicito antes de `git push`.
8. Despues del push: `gh run watch` sobre el workflow "Deploy a GitHub Pages" y
   reportar si el deploy salio bien.
