# RoadCraft Studio 0.8.3

- Sustituye «Uso de IA» por «Logística»: convoyes que llevan mercancías entre empresas por las rutas A → B, no las máquinas de construcción automatizadas.
- Clasifica usando las referencias reales `RegularPool` y `TestPool` de los mapas instalados y las fuentes de mapas/mods `.scn`. Ya no convierte todas las variantes `base_` o `_ai` en transportes de misión.
- En la instalación probada: 22 configuraciones logísticas, 19 exclusivas y tres también utilizadas por el jugador. Las compartidas aparecen en ambas secciones con una advertencia: editar el archivo afecta a ambos usos.
- Las variantes base sin rutas confirmadas siguen accesibles en Otros. El editor muestra mapas, tipo de convoy y cargas, y advierte si no puede leer alguna escena.
- Una nueva búsqueda vuelve a comprobar las rutas; nuevas pruebas evitan mezclar ayudantes, tráfico ambiental y recompensas con convoyes.

Conserva las mejoras del visor 3D de 0.8.2. La clasificación no cambia la IA ni garantiza que un convoy no se atasque. Solo se leen las escenas locales y no se incluyen archivos del juego en el instalador.

Fuentes: [entregas Establish](https://roadcraft-modding.prismray.io/scene_components/objective_system/infrastructure_request/) y [convoyes de prueba](https://roadcraft-modding.prismray.io/scene_components/objective_system/verification/), contrastadas con los 12 mapas instalados.
