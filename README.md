# RoadCraft Studio

## Versión 0.7.0

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
- Las unidades del catálogo base con TPL compilado mantienen su imagen original sobre el recorrido animado; todavía no se presentan como modelos 3D compatibles.
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
