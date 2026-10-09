<template>
  <g class="terrain-particles" :class="`terrain-particles--${material}`" :data-particle-material="material" :data-particle-kind="kind">
    <circle v-for="particle in particles" :key="particle.index" class="terrain-particle" :cx="0" :cy="0" :r="particle.radius" :style="particle.style"/>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ material: 'snow' | 'mud' | 'sand' | 'dust'; kind?: 'spray' | 'fall' | 'cloud'; count?: number }>()
// Seeded variations keep the scene repeatable and avoid a timer/render loop.
const particles = computed(() => Array.from({ length: props.count ?? 14 }, (_, index) => {
  const seed = (index * 37 + 11) % 97 / 97
  const fall = props.kind === 'fall', cloud = props.kind === 'cloud'
  const distance = fall ? -8 - seed * 19 : -13 - seed * 32
  const rise = fall ? 9 + seed * 11 : -8 - seed * 22
  const duration = fall ? .62 + seed * .32 : cloud ? 1.1 + seed * .65 : .65 + seed * .45
  return { index, radius: cloud ? 3 + seed * 5 : .7 + seed * (props.material === 'mud' ? 2 : 1.4),
    style: {
      '--x1': distance * .32 + 'px', '--y1': rise + 'px',
      '--x2': distance * .7 + 'px', '--y2': (fall ? 24 : cloud ? rise * .9 : rise * .45) + 'px',
      '--x3': distance + 'px', '--y3': (fall ? 43 : cloud ? -4 : 10) + 'px',
      '--particle-scale': cloud ? 2.3 : .65,
      animationDuration: duration + 's', animationDelay: -index * duration / (props.count ?? 14) + 's'
    }
  }
}))
</script>

<style scoped>
.terrain-particles--snow { fill:#e4eef0; }
.terrain-particles--mud { fill:#856044; }
.terrain-particles--sand { fill:#e8bb78; }
.terrain-particles--dust { fill:#b9a485; }
.terrain-particle { animation:ballistic 1s linear infinite;transform-box:fill-box;transform-origin:center; }
.terrain-particles[data-particle-kind="cloud"] { opacity:.24;filter:blur(1.2px); }
@keyframes ballistic {
  0% { opacity:0;transform:translate(0,0) scale(.7); }
  8% { opacity:.85; }
  30% { opacity:.8;transform:translate(var(--x1),var(--y1)) scale(1); }
  64% { opacity:.55;transform:translate(var(--x2),var(--y2)) scale(1); }
  100% { opacity:0;transform:translate(var(--x3),var(--y3)) scale(var(--particle-scale)); }
}
@media (prefers-reduced-motion:reduce) { .terrain-particle { animation:none !important; } .terrain-particles { display:none; } }
</style>
