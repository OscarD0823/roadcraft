<template>
  <div class="startup-journey" :class="{ 'startup-journey--loop': loop }" :data-paint="paint?.id ?? 'original'" :style="paintStyle" aria-hidden="true">
    <svg viewBox="0 0 900 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient :id="`${id}-sky`" x2="0" y2="1"><stop stop-color="#112739" /><stop offset="1" stop-color="#708781" /></linearGradient>
        <linearGradient :id="`${id}-road`" x2="0" y2="1"><stop stop-color="#485561" /><stop offset="1" stop-color="#25343f" /></linearGradient>
        <linearGradient :id="`${id}-sand`" x2="0" y2="1"><stop stop-color="#e9c991"/><stop offset="1" stop-color="#98734d"/></linearGradient>
        <linearGradient :id="`${id}-water`" x2="0" y2="1"><stop stop-color="#769590"/><stop offset=".3" stop-color="#524b3b"/><stop offset="1" stop-color="#2e2924"/></linearGradient>
        <pattern :id="`${id}-soil-grain`" width="37" height="17" patternUnits="userSpaceOnUse"><path d="m2 4 5 1m13 8 8-1m6-9 2 1" stroke="#243c37" stroke-width=".9" opacity=".32"/><circle cx="11" cy="14" r=".7" fill="#ead3a3" opacity=".45"/></pattern>
        <pattern :id="`${id}-sand-grain`" width="29" height="11" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".7" fill="#6e573c" opacity=".4"/><circle cx="19" cy="8" r=".8" fill="#ffe3b0" opacity=".5"/><path d="M8 2h3m10 3h4" stroke="#a78256" stroke-width=".6"/></pattern>
        <clipPath :id="`${id}-rough`"><rect class="terrain-progress" y="170" width="900" height="70" /></clipPath>
        <clipPath v-for="phase in ['sand-1', 'graded-1', 'sand-2', 'graded-2', 'paved', 'rolled']" :id="`${id}-${phase}`" :key="phase"><rect class="road-progress" :class="`road-progress--${phase}`" y="177" width="900" height="63" /></clipPath>
      </defs>
      <rect width="900" height="240" rx="18" :fill="`url(#${id}-sky)`" />
      <circle cx="716" cy="54" r="30" fill="#f3c890" opacity=".4" />
      <path d="M0 135 95 61 156 92 248 21 355 110 431 70 579 135 692 47 795 106 855 73 900 109V200H0Z" fill="#96aaaa" opacity=".35" />
      <path d="m211 51 37-30 38 32-25-7-13 9-13-12zM659 77l33-30 31 30-21-5-10 8-12-12z" fill="#d2d1b4" opacity=".45" />
      <path d="M0 151 104 118 194 144 295 106 427 150 546 114 661 144 790 117 900 146V215H0Z" fill="#29494e" />
      <g fill="#183a3b"><path v-for="(x, i) in [12, 35, 151, 174, 291, 315, 532, 554, 789, 818, 865, 890]" :key="x" :transform="`translate(${x},${115 + i % 3 * 7})`" d="M0 57h7V35h14L4-4-13 35H0Z" /></g>
      <path d="M0 205H900V240H0Z" fill="#6f6252" />
      <g class="rough-terrain" :clip-path="`url(#${id}-rough)`">
        <path d="M0 205h155q25 0 52-15t55-2 43 17q33 0 64 6t70-6q44 0 89-13t51-2 65 15h256v35H0Z" fill="#596254" />
        <g class="terrain-rocks" fill="#858d80" stroke="#414d49" stroke-width="2"><path d="m208 190 9-10 14 1 11 10-8 8h-21Z" /><path d="m247 192 7-15 14-3 14 14-4 10h-27Z" /><path d="m514 198 9-13 16 2 8 12-17 4Z" /><path d="m565 190 10-11 16 3 8 16-19 2Z" /></g>
        <path d="m217 180 4 10 10-9m-10 9-8 9m41-22 9 11 5-14m-5 14 15 10m245-13 7 12 9-10m36-8 4 15 12-12" stroke="#bbc2a9" stroke-width="1" fill="none" opacity=".6"/>
        <g class="terrain-mud"><path d="M330 205q57-12 130 0l-8 11q-62 11-124 0Z" :fill="`url(#${id}-water)`" /><path d="M346 208q43-5 92 1M364 216h59" fill="none" stroke="#b2bca2" stroke-width=".8" opacity=".55"/><path d="m318 221 18 3m123-2 18-3" stroke="#3e3530" stroke-width="4" /></g>
        <rect y="205" width="900" height="35" :fill="`url(#${id}-soil-grain)`"/>
        <path d="M25 217h125m25 5h87m224-2h45m135-4h126" stroke="#2e3e37" stroke-width="2" opacity=".4" />
      </g>
      <!-- Separate layers retain the first grading under the second sand delivery. -->
      <g v-for="pass in [1, 2]" :key="pass">
        <g :clip-path="`url(#${id}-sand-${pass})`"><path d="M0 203q30-14 61 0t61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 107 0V232H0Z" :fill="`url(#${id}-sand)`" /><rect y="205" width="900" height="27" :fill="`url(#${id}-sand-grain)`"/><path d="M0 216H900" stroke="#ac794c" stroke-width="1" stroke-dasharray="2 9" opacity=".4"/></g>
        <g :clip-path="`url(#${id}-graded-${pass})`"><path class="grade-clearance" d="M0 177H900V205H0Z" fill="#29494e" /><path d="M0 205H900V233H0Z" :fill="pass === 1 ? '#c8a875' : '#d6b581'" /><rect y="205" width="900" height="28" :fill="`url(#${id}-sand-grain)`"/><path d="M0 213H900M0 226H900" stroke="#91744f" stroke-width="1" opacity=".4" /></g>
      </g>
      <g :clip-path="`url(#${id}-paved)`"><path d="M0 205H900V235H0Z" fill="#59615d" /><path d="M0 218H900" stroke="#85877a" stroke-width="18" stroke-dasharray="2 6" opacity=".18" /></g>
      <g :clip-path="`url(#${id}-rolled)`"><path d="M0 205H900V235H0Z" :fill="`url(#${id}-road)`" /><path d="M0 220H900" stroke="#e5cba3" stroke-width="2" stroke-dasharray="23 18" /><path d="M0 207H900M0 233H900" stroke="#9eaa9f" stroke-width="1" opacity=".5" /></g>
      <path class="scout-shoulder" d="M794 205v-17q20-8 42-4h64v21Z" fill="#526957" /><path d="M804 187h96" stroke="#89917b" stroke-width="2" />
      <g class="journey-portal"><circle cx="58" cy="137" r="39" fill="#112c37" stroke="#d79951" opacity=".85" /><circle class="logo-ring" cx="58" cy="137" r="35" fill="none" stroke="#ffc176" stroke-dasharray="24 16" /><image :href="appIcon" x="33" y="112" width="50" height="50" /></g>
      <!-- Survey → loaded outbound / reverse discharge → excavator out/back → forward sand → excavator → pave → roll → cargo → scout. -->
      <g class="machine machine--scout" data-machine="scout">
        <JourneyVehicle kind="scout" :decal="appEmblem"/>
        <g transform="translate(18,53)" data-emitter="scout-rear-contact"><g class="mud-splash"><TerrainParticles material="mud" kind="spray" :count="18"/></g></g>
      </g>
      <g v-for="pass in [1, 2]" :key="`dump-${pass}`" class="machine machine--dump" :class="`machine--dump-${pass}`" :data-machine="`dump-${pass}`">
        <JourneyVehicle :kind="pass === 1 ? 'dump-tracked' : 'dump-wheeled'" :decal="appEmblem"/>
        <g class="sand-discharge"><g transform="translate(7,34)" data-emitter="dump-tail"><TerrainParticles material="sand" kind="fall" :count="24"/></g></g>
      </g>
      <g class="machine machine--excavator" data-machine="excavator">
        <JourneyVehicle kind="excavator" :decal="appEmblem"/>
        <g class="grading-dust" transform="translate(166,68)" data-emitter="bucket-contact">
          <TerrainParticles material="dust" kind="cloud" :count="10"/>
          <TerrainParticles material="sand" kind="spray" :count="8"/>
        </g>
      </g>
      <g class="machine machine--paver" data-machine="paver">
        <JourneyVehicle kind="paver" :decal="appEmblem"/>
        <g transform="translate(9,68)" data-emitter="screed-contact"><TerrainParticles material="dust" kind="cloud" :count="7"/></g>
        <path class="paver-heat" d="M8 50q-5-8 0-16t0-16m15 34q-4-9 0-17t0-13" stroke="#d5d8ba" fill="none" stroke-width="1" opacity=".18"/>
      </g>
      <g class="machine machine--roller" data-machine="roller"><JourneyVehicle kind="roller" :decal="appEmblem"/></g>
      <g class="machine machine--cargo" data-machine="cargo"><JourneyVehicle kind="cargo" :decal="appEmblem" label="RoadCraft Studio"/></g>
      <path d="M0 239H900" stroke="#d7b68c" opacity=".35" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import JourneyVehicle from './journey-vehicle.vue'
