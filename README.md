# RoadCraft Studio

Editor visual, seguro y multilenguaje para proyectos de vehículos y llantas de RoadCraft.

RoadCraft Studio detecta automáticamente la instalación ubicada en
`E:\SteamLibrary\steamapps\common\RoadCraft`, analiza recursivamente los archivos fuente
`.bro` y permite modificar parámetros seleccionados sin salir de límites conservadores.

## Funciones

- Biblioteca separada para vehículos, llantas, recursos y elementos modificados.
- Detección automática de nuevos archivos `.bro` al iniciar y con **Buscar de nuevo**.
- Valores original y actual, con recomendaciones **Poco**, **Medio** y **Alto**.
- Rangos protegidos para motor, combustible, suspensión, transmisión y llantas.
- Copia de seguridad automática antes de cada guardado.
- Restauración del valor original desde la propia aplicación.
- Imagen automática compatible o imagen personalizada por mod.
- Acceso al Mod Editor oficial de RoadCraft para construir el paquete `.pak`.
- Interfaz disponible en los 15 idiomas compatibles con RoadCraft; español e inglés
  incluyen la traducción completa y el resto usan traducciones principales con respaldo en inglés.
- Actualización automática mediante las versiones publicadas en GitHub.

## Uso seguro

La aplicación trabaja únicamente con el contenido fuente de
`root\mods_source\bro`. No modifica los paquetes base del juego. RoadCraft usa archivos
`.bro` como fuente y su Mod Editor oficial se encarga de construir los paquetes finales.

1. Cierra RoadCraft antes de modificar un proyecto.
2. Selecciona un vehículo o una llanta.
3. Elige un nivel recomendado o escribe un valor dentro del rango protegido.
4. Guarda los cambios.
5. Abre el Mod Editor oficial para construir y probar el mod.

Las copias se guardan dentro de los datos locales de la aplicación, en la carpeta
`backups` de RoadCraft Studio.

## Desarrollo

Requisitos: Node.js 22 o superior y Windows x64.

```powershell
npm ci
npm run check
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
