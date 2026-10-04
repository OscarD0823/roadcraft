<template>
  <div class="startup-journey" :class="{ 'startup-journey--loop': loop }" :data-paint="paint?.id ?? 'original'" :style="paintStyle" aria-hidden="true">
    <svg viewBox="0 0 900 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient :id="`${id}-sky`" x2="0" y2="1"><stop stop-color="#112739" /><stop offset="1" stop-color="#708781" /></linearGradient>
        <linearGradient :id="`${id}-steel`" x2="0" y2="1"><stop class="paint-primary" stop-color="#ffc477" /><stop class="paint-secondary" offset="1" stop-color="#b55a29" /></linearGradient>
        <linearGradient :id="`${id}-road`" x2="0" y2="1"><stop stop-color="#485561" /><stop offset="1" stop-color="#25343f" /></linearGradient>
        <clipPath :id="`${id}-rough`"><rect class="terrain-progress" y="170" width="900" height="70" /></clipPath>
        <clipPath v-for="phase in ['sand-1', 'graded-1', 'sand-2', 'graded-2', 'paved', 'rolled']" :id="`${id}-${phase}`" :key="phase"><rect class="road-progress" :class="`road-progress--${phase}`" y="177" width="900" height="63" /></clipPath>
        <g :id="`${id}-wheel`"><circle r="15" fill="#17232b" stroke="#68716b" stroke-width="3" /><circle r="7" fill="#d6b683" /><path d="M-11 0h22M0-11v22" stroke="#8d9389" stroke-width="2" /><circle r="3" fill="#3f4e52" /></g>
        <g :id="`${id}-track`"><rect width="100" height="28" rx="14" fill="#202e34" stroke="#7e8c80" stroke-width="3" stroke-dasharray="5 3" /><circle v-for="x in [15, 38, 62, 85]" :key="x" :cx="x" cy="14" r="8" fill="#687b73" stroke="#c4b291" stroke-width="2" /></g>
        <g :id="`${id}-cab`"><path d="M0 0h35l16 20v29H0Z" :fill="`url(#${id}-steel)`" /><path d="M6 5h25l10 14H6Z" fill="#b9d1ce" /><path d="M4 27h30M3 33h30" stroke="#754b34" stroke-width="2" /><rect x="42" y="26" width="7" height="5" rx="1" fill="#ffe8b0" /></g>
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
        <g class="terrain-mud"><path d="M330 205q57-12 130 0l-8 11q-62 11-124 0Z" fill="#392f29" /><path d="M346 208q43-5 92 1M364 216h59" fill="none" stroke="#8c7357" stroke-width="3" /><path d="m318 221 18 3m123-2 18-3" stroke="#3e3530" stroke-width="4" /></g>
        <path d="M25 217h125m25 5h87m224-2h45m135-4h126" stroke="#2e3e37" stroke-width="2" opacity=".4" />
      </g>
      <!-- Separate layers retain the first grading under the second sand delivery. -->
      <g v-for="pass in [1, 2]" :key="pass">
        <g :clip-path="`url(#${id}-sand-${pass})`"><path d="M0 203q30-14 61 0t61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 107 0V232H0Z" :fill="pass === 1 ? '#d1a56b' : '#e0b77e'" /><path d="M0 216H900" stroke="#ac794c" stroke-width="3" stroke-dasharray="2 9" /></g>
        <g :clip-path="`url(#${id}-graded-${pass})`"><path class="grade-clearance" d="M0 177H900V205H0Z" fill="#29494e" /><path d="M0 205H900V233H0Z" :fill="pass === 1 ? '#c8a875' : '#d6b581'" /><path d="M0 213H900M0 226H900" stroke="#91744f" stroke-width="2" opacity=".4" /></g>
      </g>
      <g :clip-path="`url(#${id}-paved)`"><path d="M0 205H900V235H0Z" fill="#59615d" /><path d="M0 218H900" stroke="#85877a" stroke-width="18" stroke-dasharray="2 6" opacity=".18" /></g>
      <g :clip-path="`url(#${id}-rolled)`"><path d="M0 205H900V235H0Z" :fill="`url(#${id}-road)`" /><path d="M0 220H900" stroke="#e5cba3" stroke-width="2" stroke-dasharray="23 18" /><path d="M0 207H900M0 233H900" stroke="#9eaa9f" stroke-width="1" opacity=".5" /></g>
      <path class="scout-shoulder" d="M794 205v-17q20-8 42-4h64v21Z" fill="#526957" /><path d="M804 187h96" stroke="#89917b" stroke-width="2" />
      <g class="journey-portal"><circle cx="58" cy="137" r="39" fill="#112c37" stroke="#d79951" opacity=".85" /><circle class="logo-ring" cx="58" cy="137" r="35" fill="none" stroke="#ffc176" stroke-dasharray="24 16" /><image :href="appIcon" x="33" y="112" width="50" height="50" /></g>
      <!-- Survey → loaded outbound / reverse discharge → excavator out/back → forward sand → excavator → pave → roll → cargo → scout. -->
      <g class="machine machine--scout" data-machine="scout">
        <ellipse cx="48" cy="51" rx="51" ry="5" fill="#10272e" opacity=".35" />
        <g class="machine-body"><path class="paint-primary" d="M2 20h21L36 0h34l16 20h14v22H2Z" fill="#d39a57" /><path class="paint-accent" d="M3 30h95v5H3Z" fill="#ae7442" /><path d="M38 5h29l10 14H30Z" fill="#bfd5d0" /><path d="M52 5v15M10 27h77" stroke="#7d5e3e" stroke-width="2" /><rect x="86" y="24" width="12" height="6" rx="2" fill="#ffe9b7" /><path d="M5 3h20M38-3h32" stroke="#283d43" stroke-width="5" /></g>
        <g v-for="x in [22, 79]" :key="x" :transform="`translate(${x},40)`"><use class="rolling-wheel" :href="`#${id}-wheel`" /></g>
        <g class="mud-splash" fill="#856347"><path d="M17 46 4 37l3 10-14-2 11 9-19 1 27 4Z" /><circle cx="-11" cy="39" r="3" /><circle cx="-22" cy="49" r="2" /></g>
      </g>
      <g v-for="pass in [1, 2]" :key="`dump-${pass}`" class="machine machine--dump" :class="`machine--dump-${pass}`" :data-machine="`dump-${pass}`">
        <ellipse cx="100" cy="72" rx="105" ry="6" fill="#10272e" opacity=".35" />
        <g v-if="pass === 1"><use :href="`#${id}-track`" x="3" y="47" /><use :href="`#${id}-track`" x="118" y="47" /></g>
        <g v-else><g v-for="x in [24, 63, 173]" :key="x" :transform="`translate(${x},60)`"><use class="rolling-wheel" :href="`#${id}-wheel`" /></g></g>
        <g class="machine-body"><path d="M8 37h177v18H8Z" fill="#253c44" /><g class="dump-bed"><path class="paint-secondary" d="M4 6h109l-9 30H18Z" :fill="pass === 1 ? '#487489' : '#a26e42'" stroke="#c1b899" stroke-width="3" /><path d="M14 13h87M32 9v20M56 9v22M81 9v21" stroke="#344c50" stroke-width="3" /><path d="M15 5q32-14 77 0" fill="#d7ae75" /></g><path class="paint-primary" d="M136 0h43l20 21v28h-66Z" :fill="pass === 1 ? '#587f90' : '#cf9558'" /><path class="paint-accent" d="M137 33h60v6h-60Z" fill="#839ba0" /><path d="M142 5h32l15 15h-47Z" fill="#c2d6d3" /><rect x="192" y="27" width="9" height="5" fill="#ffe4a4" /><path d="M116 35h22M143 0V-9h10" stroke="#394c52" stroke-width="5" /></g>
        <g class="sand-discharge"><g class="sand-stream" fill="#e6b778"><circle v-for="(x, i) in [-4, -10, -16, -23, -29]" :key="x" :cx="x" :cy="30 + i * 7" :r="2 + i % 2" /></g></g>
      </g>
      <g class="machine machine--excavator" data-machine="excavator">
        <ellipse cx="99" cy="70" rx="106" ry="5" fill="#10272e" opacity=".35" />
        <use :href="`#${id}-track`" x="13" y="43" /><use :href="`#${id}-track`" x="55" y="43" />
        <g class="machine-body"><path class="paint-primary" d="M15 22h83v29H15Z" :fill="`url(#${id}-steel)`" /><path class="paint-secondary" d="M55 27V-10h42v40Z" fill="#d49c58" /><path d="M62-4h29v24H62Z" fill="#bdd6d1" /><path d="M51-12h53M21 20V4h8" stroke="#293c44" stroke-width="5" /><path class="paint-primary-stroke excavator-arm" d="m99 25 22-45 30 23 24 41" fill="none" stroke="#d6a15c" stroke-width="11" stroke-linejoin="round" /><path d="m112 17 16-23m24 10 14 28" stroke="#ced1ba" stroke-width="3" /><circle cx="122" cy="-18" r="4" fill="#34484c" /><path class="paint-accent" d="M160 40h32l-2 27h-38l8-14Z" fill="#c6b18a" stroke="#68796f" stroke-width="3" /><path d="M28 28h22M28 35h22M88 37l59 15" stroke="#33494e" stroke-width="4" /></g>
        <path class="dust" d="m150 67 11-8 16 9 14-5 19 8h-67" fill="#ddba83" opacity=".7" />
      </g>
      <g class="machine machine--paver" data-machine="paver">
        <use :href="`#${id}-track`" x="35" y="43" /><g class="machine-body"><path d="M20 25h102v26H20Z" :fill="`url(#${id}-steel)`" /><path d="M72 26V-13M117 27V-13M60-14h70" stroke="#c9af79" stroke-width="5" /><path d="M86 12V0h16v12" fill="#213b46" /><path d="M120 11h39l-7 34h-34Z" fill="#d9a05a" stroke="#f2c983" stroke-width="3" /><path d="M2 52h45v16H2Z" fill="#384c50" /><path d="M14 39 26 52" stroke="#809287" stroke-width="6" /></g>
      </g>
      <g class="machine machine--roller" data-machine="roller">
        <g class="machine-body"><path d="M10 27h103v24H10Z" :fill="`url(#${id}-steel)`" /><path d="M51 27V-7h29v36" fill="#6e8b8b" stroke="#e1b56e" stroke-width="4" /><path d="M48-8h35" stroke="#e9c68b" stroke-width="5" /><path d="M54 0h22v21H54Z" fill="#c2d7d1" /></g><g transform="translate(26,51)"><use class="rolling-wheel" :href="`#${id}-wheel`" /></g><g transform="translate(101,50)"><circle r="21" fill="#798b86" stroke="#d3c6a5" stroke-width="3" /><circle class="rolling-wheel" r="11" fill="#566d70" stroke="#afb7a4" stroke-width="2" /><path d="M-6-12v24" stroke="#c9b889" stroke-width="3" /></g>
      </g>
      <g class="machine machine--cargo" data-machine="cargo">
        <ellipse cx="102" cy="65" rx="110" ry="5" fill="#10272e" opacity=".4" /><g class="machine-body"><path d="M7 40h201v17H7Z" fill="#2c3e45" /><use :href="`#${id}-cab`" x="156" y="5" /><path d="M9 4h132v37H9Z" fill="#203a48" stroke="#c7a375" stroke-width="2" /><path d="M15 9h120v27H15Z" fill="#142c3b" /><text x="75" y="26" fill="#f6dba9" font-family="Segoe UI, sans-serif" text-anchor="middle" font-size="11" font-weight="700">RoadCraft Studio</text><path d="M19 43V0M133 43V0" stroke="#9db0a5" stroke-width="4" /></g><g v-for="x in [28, 65, 179]" :key="x" :transform="`translate(${x},53)`"><use class="rolling-wheel" :href="`#${id}-wheel`" /></g>
      </g>
      <path d="M0 239H900" stroke="#d7b68c" opacity=".35" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import type { CompanyPaint } from '../../shared'
