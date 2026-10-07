# RoadCraft Studio

## Versión 0.8.10 · Carreteras libres (experimental)

- Botón de carretera junto al idioma y acceso desde Equipo de trabajo para probar el desbloqueo de zonas estáticas no modificables del mapa.
- Se conserva el dominio del mapa y los permisos obligatorios de los vehículos. Confirmación explícita, juego cerrado, copia del paquete y restauración de la clase exacta sin perder cambios de camiones.
- Si un mod o una actualización cambia esa clase, se bloquea la operación para no sobrescribirlo. Nunca se activa al instalar o iniciar el programa.
- Los errores y cancelaciones se muestran dentro del panel, incluso cuando el juego está abierto.

**Sin verificar en partida.** No garantiza construir en cualquier coordenada: las obras activas, materiales, agua, colisiones y máscaras compiladas pueden mantener sus límites. Restaurar las zonas no deshace arena/asfalto guardados. Respalda también tu partida y prueba en solitario. [Detalles de la versión](RELEASE_NOTES_0.8.10.md).

### Mejoras de 0.8.8

- Radio del ZikZ Mobile Scalper hasta 10.000 m, con botón «Suministro para todo el mapa · 10 km (experimental)». Sincroniza las tres distancias; no cambia la geometría ni promete estabilidad en partida.
- Edición vinculada de variantes compatibles del mismo chasis, incluidas old/restauradas y familias Wayfarer. Se puede desactivar y consultar la lista antes de guardar. Solo copia ajustes cambiados; respeta diferencias mecánicas proporcionales y no añade equipos inexistentes ni edita copias base/convoyes.
- Cada variante conserva sus originales. Los cambios de una familia se verifican y reemplazan en una sola operación del PAK; si algún valor no es válido, se rechaza el conjunto.
- Los ajustes de arena del vehículo no desactivan las zonas protegidas. Desde 0.8.9, la prueba experimental se hace sobre la clase separada de zonas del mapa, conservando los permisos del camión.

### Identidad de 0.8.7

- Identificador `@OscarD0823` en la cabecera, enlazado al perfil de GitHub, y acceso «Repo» al repositorio de RoadCraft Studio.
- Ambos enlaces permanecen visibles al dividir la pantalla, admiten foco de teclado y abren el navegador predeterminado, sin sustituir la ventana del editor.

### Pintura y animación de 0.8.6

- Lee la pintura de empresa de `SslValue.companyCustomization.truckMaterialName` en la partida seleccionada. Usa la biblioteca original `auto_materials_library.sso` y sus tres canales de color, no la tabla distinta de daño/suciedad.
- Usa las máscaras locales de pintura en el visor 3D y sus colores en las máquinas ilustradas del logo. Conserva los materiales sin máscara compatible y avisa de compatibilidad parcial. No reproduce los emblemas/grafitis ni modifica la partida para pintar.
- El primer volquete sale del logo cargado y regresa descargando en reversa. La excavadora de orugas sale, trabaja y vuelve al logo; el segundo camión descarga hacia delante, seguido de excavadora, asfaltadora, aplanadora, camión final y salida del explorador.
- Ciclo de 54 segundos con piedras, barro y desniveles; mantiene el visor lateral y respeta movimiento reducido.

La partida Steam normalmente está en `%LOCALAPPDATA%\Saber\RoadCraftGame\storage\steam\user\<perfil>\Main\save\SLOT_<n>\CompleteSave`. El editor busca bajo Saber y Saber Interactive, carga el guardado local más reciente al iniciar y permite escoger otro slot en Partidas. Si no existe un guardado local, no inventa una pintura: conserva el aspecto original. Abre el juego, guarda una partida y pulsa «Buscar partidas»; también puedes abrir CompleteSave manualmente. Un registro de Steam Cloud no equivale al archivo de partida.

### Animación de 0.8.5

- El explorador del logo cruza piedras, barro y desniveles, con inclinación y salpicaduras, y espera a que termine la obra antes de salir.
- Secuencia de carretera: volquete de orugas en reversa descargando arena, niveladora, segundo camión de arena en reversa, segunda pasada de niveladora, asfaltadora, aplanadora y camión final.
- La superficie se transforma detrás de cada máquina, conserva las dos capas de arena y se reinicia en un ciclo de 42 segundos. Respeta la preferencia de movimiento reducido de Windows.

Esta secuencia fue sustituida por la de 0.8.6 descrita arriba.

### Mejoras de 0.8.4

- Cantidad de arena en toneladas en Equipo de trabajo: valor original, entrada manual y niveles +5%, +10% y +20%. Solo aparece donde existe `prop_load_volume.volumeMass`; no se confunde con el ancho de descarga.
- Límite preventivo de 75%–125% de la carga original, copia y restauración. Más arena aumenta el peso: los límites no garantizan estabilidad física; es necesario comprobarlo dentro del juego.
- Corrige las ruedas giradas 90° de los Zikz 605E Mobile Scalper/Heavy Transporter y 612C Heavy Crane, las variantes Vostok afectadas y los anclajes TPL fuente. Conserva posición del buje y escala configurada sin heredar rotaciones DCC del marcador.
- Los eslabones originales de las orugas circulan por el contorno de sus rodillos. El movimiento se detiene al pausar; no simula la deformación física del juego.

