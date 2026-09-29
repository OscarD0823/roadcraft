# RoadCraft Studio

## Versión 0.4.3

- Permite configurar hasta 1.000 m el ancho funcional de pavimentadoras, rodillos, topadoras y volquetes sin escalar el modelo visual.
- Mantiene sincronizadas las zonas principal, trasera y delantera de trabajo de los rodillos.
- Conserva el valor original y permite restaurarlo desde la interfaz.
- Añade controles específicos para la trituradora móvil Zikz 605E: restricción de terreno, radio de detección y distancia de funcionamiento.

Editor visual, seguro y multilenguaje para vehículos, tráilers, llantas y partidas de RoadCraft.

RoadCraft Studio detecta automáticamente la instalación ubicada en
`E:\SteamLibrary\steamapps\common\RoadCraft`, analiza recursivamente los archivos fuente
`.bro` y las configuraciones `.cls` incluidas en `default_other.pak`. Permite modificar
parámetros seleccionados sin salir de límites conservadores.

## Funciones

- Catálogo de vehículos base leído directamente desde `default_other.pak`.
- Biblioteca separada para vehículos, tráilers, llantas, recursos y elementos modificados.
- Detección automática de nuevos `.cls` y `.bro` al iniciar y con **Buscar de nuevo**.
- Valores original y actual, con recomendaciones **Poco**, **Medio** y **Alto**.
- Rangos protegidos para par y respuesta del motor, combustible, frenos, suspensión,
  transmisión, dirección, tracción, bloqueo de diferencial y dimensiones reales de llantas.
- Copia completa de seguridad del `.pak` antes de la primera modificación y una nueva
  copia cuando RoadCraft o un mod externo reemplazan el paquete.
- Reconstrucción verificada del paquete y eliminación segura de `default_other.pak.cache`.
- Restauración del valor original desde la propia aplicación.
- Carátulas oficiales extraídas localmente de `ui_shop_*.pct_mip`; las configuraciones
  especiales sin carátula propia se identifican como imagen relacionada.
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
2. Selecciona un vehículo o una llanta.
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
