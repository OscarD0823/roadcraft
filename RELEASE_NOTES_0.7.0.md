# RoadCraft Studio 0.7.0

## Visor lateral y ajustes amplios

- Misma distribución de SnowRunner Studio: vehículo permanentemente visible en un lateral, parámetros a su derecha y desplazamiento independiente.
- Guardar y restaurar permanecen accesibles. Cambiar terreno, pausar o encuadrar no borra los valores del borrador.
- Diseño comprobado a 600 × 520, 960 × 620 y 1366 × 768, con selector de idioma más legible en pantalla dividida.

## Modelos fuente más fieles

- Escala leída del FBX y de las opciones de importación del SDK, sin adivinarla por el tamaño del modelo.
- Ruedas en sus puntos originales, con escala configurada, orientación exterior y eje de giro correctos.
- Texturas originales de color y normales, y lectura correcta de los canales metal/rojo, rugosidad/verde y oclusión/azul.
- Colisiones, geometría auxiliar y niveles de detalle alternativos fuera de la vista exterior.
- Encuadre adaptativo para vehículos altos y árboles/rocas que no ocultan el vehículo.

## Alcance y comprobaciones

La vista 3D requiere modelos fuente FBX compatibles presentes localmente. Los modelos TPL compilados del juego aún no son compatibles: se mantiene su carátula o icono, y se identifica explícitamente que no es un modelo 3D. No se inventan modelos para las entradas sin imagen; se puede elegir una imagen propia.

Se comprobaron las 124 entradas del catálogo local, la separación de vehículos/tráilers/IA, las imágenes disponibles y el FBX oficial de Aramatsu. También se verificaron las pruebas de edición, partidas, imágenes BC1/BC7 y reconstrucción de una copia del paquete con sus 9.631 entradas intactas. Las pruebas no modifican el paquete ni las partidas reales.

El instalador no incluye modelos ni texturas del juego. Se leen de la instalación local. Es una herramienta independiente y una vista creada con Three.js, no el motor ni la física de RoadCraft. La distribución y las actualizaciones siguen en GitHub.

Autor: OscarD0823. Se conservan las licencias de las dependencias.
