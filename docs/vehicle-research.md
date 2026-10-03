# Vehículos, IA y vistas 3D de RoadCraft

Investigación contrastada con el SDK oficial y la instalación local, 3 de octubre de 2026. No se distribuyen modelos ni texturas del juego.

## Clasificación

`auto_truck_library.sso` registra configuraciones de jugador y variantes `base_`. Las clases de estas últimas están dentro de `ssl/autogen_designer_wizard/trucks/base/`; no deben omitirse por buscar únicamente la carpeta superior. En la instalación probada hay 194 clases: 73 copias `auto_base_`, una variante explícita `_ai`, y 120 configuraciones restantes. Las fuentes oficiales de mods añaden tres entradas.

El SDK exige nombres `base_` para `RegularPool.TruckName` de las rutas Establish y para `TestPool.TruckName` de ValidRouteWithTestConvoy. El escenario define la ruta, carga, frecuencia y validación; tener una clase base no implica que se use en todas las misiones. No se clasifica como IA por ausencia de fotografía, precio negativo o aspecto oxidado.

- [Rutas y entregas: Infrastructure Request](https://roadcraft-modding.prismray.io/scene_components/objective_system/infrastructure_request/)
- [Convoy de validación](https://roadcraft-modding.prismray.io/scene_components/objective_system/verification/)
- [Prefabs de rutas IA](https://roadcraft-modding.prismray.io/scene_components/prefabs/ai_vehicles_routes/)

`buyCost` y `rankToUnlock` proceden de la biblioteca, no de la partida. Las variantes `old` y el tag real `UID_MODULE_*_RUSTY` identifican configuraciones recuperadas/oxidadas. Los precios de prueba de esas variantes no prueban que puedan comprarse. `buyCost = -1` tampoco prueba uso exclusivo de IA: existen variantes de misión, prototipos y maquinaria especial.

Las recompensas de escenario `SpawnTruck` incluyen `UnlockTruck`, `TruckName`, `TruckTag` y restricciones de recuperación. Por eso la disponibilidad efectiva depende también de objetivos, mapa, DLC y estado de la partida. El editor informa sobre la configuración; no inventa una misión de desbloqueo ni modifica la flota al mostrarla.

- [Recompensas de vehículos](https://roadcraft-modding.prismray.io/scene_components/objective_system/rewards/)
- [Prefabs de vehículos](https://roadcraft-modding.prismray.io/scene_components/prefabs/buildings_and_vehicles/)

## Lectura de modelos

El modelo se resuelve desde `properties.geom.nameTpl`, no desde el nombre del camión. El lector propio lee TPL/TPL_DATA de la instalación y reconstruye geometría, índices, UV, normales y transformaciones bind. Los buffers comprimidos usan el origen y escala de cada split. `matrLT` es la transformación de modelo; sustituirla por `matModel` o aplicarlas ambas deforma las piezas. La comparación con el FBX fuente del Aramatsu comprueba este supuesto.

Las ruedas separadas se resuelven desde wheelPool/wheelSlotWithDescs y sus clases; no se colocan por posiciones adivinadas. Se usan texturas originales y canales de sombreado R=metal, G=rugosidad, B=oclusión, cuando están disponibles. La lista `mipMaps` del descriptor es autoritativa: su primer archivo puede acabar en `_1` aunque sea el nivel lógico cero.

Se estudiaron nombres de propiedades y formatos binarios con [LibSaber](https://github.com/Wildenhaus/LibSaber); el código del lector es una implementación independiente, sin incorporar código de ese repositorio. Se rechazan longitudes, anidaciones, índices y layouts incompatibles. Los archivos del juego solo se leen; los JSON y PNG derivados quedan en la caché local, fuera del paquete distribuido. Una nueva búsqueda invalida los índices de sesión.

No es el motor de RoadCraft. Algunos materiales especiales, orugas continuas, tintes personalizables y animaciones de equipos no se reproducen íntegramente. Si un modelo no es compatible, se conserva la imagen como alternativa y se indica que es una carátula, no un modelo 3D.

### Correcciones de apariencia 0.8.1

Las coordenadas V compiladas son `1 - V` de la fuente FBX; se desactiva el volteo de PNG para TPL. Las ruedas físicas necesitan la proporción `radius / geomRadius`, mientras que los rodillos auxiliares usan `prop_truck_visual_wheel.scale`. Las listas `visualWheelSlots` no están en `wheelSlotWithDescs` y también deben ensamblarse. Los eslabones de `prop_truck_track.tracks[].section.tpl` se repiten sobre el contorno de los rodillos; `segmentBones` determina cuántos eslabones contiene la fuente. Es una aproximación de reposo sin sag ni suspensión del motor original.

Los volúmenes `_load_volume` y `_load_border_*` no son chapa de la carrocería. Las superficies skinned sustituidas por splits compilados tampoco se deben dibujar dos veces. Las plantillas `.td` contienen `tintByMask` y `customization`, que complementan los albedos grises; se leen sus máscaras y los tintes de la biblioteca de presets local.

Los splits compilados rígidos pueden tener un stream separado de índices de hueso (flag 9 sin pesos). Sus posiciones necesitan el `matrLT` del hueso referenciado, no el del mesh agregado. En Greenway, dos indicadores de cabina se dibujaban bajo el suelo y distorsionaban los límites del vehículo. Las superficies ponderadas conservan su pose de reposo exportada, sin aplicar otra transformación rígida. Las orugas se orientan con la dirección entre sus propios `segmentBones`: el Dragline usa +Z, a diferencia del -X de Bowhead/Greenway.

`TruckInputConfiguration.isStaticTruck = True` distingue maquinaria fija sin usar una búsqueda genérica de «crane». Los tags `UID_MODULE_RAILROAD_CRANE` y `UID_MODULE_TOWER_CRANE_RAILED` se muestran como equipos ferroviarios y tampoco se animan circulando por carretera. En esta instalación se identificaron cinco configuraciones fijas/ferroviarias. El eje longitudinal de las fuentes comprobadas es +Z; hacer avanzar el terreno por X producía conducción lateral.

## Interfaz

Los parámetros de vehículos, tráilers e IA se agrupan en pestañas independientes. Cambiar de pestaña no guarda ni descarta los cambios pendientes. El visor permanece junto al panel de ajustes. La animación original del logo representa explorador → volquete descargando arena → dozer → asfaltadora → rodillo → camión de carga; el explorador espera y se retira al final. Se respeta la preferencia de movimiento reducido.
