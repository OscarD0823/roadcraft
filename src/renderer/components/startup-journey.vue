<template>
  <div class="startup-journey" :class="{ 'startup-journey--loop': loop }" aria-hidden="true">
    <svg viewBox="0 0 900 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient :id="`${id}-sky`" x2="0" y2="1">
          <stop stop-color="#101f2d" /><stop offset=".7" stop-color="#33525e" /><stop offset="1" stop-color="#d29b68" />
        </linearGradient>
        <linearGradient :id="`${id}-paint`" x2="0" y2="1">
          <stop stop-color="#ffc778" /><stop offset=".5" stop-color="#d56b29" /><stop offset="1" stop-color="#86452b" />
        </linearGradient>
        <linearGradient :id="`${id}-beam`"><stop stop-color="#fff3cd" stop-opacity=".4" /><stop offset="1" stop-color="#fff3cd" stop-opacity="0" /></linearGradient>
      </defs>
      <rect width="900" height="240" rx="18" :fill="`url(#${id}-sky)`" />
      <circle class="journey-sun" cx="696" cy="85" r="34" fill="#f2bc80" opacity=".32" />
      <g class="journey-mountains">
        <path d="M0 131 94 46 148 92 245 14 359 107 433 53 573 136 687 37 784 109 854 60 900 109V220H0Z" fill="#73929b" opacity=".4" />
        <path d="m198 62 47-48 48 50-31-9-17 11-13-16zM649 74l38-37 38 36-26-6-12 11-10-16zM65 73l29-27 31 30-21-6-10 9-9-13z" fill="#9ca8a4" opacity=".74" />
        <path d="M0 151 92 119 192 143 296 96 427 151 543 104 659 146 788 105 900 143V230H0Z" fill="#253f48" />
      </g>
      <g fill="#152d31" opacity=".85">
        <path v-for="(x, i) of [8, 25, 143, 165, 290, 309, 542, 565, 785, 809, 861, 879]" :key="x" :transform="`translate(${x},${i % 3 * 6 + 107})`" d="M0 50h8V29h15L5-11-13 29H0Z" />
      </g>
      <!-- Tres terrenos reconocibles, con relieve y huellas propias. -->
      <path d="M0 183q81-33 168-9t121-5q68-50 134-13t116 20q90 35 169 4t192-10V240H0Z" fill="#283e3d" />
      <path d="M0 197q89-36 182-7t122-18l-31 47H0Z" fill="#7c807a" />
      <path d="M0 207q106-38 203-10l-19 11q-88-24-184 13Z" fill="#b29b72" opacity=".6" />
      <path d="m315 185 34-36 26 2 25 21 31-8 25 31-16 19-145 3Z" fill="#62716d" />
      <path d="m349 149 26 2 25 21-29-7-15 13-20-4Z" fill="#9ca69a" />
      <path d="M474 206q96-39 194-12t119 13l-27 25H471Z" fill="#583d2d" />
      <path class="journey-mud" d="M521 211q76-27 137-10t74 9q-70 25-211 1Z" fill="#957257" opacity=".75" />
      <path d="M752 229q90-37 148-28V240H752Z" fill="#1c3031" />
      <path d="M762 235q59-25 133-27" fill="none" stroke="#b9976a" stroke-width="3" stroke-dasharray="10 7" opacity=".38" />
      <!-- El logo es el punto de salida; el camión lleva el nombre como carga. -->
      <g class="journey-portal">
        <circle cx="72" cy="125" r="47" fill="#10202b" stroke="#ef9a48" stroke-width="1" opacity=".8" />
        <circle class="journey-logo-ring" cx="72" cy="125" r="44" fill="none" stroke="#ffb35d" stroke-width="2" stroke-dasharray="32 16" />
        <image :href="appIcon" x="39" y="92" width="66" height="66" />
      </g>
      <g class="journey-convoy">
        <ellipse cx="110" cy="75" rx="106" ry="10" fill="#081718" opacity=".42" />
        <g class="journey-body">
          <path d="m215 48 114-20v55L215 60Z" :fill="`url(#${id}-beam)`" />
          <path d="M13 48h193v16H13Z" fill="#26323a" />
          <path d="M145 11h42l23 26v19h-66Z" :fill="`url(#${id}-paint)`" />
          <path d="M152 16h31l13 18h-44Z" fill="#adc5c5" /><path d="m175 16 8 18h13l-13-18Z" fill="#d8e7dd" opacity=".6" />
          <path d="M17 19h116v30H17Z" fill="#594e40" stroke="#a89167" stroke-width="2" />
          <path d="M24 23h101v22H24Z" fill="#142530" />
          <text x="74" y="37" text-anchor="middle" fill="#f7e5c5" font-family="Segoe UI, sans-serif" font-size="11" font-weight="700">RoadCraft Studio</text>
          <path d="M28 49V15M123 49V15M137 47h9M200 55h17v8h-20" fill="none" stroke="#a6b1a6" stroke-width="4" />
          <path d="M140 17V1h10" fill="none" stroke="#3c4a4d" stroke-width="5" />
          <rect x="199" y="40" width="9" height="5" rx="1" fill="#ffe1a0" />
          <rect x="155" y="39" width="7" height="2" rx="1" fill="#f2c385" />
          <path d="M20 56q19-18 37 0M65 56q19-18 37 0M165 56q19-18 37 0" fill="none" stroke="#22313a" stroke-width="8" />
        </g>
        <g v-for="x of [39, 84, 183]" :key="x" :transform="`translate(${x},62)`">
          <g class="journey-wheel">
            <circle r="18" fill="#121c21" stroke="#425456" stroke-width="3" />
            <circle r="9" fill="#b4b8aa" stroke="#526365" stroke-width="2" />
            <path d="M-16 0h32M0-16v32M-11-11l22 22M-11 11l22-22" stroke="#647170" stroke-width="2" />
            <circle r="4" fill="#293b43" />
          </g>
        </g>
        <g class="journey-spray" fill="#c6a075">
          <circle cx="11" cy="68" r="3" /><circle cx="2" cy="60" r="2" /><circle cx="-9" cy="64" r="3" /><circle cx="-18" cy="51" r="2" />
        </g>
      </g>
      <g class="journey-snow" fill="#dce8e2" opacity=".6">
        <circle v-for="x of [32, 116, 187, 265, 368, 436, 583, 658, 740, 816, 866]" :key="x" :cx="x" :cy="(x * 7) % 130 + 15" r="1.5" />
      </g>
      <path d="M0 239H900" stroke="#ecb774" stroke-opacity=".35" />
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
.startup-journey { width: 100%; overflow: hidden; border-radius: 18px; isolation: isolate; background: #13242e; }
svg { display: block; width: 100%; height: auto; }
.journey-convoy { transform-origin: 0 0; animation: journey-drive 9s cubic-bezier(.3, .05, .35, 1) both; }
.journey-body { animation: journey-suspension .65s ease-in-out 12 alternate; }
.journey-wheel { animation: journey-roll .72s linear 12; }
.journey-portal { animation: journey-launch 3s ease-out both; }
.journey-logo-ring { transform-origin: 72px 125px; animation: journey-roll 6s linear infinite; }
.journey-spray { animation: journey-spray .5s ease-out 18; }
.journey-snow { animation: journey-snow 7s linear infinite; }
.journey-mud { animation: journey-water 4s ease-in-out infinite alternate; }
.startup-journey--loop .journey-convoy { animation: journey-drive 12s cubic-bezier(.3, .05, .35, 1) infinite; }
.startup-journey--loop .journey-wheel, .startup-journey--loop .journey-body, .startup-journey--loop .journey-spray { animation-iteration-count: infinite; }
@keyframes journey-drive {
  0% { opacity: 0; transform: translate(64px, 143px) scale(.04); }
  8% { opacity: 1; transform: translate(74px, 135px) scale(.38); }
  18% { transform: translate(150px, 111px) scale(1); }
  35% { transform: translate(265px, 104px) rotate(-7deg); }
  46% { transform: translate(342px, 91px) rotate(4deg); }
  60% { transform: translate(460px, 118px) rotate(1deg); }
  76% { transform: translate(586px, 125px) rotate(-2deg); }
  90%, 100% { opacity: 1; transform: translate(637px, 125px); }
}
@keyframes journey-roll { to { transform: rotate(360deg); } }
@keyframes journey-suspension { to { transform: translateY(1.5px) rotate(.25deg); } }
@keyframes journey-launch { 30% { filter: drop-shadow(0 0 14px #ffab53); } 100% { opacity: .75; } }
@keyframes journey-snow { from { transform: translateY(-8px); } to { transform: translate(16px, 14px); } }
@keyframes journey-spray { from { opacity: .9; transform: translate(7px, -3px) scale(.8); } to { opacity: 0; transform: translate(-14px, 7px) scale(1.2); } }
@keyframes journey-water { to { opacity: .45; } }
@media (prefers-reduced-motion: reduce) {
  .startup-journey * { animation: none !important; }
  .journey-convoy { transform: translate(637px, 125px); }
  .journey-spray { opacity: 0; }
}
</style>