### Clasificación de 0.8.3

- «Logística» contiene solo las configuraciones referenciadas por los convoyes de entregas/pruebas de rutas entre empresas, no todos los vehículos que puede usar la IA.
- Lee `RegularPool` y `TestPool` de las escenas compiladas instaladas y de fuentes de mapas/mods `.scn`. Una nueva búsqueda vuelve a comprobarlos.
- La instalación comprobada tiene 22 configuraciones logísticas: 19 exclusivas y tres compartidas con el jugador. Las compartidas aparecen en ambas secciones con advertencia; no se duplican ni sus archivos ni sus cambios.
- Las variantes `base_` sin rutas confirmadas quedan en Otros. El prefijo o el nombre `_ai` por sí solos ya no deciden la clasificación.
- El editor muestra los mapas, si el uso es entrega habitual o prueba de ruta, y la carga configurada. Advierte cuando no puede analizar una escena.

### Correcciones de 0.8.2

- Las ruedas giran dentro de su soporte fijo, conservando la dirección y la escala del eje. Evita neumáticos inclinados o aplastados durante la animación, detectados al revisar las variantes del Zikz 612C.
- Incluye las correcciones de ensamblado de 0.8.1 indicadas a continuación.

### Correcciones de 0.8.1

- Corrige el movimiento lateral y respeta las cinco grúas fijas/ferroviarias de la instalación verificada.
- Ensambla ruedas con sus escalas originales y completa rodillos y eslabones de oruga en reposo.
- Corrige las texturas TPL invertidas y lee las máscaras locales de pintura.
- Separa los materiales de cada modelo y mantiene visible el suelo bajo las grúas altas.
- Oculta volúmenes de carga invisibles y superficies duplicadas. El editor no sustituye automáticamente el modelo por una carátula; esta queda como comparación opcional.

### Catálogo y mejoras de 0.8.0

- Catálogo completo de la instalación probada. La clasificación amplia de 74 variantes de IA de esta versión se sustituyó en 0.8.3 por referencias reales de convoyes logísticos.
- Detecta las clases `trucks/base/`; no confunde las versiones recuperadas `old` con estas copias.
- Precio, rango, tipo de control y variante oxidada visibles. La disponibilidad real depende de mapa, objetivos, DLC y partida.
- Ajustes agrupados en pestañas por categoría para vehículos, tráilers e IA, sin perder cambios pendientes al cambiar de grupo.
- Nuevo lector propio de TPL/TPL_DATA: geometría original del catálogo, texturas locales y ruedas separadas, además de FBX fuente.
- Los 118 modelos diferentes encontrados en la instalación pasan las comprobaciones de geometría, índices, normales y dimensiones.
- Animación del logo con explorador, volquete descargando arena, dozer, asfaltadora, rodillo y camión final; el explorador se retira al terminar.
- Una nueva búsqueda también renueva los índices de modelos y texturas.

La [investigación y sus fuentes oficiales](docs/vehicle-research.md) explican cómo se determinan IA, tienda y variantes de misión. La vista 3D no es el motor del juego: la deformación de las orugas, ciertos materiales y poses/animaciones de maquinaria pueden diferir. Que un modelo cargue no garantiza que sea visualmente idéntico al juego.

## Mejoras anteriores

- Corrige una condición de carrera al abrir el programa: la ventana se muestra tras el primer dibujo, sin perder el evento durante la carga.

- Visor permanente en el lateral izquierdo y ajustes con desplazamiento independiente a la derecha, como en SnowRunner Studio.
- Botones de guardar/restaurar siempre accesibles y distribución adaptada a ventanas de 600, 960 y 1366 píxeles.
- Encuadre automático según el tamaño del panel; las grúas y vehículos altos no quedan recortados al dividir la pantalla.
- Ruedas fuente con escala y orientación originales, montadas en sus puntos del FBX y girando sobre su eje real.
- Materiales originales con mapas de color, normales, metal, rugosidad y oclusión; se ocultan colisiones, niveles de detalle alternativos y geometría auxiliar.
- Encuadrar, pausar y cambiar terreno sin perder los valores que se están editando.

