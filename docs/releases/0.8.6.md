# RoadCraft Studio 0.8.6

- Lectura automática de la pintura de la empresa en el CompleteSave local seleccionado. Colores y patrones de la biblioteca original en los materiales compatibles del visor, y esos colores en la ilustración del logo.
- Corrige la consulta a una tabla de colores que no correspondía a los materiales de personalización. Conserva cristales, neumáticos y piezas sin máscara compatible; indica los casos parcialmente compatibles.
- Primera salida del camión de arena desde el logo cargado, regreso descargando en reversa y entrada al logo.
- Sustituye la niveladora de ruedas por una máquina ilustrada de orugas, pala y brazo: trabaja hacia delante y regresa al logo.
- Segunda descarga de arena hacia delante, segunda pasada de excavadora, asfaltadora, aplanadora y camión. El explorador espera y sale al final.
- Ciclo de 54 segundos, terreno de piedras/barro/desniveles, visor lateral y movimiento reducido.

La pintura es una vista previa: no cambia archivos del juego ni la partida. Los emblemas/grafitis no se reproducen, y la ilustración del logo no es una reproducción exacta del modelo o patrón del juego. Se conservan las limitaciones del visor local, que no es el motor gráfico de RoadCraft.

## Encontrar la partida

En Steam normalmente está en:

`%LOCALAPPDATA%\Saber\RoadCraftGame\storage\steam\user\<perfil>\Main\save\SLOT_<n>\CompleteSave`

Se buscan automáticamente las carpetas Saber y Saber Interactive del perfil de Windows. En Partidas se puede seleccionar otro slot, volver a buscar o abrir CompleteSave manualmente. Si no se detecta un archivo local/pintura compatible, se mantiene el aspecto original. Abre RoadCraft, guarda una partida, cierra el juego y pulsa «Buscar partidas».

En el equipo de validación no se encontró una partida real local: Steam tenía solo un registro de sincronización. La integración se prueba con un CompleteSave sintético, separado en `out/qa-ui`, y con materiales/modelos originales de la instalación local. No se afirma haber leído la pintura personal del usuario.

## Validación

- Lectura del descriptor nativo, tres canales RGB, rechazo de valores inválidos, máscaras y composición del shader PBR.
- Codificación/firma de CompleteSave y conservación íntegra de personalización al editar estadísticas.
- 118 modelos TPL decodificados y 1.960 anclajes de ruedas comprobados en 194 configuraciones; cinco máquinas fijas/ferroviarias respetadas.
- Pruebas del logo: 12 etapas, sentidos de marcha, descargas, regreso de excavadora, espera del explorador, reinicio y movimiento reducido.
- Pruebas de la aplicación empaquetada con partida sintética: pintura en visor/logo, máscaras de cabina/caja y geometría sin modificar; catálogo, imágenes, clasificación y distribución responsiva.
- El instalador conserva configuraciones locales. No distribuye modelos, texturas ni partidas del juego.
