# RoadCraft Studio 0.8.9

- Nuevo panel **Carreteras libres** (botón de carretera junto al idioma y acceso desde equipo de arena).
- Modo experimental para las zonas estáticas no modificables de los mapas que usan la clase común. No borra los componentes obligatorios de los camiones.
- Confirmación explícita, juego cerrado, copia del paquete, registro previo y restauración exacta de la clase sin perder modificaciones de vehículos.
- Detección de cambios externos: no se sobrescribe una clase modificada por mods o actualizaciones.

**Limitaciones:** sin validar en partida. Obras activas, colisiones, agua, materiales y máscaras compiladas pueden seguir bloqueando el trabajo. No garantiza construir absolutamente en todas partes. Restaurar zonas no elimina arena/asfalto guardados: respalda tu partida y prueba en solitario. No se activa ni se modifica el juego automáticamente al instalar o abrir el programa.

Las pruebas automatizadas comprueban respaldo, restauración, cancelación, bloqueo con juego abierto, conservación de vehículos y rechazo de conflictos mediante paquetes sintéticos.
