# RoadCraft Studio 0.8.1

- Corrige el desplazamiento lateral: el terreno avanza ahora por el eje longitudinal del vehículo y las ruedas giran alrededor del eje real, con su radio individual.
- Respeta las marcas `isStaticTruck` y de maquinaria ferroviaria del juego. Las cinco grúas fijas o sobre rieles de la instalación comprobada no se animan conduciendo por el terreno. Los camiones con grúa conservan el movimiento.
- Corrige la escala de ruedas compiladas usando `radius / geomRadius` y la escala de los rodillos visuales.
- Reconstruye las orugas en posición de reposo con los eslabones originales y el contorno de los rodillos configurados. Completa los rodillos visuales que antes faltaban; las orugas no se hacen girar como ruedas.
- Excluye volúmenes invisibles de carga y superficies duplicadas que distorsionaban la silueta.
- Aplica los índices de hueso rígidos, incluso cuando están en un buffer separado: corrige piezas de cabina desplazadas que hacían flotar y encuadrar mal algunas máquinas.
- Corrige la orientación vertical de las texturas TPL, contrastada con el FBX original, y lee las máscaras y parámetros de pintura de los materiales locales.
- El visor comienza cargando el modelo 3D, sin sustituirlo automáticamente por una carátula. La imagen original queda como opción explícita de comparación. Las tarjetas de la biblioteca conservan sus miniaturas.
- Nueva caché de geometría y lectura de definiciones de material bajo demanda.
- Aísla los nombres de materiales de carrocería, ruedas y orugas para evitar que una textura reemplace la de otra pieza. Admite las secciones de oruga finas antes de ensamblarlas.
- Mantiene visible el suelo bajo las grúas altas, incluso con la cámara alejada.

La vista sigue siendo una reconstrucción local, no el motor del juego. No simula la suspensión ni la deformación dinámica de las orugas, y determinados materiales y poses de equipos pueden diferir. No se distribuyen archivos del juego ni se modifica la instalación al cargar el visor.

Referencias: [SDK: ruedas](https://roadcraft-modding.prismray.io/truck_modding/creating_3d_model/wheels/), [materiales](https://roadcraft-modding.prismray.io/truck_modding/mod_editor/material_setup/) y [vehículos estáticos](https://roadcraft-modding.prismray.io/tutorial/add_vehicle/).
