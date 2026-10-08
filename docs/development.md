# Desarrollo · RoadCraft Studio

[Portada](../README.md) · [Documentación](README.md)

## Preparación

Requisitos: Windows x64, Node.js 22 o superior y npm.

```powershell
git clone https://github.com/OscarD0823/roadcraft.git
cd roadcraft
npm ci
npm run check
npm test
npm start
```

No se incluyen los archivos del juego. Las pruebas que requieren una instalación o una interfaz gráfica lo indican en sus scripts; las pruebas sintéticas no sustituyen una comprobación en partida.

## Estructura

```text
src/                  Aplicación, visor y recursos propios
scripts/              Pruebas y herramientas
docs/                 Guías e investigación
  releases/           Notas de versiones
  archive/            Documentación histórica
.github/workflows/    Comprobaciones y publicación
```

La configuración activa de Forge, Vite y TypeScript permanece en la raíz. Los instaladores y cachés locales no forman parte del repositorio. Los avisos legales se conservan en [LICENSE](../LICENSE) y [NOTICE.md](../NOTICE.md).

## Comprobar cambios

```powershell
npm run check
node scripts/check-docs.mjs
npm run test:links
npm run test:drafts
npm run test:logistics
npm run test:roads
npm run test:linked-work
```

Para cambios visuales existen `npm run test:ui` y las pruebas específicas de `package.json`. Revisa las salidas y los modelos afectados; no edites automáticamente los archivos reales del juego para ejecutar pruebas.

El comprobador de documentación valida enlaces locales, imágenes e índices de versiones, sin instalar dependencias. También se ejecuta en GitHub Actions para cambios de documentación.

## Compilar y publicar

```powershell
npm run make
```

El instalador y sus archivos de actualización se generan en `out/make/squirrel.windows/x64`.

Para publicar: actualiza la versión de `package.json` y `package-lock.json`, añade las notas a `docs/releases/X.Y.Z.md`, actualiza [CHANGELOG.md](../CHANGELOG.md) y ejecuta las comprobaciones. Crea y sube el tag `vX.Y.Z`; el flujo de publicación construye y adjunta Setup.exe, el paquete .nupkg y RELEASES. No reutilices tags de versiones publicadas.

Las instalaciones consultan las versiones publicadas en GitHub al abrirse y cada 30 minutos. Una reorganización de documentación no requiere cambiar la versión ni generar un instalador nuevo.
