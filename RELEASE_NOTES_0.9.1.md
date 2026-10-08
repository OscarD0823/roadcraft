# RoadCraft Studio 0.9.1

- Carreteras libres y el radio de suministro del ZikZ Mobile Scalper a 10 km ya no se presentan como beta/experimental. La validación en partida fue reportada por el usuario; se conservan las copias, confirmaciones y restauración.
- Vehículos compartidos con Logística: una sola configuración por archivo, los mismos valores guardados y pendientes en Vehículos, Logística y Modificados.
- Los borradores aparecen en Modificados como «Sin guardar» y se mantienen al cambiar de sección o buscar de nuevo durante la sesión. Solo Guardar cambios modifica el juego; cerrar el editor descarta lo pendiente.
- Descartar cambios pendientes solo afecta al borrador seleccionado. Los cambios externos de un campo pendiente se detectan al buscar de nuevo y bloquean el guardado; no se sobrescriben silenciosamente.
- No se enlazan archivos distintos de convoyes únicamente porque compartan nombre o modelo.

El radio de 10 km es de suministro, no el ancho físico de vertido ni una garantía para cualquier mapa modificado. Carreteras libres desactiva las zonas estáticas compatibles; pueden permanecer límites de materiales, agua, colisiones y obras dinámicas. Restaurar el paquete no deshace arena ni asfalto ya guardados en una partida.

Las pruebas automatizadas de escritura usan paquetes sintéticos. Las pruebas de interfaz sobre la instalación real cambian y descartan borradores, sin guardar vehículos ni activar carreteras.
