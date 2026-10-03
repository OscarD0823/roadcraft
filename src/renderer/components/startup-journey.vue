<template>
  <div class="startup-journey" :class="{ 'startup-journey--loop': loop }" aria-hidden="true">
    <svg viewBox="0 0 900 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient :id="`${id}-sky`" x2="0" y2="1"><stop stop-color="#112739" /><stop offset="1" stop-color="#708781" /></linearGradient>
        <linearGradient :id="`${id}-steel`" x2="0" y2="1"><stop stop-color="#ffc477" /><stop offset="1" stop-color="#b55a29" /></linearGradient>
        <linearGradient :id="`${id}-road`" x2="0" y2="1"><stop stop-color="#485561" /><stop offset="1" stop-color="#25343f" /></linearGradient>
        <clipPath v-for="phase in ['sand', 'graded', 'paved', 'rolled']" :id="`${id}-${phase}`" :key="phase"><rect class="road-progress" :class="`road-progress--${phase}`" y="177" width="900" height="63" /></clipPath>
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
      <path d="M0 188q57-19 117 0t110-3 120 2 90-1 118 0 125-3 220 5V240H0Z" fill="#5a6255" />
      <path d="M0 210q62-12 124 0t124-2 133 3 142-1 135 2 242-2V240H0Z" fill="#6f6252" />
      <g :clip-path="`url(#${id}-sand)`"><path d="M0 203q30-14 61 0t61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 61 0 107 0V232H0Z" fill="#d1a56b" /><path d="M0 216H900" stroke="#ac794c" stroke-width="3" stroke-dasharray="2 9" /></g>
      <g :clip-path="`url(#${id}-graded)`"><path d="M0 205H900V233H0Z" fill="#c8a875" /><path d="M0 213H900M0 226H900" stroke="#91744f" stroke-width="2" opacity=".4" /></g>
      <g :clip-path="`url(#${id}-paved)`"><path d="M0 205H900V235H0Z" fill="#59615d" /><path d="M0 218H900" stroke="#85877a" stroke-width="18" stroke-dasharray="2 6" opacity=".18" /></g>
      <g :clip-path="`url(#${id}-rolled)`"><path d="M0 205H900V235H0Z" :fill="`url(#${id}-road)`" /><path d="M0 220H900" stroke="#e5cba3" stroke-width="2" stroke-dasharray="23 18" /><path d="M0 207H900M0 233H900" stroke="#9eaa9f" stroke-width="1" opacity=".5" /></g>
      <g class="journey-portal"><circle cx="58" cy="137" r="39" fill="#112c37" stroke="#d79951" opacity=".85" /><circle class="logo-ring" cx="58" cy="137" r="35" fill="none" stroke="#ffc176" stroke-dasharray="24 16" /><image :href="appIcon" x="33" y="112" width="50" height="50" /></g>
      <!-- Survey, sand, grade, pave, compact, delivery, then the scout departs. -->
      <g class="machine machine--scout" data-machine="scout">
        <ellipse cx="48" cy="51" rx="51" ry="5" fill="#10272e" opacity=".35" />
        <g class="machine-body"><path d="M2 20h21L36 0h34l16 20h14v22H2Z" fill="#d39a57" /><path d="M38 5h29l10 14H30Z" fill="#bfd5d0" /><path d="M52 5v15M10 27h77" stroke="#7d5e3e" stroke-width="2" /><rect x="86" y="24" width="12" height="6" rx="2" fill="#ffe9b7" /><path d="M5 3h20M38-3h32" stroke="#283d43" stroke-width="5" /></g>
        <g v-for="x in [22, 79]" :key="x" :transform="`translate(${x},40)`"><use class="rolling-wheel" :href="`#${id}-wheel`" /></g>
      </g>
      <g class="machine machine--dump" data-machine="dump">
        <ellipse cx="100" cy="72" rx="105" ry="6" fill="#10272e" opacity=".35" /><use :href="`#${id}-track`" x="3" y="47" /><use :href="`#${id}-track`" x="118" y="47" />
        <g class="machine-body"><path d="M8 37h177v18H8Z" fill="#253c44" /><g class="dump-bed"><path d="M4 6h109l-9 30H18Z" fill="#487489" stroke="#93b7b5" stroke-width="3" /><path d="M14 13h87M32 9v20M56 9v22M81 9v21" stroke="#244d62" stroke-width="3" /><path d="M15 5q32-14 77 0" fill="#d7ae75" /></g><path d="M136 0h43l20 21v28h-66Z" fill="#587f90" /><path d="M142 5h32l15 15h-47Z" fill="#c2d6d3" /><rect x="192" y="27" width="9" height="5" fill="#ffe4a4" /><path d="M116 35h22M143 0V-9h10" stroke="#394c52" stroke-width="5" /></g>
        <g class="sand-stream" fill="#e6b778"><circle v-for="(x, i) in [-4, -10, -16, -23, -29]" :key="x" :cx="x" :cy="30 + i * 7" :r="2 + i % 2" /></g>
      </g>
      <g class="machine machine--dozer" data-machine="dozer">
        <use :href="`#${id}-track`" x="10" y="43" /><g class="machine-body"><path d="M12 20h78v32H12Z" :fill="`url(#${id}-steel)`" /><path d="M26 19V-9h36v29" fill="#435c60" stroke="#d9aa64" stroke-width="4" /><path d="M34-4h22v19H34Z" fill="#b9d1ce" /><path d="M75 31 125 51M72 42l51 18" stroke="#5c7168" stroke-width="7" /><path d="M121 27q10 24 22 38l-29 4 2-43Z" fill="#dac18d" stroke="#9d744b" stroke-width="3" /></g><path class="dust" d="m145 64 12-9 17 13 12-7 14 9h-56" fill="#ddba83" opacity=".7" />
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
import { useId } from 'vue'
defineProps<{ loop?: boolean }>()
const id = useId().replace(/:/g, '')
const appIcon = new URL('../../assets/app-icon.png', import.meta.url).href
</script>

