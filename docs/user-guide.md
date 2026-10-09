# Guía de uso · RoadCraft Studio

[Portada](../README.md) · [Documentación](README.md) · [Última descarga](https://github.com/OscarD0823/roadcraft/releases/latest)

## Primer inicio

1. Descarga el instalador **Setup.exe** de la última versión publicada e instálalo en Windows x64.
2. Permite que detecte RoadCraft o selecciona la carpeta del juego, no solo `steamapps/common`.
3. Usa **Buscar de nuevo** después de actualizar el juego o añadir fuentes compatibles de mods.
4. Cierra RoadCraft y respalda tu partida antes de guardar una modificación.

El catálogo lee las clases `.cls` de `root/paks/client/default/default_other.pak` y fuentes oficiales `.bro` compatibles. No se garantiza descubrir cualquier formato o ubicación de mods.

## Actualizaciones opcionales

Abre **Actualizaciones** con el botón ↻ de la cabecera y pulsa **Buscar actualizaciones** cuando quieras. No se consulta GitHub ni se descarga nada automáticamente.

Si hay una versión estable nueva, puedes **Descargar instalador**, leer la versión en GitHub o **Seguir con esta versión**. La descarga abre el navegador: no ejecuta el instalador, cierra el editor ni altera los borradores. Guarda tus cambios y cierra el editor antes de ejecutar el instalador descargado.

## Bibliotecas

- **Vehículos**: configuraciones de la flota de jugador; disponibilidad y compra dependen también de la partida, objetivos, mapa y DLC.
- **Tráilers**: remolques separados de los camiones.
- **Logística**: unidades referenciadas por los convoyes de entregas o pruebas de rutas entre empresas. No incluye indiscriminadamente todos los ayudantes de construcción.
- **Modificados**: entradas editadas y borradores de la sesión con etiqueta **Sin guardar**.
- **Otros**: configuraciones cuyo papel no se ha confirmado, incluidas copias base sin rutas logísticas detectadas.
- **Partidas**: archivos CompleteSave; es un editor independiente de los parámetros de vehículos.

Una misma configuración puede aparecer en Vehículos y Logística: ambas vistas usan el mismo archivo y los mismos valores. Una copia distinta de convoy no se enlaza solo por tener el mismo nombre o modelo.

## Editar y guardar

Selecciona una entrada. El modelo permanece a un lado y los ajustes se agrupan por motor, transmisión, dirección, suspensión o equipo de trabajo, según los campos disponibles.

Consulta el valor original y el rango antes de elegir **Poco**, **Medio**, **Alto** o una cantidad manual. Los rangos son precauciones del editor, no límites certificados por Saber ni garantías de estabilidad física.

Los borradores sobreviven al cambio de sección y a una nueva búsqueda durante la sesión. Solo **Guardar cambios** escribe al juego; cerrar la aplicación los descarta. **Descartar borrador** no modifica archivos del juego. Si un campo pendiente cambia externamente, el editor conserva el borrador y bloquea su guardado hasta descartarlo.

La vinculación de familias es una función distinta: permite consultar variantes compatibles y copiar ajustes cambiados conservando sus diferencias mecánicas. No añade equipos inexistentes ni modifica automáticamente copias base o convoyes excluidos.

## Arena y carreteras

- **Carga de arena**: toneladas donde existe `prop_load_volume.volumeMass`; recomendaciones +5%, +10% y +20%, dentro del rango preventivo 75%–125% del original. Más carga puede afectar la física.
- **Ancho de trabajo**: hasta 1.000 m en equipos compatibles, sin escalar el modelo. No equivale a la capacidad de carga.
- **Suministro del ZikZ**: hasta 10.000 m; sincroniza las distancias compatibles de acceso y detección del recurso. No convierte el ancho físico de descarga en 10 km ni garantiza cubrir todo mapa.
- **Carreteras libres**: desbloquea la clase compatible de zonas estáticas sin quitar los permisos obligatorios del vehículo.

Carreteras libres y el suministro de gran alcance dejaron de estar marcados como experimentales tras la comprobación en partida reportada por el usuario. Conservan confirmación, copias, límites y detección de cambios externos. No se activan al instalar o abrir la aplicación.

Obras activas, materiales, agua, colisiones y máscaras compiladas pueden mantener restricciones. **Restaurar las zonas no deshace el terreno de una partida guardada.** Respalda también CompleteSave y comprueba los cambios en solitario antes de depender de ellos.

## Copias y restauración

Al editar el paquete base se guarda una copia completa en la carpeta `backups` de los datos de RoadCraft Studio. El editor construye y verifica el paquete temporal antes de reemplazar el original, y gestiona su caché. No reemplaces manualmente un paquete completo si necesitas conservar otras ediciones posteriores.

La restauración de Carreteras libres repone la clase original de zonas, no todo el PAK; conserva las ediciones posteriores de camiones. Una actualización o un mod que cambie esa clase puede bloquear la operación para no sobrescribirlo.

Para proyectos `.bro`, utiliza el Mod Editor oficial para construir y probar el mod.

## Partida y pintura de empresa

**Partidas** busca perfiles y ranuras locales y permite abrir un CompleteSave manualmente. La ubicación Steam habitual que revisa el editor es:

```text
%LOCALAPPDATA%\Saber\RoadCraftGame\storage\steam\user\<perfil>\Main\save\SLOT_<n>\CompleteSave
```

También busca bajo Saber Interactive. Si no existe un archivo local, abre el juego, guarda y vuelve a buscar; un registro de sincronización de Steam Cloud no es una partida.

El guardado editado se valida y su copia se conserva junto al original como `CompleteSave.roadcraft-studio-<fecha>.bak`. El juego debe estar cerrado. La pintura seleccionada se previsualiza con máscaras compatibles; los emblemas y grafitis no se reproducen.

## Modelos e imágenes

Los modelos, ruedas, texturas y carátulas se leen de la instalación local y de fuentes compatibles. **Buscar de nuevo** renueva sus índices. Una carátula no es un modelo 3D; formatos no admitidos se identifican como alternativa.

La escena usa Three.js, no el motor de RoadCraft. Algunos materiales, poses y animaciones pueden diferir; la vista no demuestra que una modificación sea estable en partida. Consulta la [investigación técnica](vehicle-research.md) para la clasificación y los límites.