const props = defineProps<{ loop?: boolean; paint?: CompanyPaint }>()
const paintStyle = computed(() => props.paint ? Object.fromEntries(props.paint.colors.map((rgb,i) => [['--company-primary','--company-secondary','--company-accent'][i], `rgb(${rgb.join(',')})`])) : {})
const id = useId().replace(/:/g, '')
const appIcon = new URL('../../assets/app-icon.png', import.meta.url).href
</script>

<style scoped>
.startup-journey { --journey-time: 54s; width: 100%; overflow: hidden; border-radius: 18px; isolation: isolate; background: #132a38; }
.startup-journey:not([data-paint="original"]) .paint-primary { fill:var(--company-primary);stop-color:var(--company-primary); }
.startup-journey:not([data-paint="original"]) .paint-secondary { fill:var(--company-secondary);stop-color:var(--company-secondary); }
.startup-journey:not([data-paint="original"]) .paint-accent { fill:var(--company-accent); }
.startup-journey:not([data-paint="original"]) .paint-primary-stroke { stroke:var(--company-primary); }
svg { display: block; width: 100%; height: auto; }
.machine { opacity: 0; transform: translate(-240px, 140px); animation-duration: var(--journey-time); animation-timing-function: linear; animation-fill-mode: both; }
.startup-journey--loop .machine, .startup-journey--loop .road-progress, .startup-journey--loop .terrain-progress,
.startup-journey--loop .dump-bed, .startup-journey--loop .sand-discharge, .startup-journey--loop .mud-splash, .startup-journey--loop .machine--scout .rolling-wheel { animation-iteration-count: infinite; }
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
.rolling-wheel { animation: spin .8s linear infinite; transform-box: fill-box; transform-origin: center; }
.machine-body { animation: suspension .7s ease-in-out infinite alternate; }
.machine--scout .rolling-wheel { animation: scout-wheels var(--journey-time) linear both; }
.machine--scout .machine-body { animation: none; }
.terrain-progress { transform-origin: 0 220px; animation: rough-road var(--journey-time) linear both; }
.dump-bed { transform-origin: 7px 34px; animation: tip-bed var(--journey-time) linear both; }
.sand-discharge { opacity:0;animation: discharge var(--journey-time) linear both; }
.mud-splash { opacity: 0; animation: mud-splash var(--journey-time) linear both; }
.sand-stream { animation: sand .42s linear infinite; }
.dust { animation: sand .7s ease-out infinite; }
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
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes suspension { to { transform: translateY(.8px); } }
@keyframes sand { from { opacity: .9; transform: translate(0, -4px); } to { opacity: 0; transform: translate(-9px, 7px); } }
@media (prefers-reduced-motion: reduce) {
  .startup-journey * { animation: none !important; }
  .road-progress { transform: scaleX(1); }
  .terrain-progress { transform: scaleX(0); }
  .machine--cargo { opacity: 1; transform: translate(483px, 137px); }
  .machine--scout { opacity: 1; transform: translate(812px, 143px) scale(.75); }
  .sand-discharge, .sand-stream, .dust, .mud-splash { opacity: 0; }
}
</style>
