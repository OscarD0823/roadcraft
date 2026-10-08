# RoadCraft Studio 0.9.2

- Carreteras libres y el suministro del ZikZ Mobile Scalper a 10 km dejan de presentarse como beta/experimental, según la validación en partida reportada por el usuario. Se mantienen las copias, confirmaciones y restauración.
- Un vehículo compartido con Logística tiene una sola configuración por archivo: los mismos valores guardados y pendientes en Vehículos, Logística y Modificados.
- Los borradores aparecen en Modificados como «Sin guardar». Se mantienen al cambiar de sección o buscar de nuevo durante la sesión; solo Guardar cambios modifica el juego. Cerrar la aplicación descarta lo pendiente.
- Aviso compacto con explicación desplegable, para conservar espacio en los ajustes. «Descartar borrador» solo descarta lo pendiente del archivo seleccionado y no escribe al juego.
- Si cambia externamente un campo pendiente, se conserva el borrador y se bloquea el guardado para no sobrescribirlo. Los archivos distintos de convoyes no se enlazan por tener nombres/modelos parecidos.
- Corrige la limpieza de carpetas temporales de las pruebas en Windows: reintenta cuando Electron aún está escribiendo su caché. No cambia el comportamiento del juego ni elimina archivos del usuario.

El radio de 10 km es de suministro, no ancho físico de vertido ni una garantía para cualquier mapa modificado. Carreteras libres desactiva las zonas estáticas compatibles; pueden permanecer límites de materiales, agua, colisiones y obras dinámicas. Restaurar el paquete no deshace arena ni asfalto ya guardados en una partida.

Las pruebas de escritura usan paquetes sintéticos. Las pruebas de interfaz sobre la instalación real cambian y descartan borradores, sin guardar vehículos ni activar carreteras.