La lectura de materiales y ruedas sigue las especificaciones del [SDK oficial de RoadCraft](https://roadcraft-modding.prismray.io/truck_modding/creating_textures/naming/) y sus [modelos de ruedas](https://roadcraft-modding.prismray.io/truck_modding/creating_3d_model/wheels/). El visor utiliza Three.js, no el motor del juego: materiales especiales de personalización o efectos exclusivos pueden diferir.

- Animación integrada en la cabecera del programa.
- Vista del vehículo dentro del inspector, con pausa y terrenos automáticos o manuales.
- Lectura de modelos fuente FBX y materiales del editor oficial cuando están presentes.
- Si un modelo usa un formato no compatible, se conserva la imagen original como alternativa y se identifica expresamente como carátula.
- Distribución y actualizaciones exclusivamente por GitHub. No se incluyen modelos ni texturas del juego en el instalador.

La escena es una previsualización propia, no el motor ni la física de RoadCraft. Los ajustes de motor no deforman el vehículo. Cambiar parámetros funcionales no implica modificar el modelo visual.

- Permite configurar hasta 1.000 m el ancho funcional de pavimentadoras, rodillos, topadoras y volquetes sin escalar el modelo visual.
- Mantiene sincronizadas las zonas principal, trasera y delantera de trabajo de los rodillos.
- Conserva el valor original y permite restaurarlo desde la interfaz.
- Añade controles específicos para la trituradora móvil Zikz 605E: restricción de terreno, radio de detección y distancia de funcionamiento.
- Rediseña la navegación, separa las unidades exclusivas de IA y clasifica los tráilers mediante las etiquetas internas del juego.
- Corrige las carátulas BC1/BC7 del juego y elimina el ruido multicolor de las imágenes.
- Completa el catálogo con los iconos oficiales de vehículos cuando no existe una carátula de tienda.
- Clasifica la IA usando la biblioteca actual del juego, oculta las fuentes de llantas y elimina las etiquetas superpuestas de las imágenes.
- Adapta el catálogo y el inspector para trabajar cómodamente con la pantalla dividida.

Editor visual, seguro y multilenguaje para vehículos, tráilers, unidades de IA y partidas de RoadCraft.

RoadCraft Studio detecta automáticamente la instalación ubicada en
`E:\SteamLibrary\steamapps\common\RoadCraft`, analiza recursivamente los archivos fuente
`.bro` y las configuraciones `.cls` incluidas en `default_other.pak`. Permite modificar
parámetros seleccionados sin salir de límites conservadores.

## Funciones

- Catálogo de vehículos base leído directamente desde `default_other.pak`.
- Biblioteca separada para vehículos, tráilers, unidades de IA, recursos y elementos modificados.
- Detección automática de nuevos `.cls` y `.bro` al iniciar y con **Buscar de nuevo**.
- Valores original y actual, con recomendaciones **Poco**, **Medio** y **Alto**.
- Rangos protegidos para par y respuesta del motor, combustible, frenos, suspensión,
  transmisión, dirección, tracción y bloqueo de diferencial.
- Copia completa de seguridad del `.pak` antes de la primera modificación y una nueva
  copia cuando RoadCraft o un mod externo reemplazan el paquete.
- Reconstrucción verificada del paquete y eliminación segura de `default_other.pak.cache`.
- Restauración del valor original desde la propia aplicación.
- Carátulas e iconos oficiales extraídos localmente de `ui_shop_*.pct_mip` y
  `ui_veh_*.pct_mip`, sin etiquetas superpuestas sobre la imagen.
- Imagen personalizada de mods leída desde `uiCustomShopIcon` o `uiCustomIcon` del `.bro`.
- Acceso al Mod Editor oficial de RoadCraft para construir el paquete `.pak`.
- Interfaz disponible en los 15 idiomas compatibles con RoadCraft; español e inglés
  incluyen la traducción completa y el resto usan traducciones principales con respaldo en inglés.
- Actualización automática mediante las versiones publicadas en GitHub.
- Editor independiente de partidas `CompleteSave`: dinero, experiencia, empresa, camiones
  bloqueados/desbloqueados, mapas, progreso, combustible y recursos.
- Detección automática de perfiles y ranuras de Steam, además de selección manual de
  `CompleteSave` para ubicaciones no estándar.
- Lectura y escritura verificada de todos los bloques zlib y de la firma MD5 de la partida;
  los campos desconocidos se conservan para mantener compatibilidad con actualizaciones y mods.

## Uso seguro

Los vehículos normales están guardados como `.cls` dentro de
`root\paks\client\default\default_other.pak`. RoadCraft Studio reconstruye ese archivo
en una ubicación temporal, verifica el vehículo guardado y solo entonces reemplaza el
paquete. También continúa trabajando con las fuentes oficiales `.bro` de mods.

1. Cierra RoadCraft antes de modificar un vehículo del paquete base. La aplicación
   bloquea el guardado si detecta el juego abierto.
2. Selecciona un vehículo, tráiler o unidad de IA.
3. Elige un nivel recomendado o escribe un valor dentro del rango protegido.
4. Guarda los cambios.
5. Para proyectos `.bro`, abre el Mod Editor oficial para construir y probar el mod.

Las copias se guardan dentro de los datos locales de la aplicación, en la carpeta
`backups` de RoadCraft Studio.

Al modificar una partida, la copia se guarda junto al archivo original con el nombre
`CompleteSave.roadcraft-studio-<fecha>.bak`. El archivo nuevo se valida antes de reemplazar
la partida. RoadCraft también debe estar cerrado durante este proceso.

## Desarrollo

Requisitos: Node.js 22 o superior y Windows x64.

```powershell
npm ci
npm run check
npm test
npm start
```

Para crear el instalador:

```powershell
npm run make
```

Los artefactos se generan en `out\make\squirrel.windows\x64`.

## Autor

OscarD0823

## Licencia

MIT
