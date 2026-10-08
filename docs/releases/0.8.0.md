# RoadCraft Studio 0.8.0

- Catálogo ampliado: detecta las 73 variantes `base_` que antes se omitían y las coloca en Uso de IA, junto a la variante explícita de convoy. En la instalación verificada: 116 vehículos, 6 tráilers, 74 unidades de IA y un recurso.
- Distingue configuraciones de jugador, variantes recuperadas/oxidadas `old` y vehículos de convoy. Muestra precio y rango configurados, sin confundirlos con el desbloqueo de la partida.
- Pestañas de Motor, Combustible, Suspensión, Transmisión, Dirección, Tracción y Equipo de trabajo según los ajustes presentes. El visor permanece al lado; cambiar de grupo no pierde las ediciones.
- Modelos originales TPL/TPL_DATA y texturas leídos de la instalación local, con geometría y transformaciones comprobadas en los 118 modelos distintos del catálogo. Se conservan fuentes FBX y la carátula como alternativa ante formatos incompatibles.
- Corrige la selección de niveles de textura y completa las ruedas de la fuente TUZ que solo tiene modelo compilado.
- Permite alternar entre modelo 3D y carátula original, cuando existe, para comparar con la apariencia del juego.
- Caché de geometría comprimida para reducir el espacio local utilizado por el visor.
- Nueva animación: el explorador espera mientras volquete, dozer, asfaltadora y rodillo construyen la carretera; pasa el camión de carga y después sale el explorador.
- Respeta movimiento reducido, pantalla dividida y el selector de los 15 idiomas. Español e inglés completos; los demás conservan respaldo en inglés para textos sin traducción.

Los modelos y texturas del juego **no se incluyen en la descarga**. Se requiere una instalación local. La vista no reproduce íntegramente los shaders, orugas continuas ni animaciones de equipo del motor original. La disponibilidad efectiva de un vehículo depende del mapa, objetivos, DLC y partida.

Investigación: [SDK oficial: rutas IA](https://roadcraft-modding.prismray.io/scene_components/objective_system/infrastructure_request/) y [recompensas](https://roadcraft-modding.prismray.io/scene_components/objective_system/rewards/).
