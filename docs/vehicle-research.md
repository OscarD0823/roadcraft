# Vehículos, IA y vistas 3D de RoadCraft

Investigación contrastada con el SDK oficial y la instalación local, iniciada el 3 de octubre de 2026. Estado de las funciones actualizado para 0.9.2 el 8 de octubre. Los recuentos y capacidades describen la instalación examinada, no todo mapa o mod futuro. No se distribuyen modelos ni texturas del juego.

[Guía de uso](user-guide.md) · [Índice de documentación](README.md) · [Historial](../CHANGELOG.md)

## Clasificación

`auto_truck_library.sso` registra configuraciones de jugador y variantes `base_`. Las clases de estas últimas están dentro de `ssl/autogen_designer_wizard/trucks/base/`; no deben omitirse por buscar únicamente la carpeta superior. En la instalación probada hay 194 clases: 73 copias `auto_base_`, una variante explícita `_ai`, y 120 configuraciones restantes. Las fuentes oficiales de mods añaden tres entradas. **Ni `base_` ni `_ai` prueban por sí solos el uso logístico.**

La documentación del SDK indica nombres `base_` para `RegularPool.TruckName` de las rutas Establish y para `TestPool.TruckName` de ValidRouteWithTestConvoy. Sin embargo, la inspección de las propiedades reales de los 12 mapas instalados encontró también tres referencias sin ese prefijo: `azov_4317dl_cargo_old`, `azov_4317dl_cargo_res` y `wayfarer_st7050_trailer_fridge_new`. Por tanto, el editor usa las referencias reales, no fuerza el prefijo de la documentación.

Desde 0.8.3, Logística solo incluye entradas encontradas en esos dos pools: son 22 configuraciones, 19 `base_` y tres compartidas con el jugador. Las compartidas aparecen en ambas secciones y se advierte que se edita el mismo archivo. Las otras 54 copias base y la variante `_ai` no referenciada permanecen en Otros. Esto no demuestra que sean inutilizables ni permite afirmar su función auxiliar concreta; solo que no tienen una ruta logística confirmada en las escenas examinadas.

Las listas `.cd_list` y `.class_list` de los paquetes en `root/paks/client/default/scenes` contienen registros de propiedades legibles de las escenas compiladas. El lector acota tamaños, recorre únicamente estas listas y las escenas `.scn`, y no ejecuta código del juego. También revisa las fuentes `.scn` de `root/mods_source/xscenes`. No inspecciona mods externos fuera de esas ubicaciones ni deduce funciones de los nombres de modelos. Si un paquete no se puede leer, avisa y conserva las variantes sin confirmar fuera de Logística. Una nueva búsqueda vuelve a leer los pools, sin usar roles guardados de una versión anterior.

Se separan las entregas habituales (`regularPool`) y las pruebas de ruta (`testPool`). Se excluyen recompensas `SpawnTruck`, ayudantes de construcción y el tráfico ambiental `prop_ai_route_presentation` si no aparecen también en uno de esos pools. El escenario define la ruta, carga, frecuencia y validación; no se clasifica por ausencia de fotografía, precio negativo o aspecto oxidado. No se modifican el comportamiento de la IA, colisiones ni condiciones de atasco al clasificar.

