# RoadCraft Studio 0.8.2

Corrige un fallo detectado en la revisión visual del catálogo: se animaba el soporte de las ruedas en vez de la rueda interior, lo que podía inclinar o deformar neumáticos al girar en vehículos con soportes orientados/escalados, como ciertas variantes del Zikz 612C.

- Giro sobre el eje local del modelo, conservando la dirección del soporte.
- Sentido corregido para ruedas izquierdas reflejadas.
- Nuevas pruebas de orientación durante el giro y caché de montaje actualizada.
- Conserva todas las mejoras de modelos, orugas, grúas fijas y movimiento longitudinal de 0.8.1.

La revisión completa de 0.8.1 comprobó la carga 3D de 196 configuraciones. Esto no equivale a fidelidad perfecta: algunas entradas, como Alces PL30C, Aramatsu R1, Hollander MK11 y Kronenwerk Trench Digger, todavía muestran materiales o geometría incompletos/de prueba. El visor no es el motor del juego ni reproduce toda su física.