<style scoped>
.startup-journey { --journey-time: 28s; width: 100%; overflow: hidden; border-radius: 18px; isolation: isolate; background: #132a38; }
svg { display: block; width: 100%; height: auto; }
.machine { opacity: 0; transform: translate(-240px, 140px); animation-duration: var(--journey-time); animation-timing-function: linear; animation-fill-mode: both; }
.startup-journey--loop .machine, .startup-journey--loop .road-progress { animation-iteration-count: infinite; }
.machine--scout { animation-name: scout; }
.machine--dump { animation-name: dump; }
.machine--dozer { animation-name: dozer; }
.machine--paver { animation-name: paver; }
.machine--roller { animation-name: roller; }
.machine--cargo { animation-name: cargo; }
.road-progress { transform: scaleX(0); transform-origin: 0 220px; animation-duration: var(--journey-time); animation-timing-function: linear; animation-fill-mode: both; }
.road-progress--sand { animation-name: sand-road; }
.road-progress--graded { animation-name: graded-road; }
.road-progress--paved { animation-name: paved-road; }
.road-progress--rolled { animation-name: rolled-road; }
.rolling-wheel { animation: spin .8s linear infinite; transform-box: fill-box; transform-origin: center; }
.machine-body { animation: suspension .7s ease-in-out infinite alternate; }
.dump-bed { transform-origin: 7px 34px; transform: rotate(-12deg); }
.sand-stream { animation: sand .42s linear infinite; }
.dust { animation: sand .7s ease-out infinite; }
.logo-ring { transform-origin: 58px 137px; animation: spin 24s linear infinite; }
@keyframes scout { 0% { opacity: 0; transform: translate(52px, 153px) scale(.1); } 2% { opacity: 1; transform: translate(48px, 153px) scale(.6); } 10%, 89% { opacity: 1; transform: translate(773px, 143px) scale(.8); } 95% { opacity: 1; transform: translate(940px, 143px) scale(.8); } 100% { opacity: 0; transform: translate(940px, 143px) scale(.8); } }
@keyframes dump { 0%, 11% { opacity: 0; transform: translate(-230px, 139px); } 12% { opacity: 1; } 26% { opacity: 1; transform: translate(940px, 139px); } 26.1%, 100% { opacity: 0; transform: translate(940px, 139px); } }
@keyframes dozer { 0%, 27% { opacity: 0; transform: translate(-175px, 144px); } 28% { opacity: 1; } 42% { opacity: 1; transform: translate(940px, 144px); } 42.1%, 100% { opacity: 0; transform: translate(940px, 144px); } }
@keyframes paver { 0%, 43% { opacity: 0; transform: translate(-180px, 144px); } 44% { opacity: 1; } 58% { opacity: 1; transform: translate(940px, 144px); } 58.1%, 100% { opacity: 0; transform: translate(940px, 144px); } }
@keyframes roller { 0%, 59% { opacity: 0; transform: translate(-150px, 144px); } 60% { opacity: 1; } 74% { opacity: 1; transform: translate(940px, 144px); } 74.1%, 100% { opacity: 0; transform: translate(940px, 144px); } }
@keyframes cargo { 0%, 75% { opacity: 0; transform: translate(-230px, 149px); } 76% { opacity: 1; } 89% { opacity: 1; transform: translate(940px, 149px); } 89.1%, 100% { opacity: 0; transform: translate(940px, 149px); } }
@keyframes sand-road { 0%, 14% { transform: scaleX(0); } 25%, 100% { transform: scaleX(1); } }
@keyframes graded-road { 0%, 28% { transform: scaleX(0); } 40%, 100% { transform: scaleX(1); } }
@keyframes paved-road { 0%, 45% { transform: scaleX(0); } 57%, 100% { transform: scaleX(1); } }
@keyframes rolled-road { 0%, 61% { transform: scaleX(0); } 72%, 100% { transform: scaleX(1); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes suspension { to { transform: translateY(.8px); } }
@keyframes sand { from { opacity: .9; transform: translate(0, -4px); } to { opacity: 0; transform: translate(-9px, 7px); } }
@media (prefers-reduced-motion: reduce) {
  .startup-journey * { animation: none !important; }
  .road-progress { transform: scaleX(1); }
  .machine--cargo { opacity: 1; transform: translate(483px, 149px); }
  .machine--scout { opacity: 1; transform: translate(773px, 143px) scale(.8); }
  .sand-stream, .dust { opacity: 0; }
}
</style>
