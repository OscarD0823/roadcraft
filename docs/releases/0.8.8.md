# RoadCraft Studio 0.8.8

- Preset experimental de suministro de arena del ZikZ de 10 km y rango manual de 20–10.000 m. Es radio de abastecimiento, no ancho de descarga. Sincroniza `sandDistance`, `UsableCheckerDistance.distance` y `focusDistance`.
- Vincula configuraciones compatibles del mismo chasis: old/restauradas y variantes Wayfarer, entre otras. Opción activada inicialmente, lista visible y casilla para editar solo la seleccionada. Copias base, convoyes referenciados y variantes `_ai` quedan excluidas; vehículos y tráilers no se mezclan.
- Copia solo parámetros cambiados. Valores mecánicos: mismo porcentaje respecto a cada original. Radios con rango absoluto y opciones: mismo valor, únicamente si el equipo existe. Cada configuración se restaura a sus propios originales.
- Escritura conjunta del PAK en una única sustitución, verificación previa, copia completa y rechazo del conjunto si una variante está fuera del rango o cambió externamente. Se impiden guardados simultáneos.
- Aviso claro sobre zonas protegidas: no se eliminan. El controlador del volquete requiere `PropLoadVolumePermissionChecker`; borrar el componente podría romperlo. No se aplica esa técnica ni un parche binario.

Probado con paquetes sintéticos, guardado/restauración, valores originales diferentes, preservación de componentes y UI empaquetada en tamaños 600/960/1366. El efecto de 10 km no está verificado dentro de una partida. Reinicia RoadCraft y prueba con una partida respaldada, preferiblemente en solitario. Los mods con mapas mayores podrían necesitar otra distancia.

Conserva los modelos, la pintura de empresa, la animación y los enlaces de GitHub. La instalación del editor no cambia automáticamente archivos del juego.
