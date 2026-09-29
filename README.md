# RoadCraft Studio

Editor visual, seguro y multilenguaje para vehículos, tráilers y llantas de RoadCraft.

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