- [Rutas y entregas: Infrastructure Request](https://roadcraft-modding.prismray.io/scene_components/objective_system/infrastructure_request/)
- [Convoy de validación](https://roadcraft-modding.prismray.io/scene_components/objective_system/verification/)
- [Prefabs de rutas IA](https://roadcraft-modding.prismray.io/scene_components/prefabs/ai_vehicles_routes/)

`buyCost` y `rankToUnlock` proceden de la biblioteca, no de la partida. Las variantes `old` y el tag real `UID_MODULE_*_RUSTY` identifican configuraciones recuperadas/oxidadas. Los precios de prueba de esas variantes no prueban que puedan comprarse. `buyCost = -1` tampoco prueba uso exclusivo de IA: existen variantes de misión, prototipos y maquinaria especial.

### Arena y variantes vinculadas (0.8.8)

La inspección de los `.cls` instalados confirmó copias separadas old/restauradas: por ejemplo Baikal 65206 y ZikZ 605E Mobile Scalper. Los Wayfarer OFT96 D/T comparten identificador de chasis, pero no el equipo; ST7050 es otra familia, con tractor y tráilers separados. La vinculación usa marca+identificador de chasis, o la correspondencia exacta old/res/new cuando el identificador no sigue ese formato, y aplica solo parámetros existentes con la misma especificación. No copia modelos, cajas, grúas, ruedas, etiquetas de misión ni campos ajenos al editor. Los prefijos base y las referencias logísticas excluyen la configuración del grupo automático.

`sandDistance` configura el suministro del ZikZ, no un vertido físico sobre 10 km. El ajuste de 10.000 m sincroniza también `UsableCheckerDistance.distance` y `focusDistance`. Se respaldan y restauran por separado, aunque antes tengan valores distintos. La documentación oficial describe [Sand Distance como radio de acceso al recurso](https://roadcraft-modding.prismray.io/scene_components/prefabs/buildings_and_vehicles/). Desde 0.9.2 no lleva etiqueta experimental: el usuario reportó cobertura de casi todo su mapa al probarlo en partida. Esto no garantiza cobertura o compatibilidad universal.

Los volquetes instalados contienen `prop_terraforming_permission_checker` y `prop_load_volume_permission_checker`. La tabla de símbolos de `ssl/game/truck/prop_load_volume_controller_release.sslbin` declara `propPermissionChecker` y `propLoadVolumePermission` en el grupo `require`, no `optional`; las fuentes revisadas después lo confirman. Son controles distintos al ratio de suelo `allowedPercent` del ZikZ. **No se eliminan los componentes obligatorios de los vehículos**: se rompería una dependencia. Carreteras libres se introdujo por separado en 0.8.9 y dejó de estar marcada como experimental en 0.9.2 tras la comprobación reportada por el usuario. No se parchean bytecodes o escenas compiladas. La documentación oficial confirma que el [terreno tiene sus propios controles de arena, barro y terraformación](https://roadcraft-modding.prismray.io/scene_components/terrain/).

### Carreteras libres: investigación y alcance (0.8.9–0.9.2)

La revisión ampliada del 7 de octubre encontró fuentes `.ssc` legibles en `default_non_retail_resources.pak`. `ssl/game/prop_non_terraformable.ssc` llama a `SetTerraformabilityFromDomain(domain, 0.0, boundChecking)` cuando la sesión está lista; `boundChecking` ya es `false` por defecto, no un interruptor de la protección. Los 12 mapas locales contienen dominios `non_terraformable` en sus `.cd_list` y `.dom_list`. Su clase compartida es `ssl/game/non_terraformable_actor.cls`, con `prop_domain` y un `prop_non_terraformable` vacío. No se encontraron redefiniciones explícitas de ese componente en las `.class_list` examinadas ni dependencias `[require]` de `PropNonTerraformable` en las fuentes inspeccionadas.

El modo separado **Carreteras libres** elimina solo ese componente vacío de la clase de zonas, conservando los actores, los dominios y todos los permisos obligatorios del camión. No modifica bytecodes, listas binarias, materiales, objetivos ni la partida. Se rechazan formatos desconocidos y cambios externos. Está desactivado inicialmente; requiere confirmación, juego cerrado, respaldo completo del paquete y registro atómico de la clase original antes de modificar el ZIP. Restaurar repone exactamente esa clase, no todo el paquete: conserva las ediciones posteriores de vehículos.

**El usuario confirmó que funciona en su partida; no garantiza carretera en cualquier coordenada.** `prop_construction`, `prop_building_formwork` y `prop_mobile_zone` cambian por separado la terraformabilidad mediante `SetTerraformabilityFromObb`; esas protecciones dinámicas se conservan. Materiales estáticos, máscaras compiladas, agua y colisiones pueden seguir bloqueando trabajo. Reponer las reglas **no deshace el terreno ya guardado**. Antes de usarlo hay que respaldar también la partida, evitar enterrar entradas/logística y probar en solitario. Las pruebas automatizadas usan paquetes sintéticos, no el juego instalado.

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

Los parámetros de vehículos, tráilers y convoyes logísticos se agrupan en pestañas independientes. Cambiar de pestaña de parámetros no guarda ni descarta los cambios pendientes. El visor permanece junto al panel de ajustes. La animación original del logo representa explorador → volquete descargando arena → dozer → asfaltadora → rodillo → camión de carga; el explorador espera y se retira al final. Se respeta la preferencia de movimiento reducido.

## Carga y ruedas, 0.8.4

La carga de arena se configura mediante `properties.prop_load_volume.volumeMass` en kg; el editor muestra toneladas con factor 0.001. En las ocho variantes no base comprobadas: Bowhead 20 t, Baikal old/res 40 t, EPEC LT200 5 t, Tayga old/res y Voron 10 t, Wayfarer OFT96 TS D 40 t. No se edita `sandCapacity` de los metadatos de tienda ni el radio de trabajo para simular una capacidad inexistente. La [ficha oficial del Bowhead](https://store.steampowered.com/app/2806770/RoadCraft__Aramatsu_Bowhead_30T/) confirma sus 20 toneladas. `PropLoadVolume.GetMaxMass`, `GetCurrentMass` y `GetDensity` de los scripts locales distinguen masa, volumen y densidad. La forma visual de la caja no cambia; aumentar la masa puede afectar la física. Los niveles 5/10/20% y el límite 125% son precauciones de diseño, no límites garantizados por Saber ni una prueba de estabilidad en partida.

Los 1.960 anclajes de ruedas de las 194 clases instaladas se comprobaron contra sus TPL. Diez variantes no base de Zikz/Vostok tenían marcadores con X orientado hacia Z. Usar esa rotación del marcador ponía las ruedas transversalmente mal, aunque el giro no alterara su eje. En el visor recto se utiliza la posición del marcador y el eje transversal X del vehículo; las rotaciones de huesos DCC y de cuerpos de colisión no son ángulos de dirección. La [documentación oficial de ruedas](https://roadcraft-modding.prismray.io/truck_modding/creating_3d_model/wheels/) especifica una fuente separada centrada en el origen y orientada a −X. Los FBX cancelan las rotaciones del anclaje completo para conservar los ejes de esa fuente.

La banda de oruga conserva topología, UV y normales originales. Las coordenadas de cada vértice viajan por el mismo contorno cerrado usado para la pose inicial, sin reconstruir la malla cada fotograma ni limitarse a desplazar una textura. Se actualiza hasta 30 veces por segundo, con pausa y movimiento reducido; no incorpora suspensión, sag, colisiones ni simulación de terreno del motor original.