import TerrainParticles from './terrain-particles.vue'
import type { CompanyPaint } from '../../shared'
const props = defineProps<{ loop?: boolean; paint?: CompanyPaint }>()
const paintStyle = computed(() => props.paint ? Object.fromEntries(props.paint.colors.map((rgb,i) => [['--company-primary','--company-secondary','--company-accent'][i], `rgb(${rgb.join(',')})`])) : {})
const id = useId().replace(/:/g, '')
const appIcon = new URL('../../assets/app-icon.png', import.meta.url).href
const appEmblem = new URL('../../assets/app-emblem.png', import.meta.url).href
</script>

<style scoped>
.startup-journey { --journey-time:54s;--journey-repeat:1;width: 100%; overflow: hidden; border-radius: 18px; isolation: isolate; background: #132a38; }
.startup-journey--loop { --journey-repeat:infinite; }
svg { display: block; width: 100%; height: auto; }
.machine { opacity: 0; transform: translate(-240px, 140px); animation-duration: var(--journey-time); animation-timing-function: linear; animation-fill-mode: both; }
.startup-journey--loop .machine, .startup-journey--loop .road-progress, .startup-journey--loop .terrain-progress,
.startup-journey--loop .sand-discharge, .startup-journey--loop .mud-splash { animation-iteration-count: infinite; }
.machine--scout { animation-name: scout; }
.machine--dump-1 { animation-name: dump-first; }
.machine--dump-2 { animation-name: dump-second; }
.machine--excavator { animation-name: excavator; }
.machine--paver { animation-name: paver; }
.machine--roller { animation-name: roller; }
.machine--cargo { animation-name: cargo; }
.road-progress { transform: scaleX(0); transform-origin: 0 220px; animation-duration: var(--journey-time); animation-timing-function: linear; animation-fill-mode: both; }
.road-progress--sand-1 { transform-origin: 900px 220px; }
.road-progress--sand-1 { animation-name: sand-road-first; }
.road-progress--graded-1 { animation-name: graded-road-first; }
.road-progress--sand-2 { animation-name: sand-road-second; }
.road-progress--graded-2 { animation-name: graded-road-second; }
.road-progress--paved { animation-name: paved-road; }
.road-progress--rolled { animation-name: rolled-road; }
.machine :deep(.machine-body) { animation:suspension .7s ease-in-out infinite alternate; }
.machine--scout :deep(.machine-body) { animation:none; }
.machine :deep(.rolling-wheel), .machine :deep(.track-belt), .machine :deep(.track-roller), .machine :deep(.dump-bed), .machine :deep(.sand-load), .grading-dust {
  animation-duration:var(--journey-time);animation-timing-function:linear;animation-iteration-count:var(--journey-repeat);animation-fill-mode:both;
}
.machine--scout :deep(.rolling-wheel) { animation-name:scout-wheels; }
.machine--dump-2 :deep(.rolling-wheel) { animation-name:dump-wheels; }
.machine--roller :deep(.rolling-wheel) { animation-name:roller-wheels; }
.machine--cargo :deep(.rolling-wheel) { animation-name:cargo-wheels; }
.machine--dump-1 :deep(.track-belt) { animation-name:dump-track; }
.machine--dump-1 :deep(.track-roller) { animation-name:dump-track-rollers; }
.machine--excavator :deep(.track-belt) { animation-name:excavator-track; }
.machine--excavator :deep(.track-roller) { animation-name:excavator-rollers; }
.machine--paver :deep(.track-belt) { animation-name:paver-track; }
.machine--paver :deep(.track-roller) { animation-name:paver-rollers; }
.terrain-progress { transform-origin: 0 220px; animation: rough-road var(--journey-time) linear both; }
.machine :deep(.dump-bed) { transform-origin:7px 34px;animation-name:tip-bed; }
.machine :deep(.sand-load) { animation-name:sand-load; }
.sand-discharge { opacity:0;animation: discharge var(--journey-time) linear both; }
.mud-splash { opacity: 0; animation: mud-splash var(--journey-time) linear both; }
.grading-dust { opacity:0;animation-name:grading-dust; }
.paver-heat { animation:heat 1.7s ease-in-out infinite alternate; }
.logo-ring { transform-origin: 58px 137px; animation: spin 24s linear infinite; }
@keyframes scout {
  0% { opacity: 0; transform: translate(52px, 143px) scale(.1); }
  1.8% { opacity: 1; transform: translate(87px, 155px) scale(.75); }
  3% { transform: translate(162px, 156px) rotate(-9deg) scale(.75); }
  4% { transform: translate(230px, 132px) rotate(4deg) scale(.75); }
  5% { transform: translate(295px, 153px) rotate(9deg) scale(.75); }
  6% { transform: translate(359px, 166px) rotate(-3deg) scale(.75); }
  7% { transform: translate(432px, 157px) rotate(-6deg) scale(.75); }
  8% { transform: translate(503px, 139px) rotate(-8deg) scale(.75); }
  9% { transform: translate(572px, 139px) rotate(7deg) scale(.75); }
  10% { transform: translate(649px, 159px) rotate(1deg) scale(.75); }
  12%, 94.3% { opacity: 1; transform: translate(812px, 143px) scale(.75); }
  99.5% { opacity: 1; transform: translate(940px, 143px) scale(.75); }
  100% { opacity: 0; transform: translate(940px, 143px) scale(.75); }
}
/* The first truck leaves the portal loaded, then returns without changing heading. */
@keyframes dump-first {
  0%, 11.9% { opacity:0;transform:translate(52px,137px) scale(.1); }
  12% { opacity:1;transform:translate(52px,137px) scale(.1); }
  14% { transform:translate(105px,130px); }
  21%, 22% { opacity:1;transform:translate(940px,130px); }
  32% { opacity:1;transform:translate(52px,130px); }
  33% { opacity:0;transform:translate(52px,137px) scale(.1); }
  100% { opacity:0;transform:translate(52px,137px) scale(.1); }
}
@keyframes dump-second {
  0%, 51.9% { opacity:0;transform:translate(52px,137px) scale(.1); }
  52% { opacity:1;transform:translate(52px,137px) scale(.1); }
  54% { transform:translate(105px,130px); }
  63% { opacity:1;transform:translate(940px,130px); }
  63.1%, 100% { opacity:0;transform:translate(940px,130px); }
}
@keyframes excavator {
  0%, 34.9% { opacity:0;transform:translate(52px,137px) scale(.1); }
  35% { opacity:1;transform:translate(52px,137px) scale(.1); }
  37% { transform:translate(105px,134px); }
  44% { opacity:1;transform:translate(940px,134px); }
  49% { opacity:1;transform:translate(52px,134px); }
  50%, 64.9% { opacity:0;transform:translate(52px,137px) scale(.1); }
  65% { opacity:1;transform:translate(52px,137px) scale(.1); }
  67% { transform:translate(105px,134px); }
  75% { opacity:1;transform:translate(940px,134px); }
  75.1%, 100% { opacity:0;transform:translate(940px,134px); }
}
@keyframes paver { 0%, 76.9% { opacity:0;transform:translate(-180px,135px); } 77% { opacity:1;transform:translate(-180px,135px); } 83% { opacity:1;transform:translate(940px,135px); } 83.1%, 100% { opacity:0;transform:translate(940px,135px); } }
@keyframes roller { 0%, 84.9% { opacity:0;transform:translate(-150px,134px); } 85% { opacity:1;transform:translate(-150px,134px); } 90% { opacity:1;transform:translate(940px,134px); } 90.1%, 100% { opacity:0;transform:translate(940px,134px); } }
@keyframes cargo { 0%, 90.9% { opacity:0;transform:translate(-230px,137px); } 91% { opacity:1;transform:translate(-230px,137px); } 94% { opacity:1;transform:translate(940px,137px); } 94.1%, 100% { opacity:0;transform:translate(940px,137px); } }
/* The reveal edge follows each machine's discharge, blade, screed or drum. */
@keyframes rough-road { 0%, 22.3% { transform:scaleX(1); } 33%, 100% { transform:scaleX(0); } }
@keyframes sand-road-first { 0%, 22.3% { transform:scaleX(0); } 33%, 100% { transform:scaleX(1); } }
@keyframes graded-road-first { 0%, 35.1% { transform:scaleX(0); } 42.9%, 100% { transform:scaleX(1); } }
@keyframes sand-road-second { 0%, 52.1% { transform:scaleX(0); } 62.9%, 100% { transform:scaleX(1); } }
@keyframes graded-road-second { 0%, 65.1% { transform:scaleX(0); } 73.7%, 100% { transform:scaleX(1); } }
@keyframes paved-road { 0%, 78% { transform:scaleX(0); } 82.8%, 100% { transform:scaleX(1); } }
@keyframes rolled-road { 0%, 85.2% { transform:scaleX(0); } 89.4%, 100% { transform:scaleX(1); } }
@keyframes tip-bed { 0%, 22% { transform:rotate(0); } 23%, 31.5% { transform:rotate(-20deg); } 33%, 52% { transform:rotate(0); } 53%, 62% { transform:rotate(-20deg); } 63%, 100% { transform:rotate(0); } }
@keyframes discharge { 0%, 22% { opacity:0; } 22.3%, 32% { opacity:1; } 33%, 52% { opacity:0; } 52.3%, 62.9% { opacity:1; } 63%, 100% { opacity:0; } }
@keyframes mud-splash { 0%, 5.2% { opacity: 0; } 5.4%, 6.7% { opacity: .85; } 7%, 100% { opacity: 0; } }
@keyframes scout-wheels { 0% { transform: rotate(0); } 12%, 94.3% { transform: rotate(1440deg); } 99.5%, 100% { transform: rotate(1800deg); } }
/* Distance drives both tyres and belts; returning machines keep their heading. */
@keyframes dump-track { 0%,12% { stroke-dashoffset:0; } 21%,22% { stroke-dashoffset:-888; } 32%,100% { stroke-dashoffset:0; } }
@keyframes dump-track-rollers { 0%,12% { transform:rotate(0); } 21%,22% { transform:rotate(6000deg); } 32%,100% { transform:rotate(0); } }
@keyframes excavator-track { 0%,35% { stroke-dashoffset:0; } 44% { stroke-dashoffset:-888; } 49%,65% { stroke-dashoffset:0; } 75%,100% { stroke-dashoffset:-888; } }
@keyframes excavator-rollers { 0%,35% { transform:rotate(0); } 44% { transform:rotate(6000deg); } 49%,65% { transform:rotate(0); } 75%,100% { transform:rotate(6000deg); } }
@keyframes paver-track { 0%,77% { stroke-dashoffset:0; } 83%,100% { stroke-dashoffset:-1120; } }
@keyframes paver-rollers { 0%,77% { transform:rotate(0); } 83%,100% { transform:rotate(7550deg); } }
@keyframes dump-wheels { 0%,52% { transform:rotate(0); } 63%,100% { transform:rotate(3180deg); } }
@keyframes roller-wheels { 0%,85% { transform:rotate(0); } 90%,100% { transform:rotate(3900deg); } }
@keyframes cargo-wheels { 0%,91% { transform:rotate(0); } 94%,100% { transform:rotate(4190deg); } }
@keyframes sand-load { 0%,22% { opacity:1; } 32%,51.9% { opacity:0; } 52%,53% { opacity:1; } 63%,100% { opacity:0; } }
@keyframes grading-dust { 0%,36% { opacity:0; } 37%,43% { opacity:1; } 44%,66% { opacity:0; } 67%,74% { opacity:1; } 75%,100% { opacity:0; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes suspension { to { transform:translateY(.35px); } }
@keyframes heat { to { transform:translate(-2px,-4px);opacity:.05; } }
@media (prefers-reduced-motion: reduce) {
  .startup-journey :deep(*) { animation: none !important; }
  .road-progress { transform: scaleX(1); }
  .terrain-progress { transform: scaleX(0); }
  .machine--cargo { opacity: 1; transform: translate(483px, 137px); }
  .machine--scout { opacity: 1; transform: translate(812px, 143px) scale(.75); }
  .sand-discharge, .grading-dust, .mud-splash, .paver-heat { opacity:0; }
}
</style>
