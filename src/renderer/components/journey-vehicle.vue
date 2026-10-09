<template>
  <g class="journey-vehicle" :class="`journey-vehicle--${kind}`" :data-vehicle-kind="kind">
    <defs>
      <linearGradient :id="`${id}-glass`" x2=".35" y2="1"><stop stop-color="#c3e3e5"/><stop offset=".32" stop-color="#527e91"/><stop offset="1" stop-color="#122737"/></linearGradient>
      <linearGradient :id="`${id}-metal`" x2="0" y2="1"><stop stop-color="#d9e1dc"/><stop offset=".35" stop-color="#72858b"/><stop offset=".6" stop-color="#293c45"/><stop offset="1" stop-color="#14242c"/></linearGradient>
      <linearGradient :id="`${id}-volume`" x2="0" y2="1"><stop stop-color="#fff2ce" stop-opacity=".36"/><stop offset=".37" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#061521" stop-opacity=".48"/></linearGradient>
      <linearGradient :id="`${id}-sand`" x2="0" y2="1"><stop stop-color="#f2d29a"/><stop offset="1" stop-color="#ab7646"/></linearGradient>
      <radialGradient :id="`${id}-rubber`" cx=".35" cy=".25"><stop stop-color="#4a5050"/><stop offset=".62" stop-color="#1c2529"/><stop offset="1" stop-color="#080f15"/></radialGradient>
      <radialGradient :id="`${id}-hub`" cx=".3" cy=".2"><stop stop-color="#9daaa6"/><stop offset=".7" stop-color="#394d59"/><stop offset="1" stop-color="#14232c"/></radialGradient>
      <g v-if="!['dump-tracked', 'excavator', 'paver'].includes(kind)" :id="`${id}-wheel`">
        <circle r="16" :fill="`url(#${id}-rubber)`" stroke="#090e14" stroke-width="2"/>
        <g class="rolling-wheel">
          <path v-for="n in 16" :key="n" :transform="`rotate(${n * 22.5})`" d="m-2-15 4-1 1 3-5 1Z" fill="#48514e" stroke="#101a20" stroke-width=".6"/>
          <circle r="9.4" fill="none" stroke="#c77934" stroke-width="1.6"/>
          <circle r="7.7" :fill="`url(#${id}-hub)`" stroke="#657570" stroke-width=".7"/>
          <circle v-for="n in 6" :key="n" :cx="Math.cos(n * Math.PI / 3) * 5.3" :cy="Math.sin(n * Math.PI / 3) * 5.3" r=".9" fill="#b9c5bc"/>
          <path d="M-5-1 0-4 5-1 3 4H-3Z" fill="#152632"/><circle r="2.2" fill="#7b8f91"/>
        </g>
        <path d="M-12-8a15 15 0 0 1 23 0" stroke="#c3cac0" stroke-width=".8" fill="none" opacity=".3"/>
      </g>
      <g v-if="['dump-tracked', 'excavator', 'paver'].includes(kind)" :id="`${id}-track`">
        <rect x="1" y="1" width="99" height="26" rx="13" fill="#142029" stroke="#111b22" stroke-width="4"/>
        <path class="track-belt" d="M14 1H87a13 13 0 0 1 0 26H14a13 13 0 0 1 0-26Z" fill="none" stroke="#728077" stroke-width="4" stroke-dasharray="3 3"/>
        <path d="M13 5H88M13 23H88" stroke="#354844" stroke-width="2"/>
        <g v-for="x in [15, 38, 62, 85]" :key="x" :transform="`translate(${x},14)`">
          <circle r="8.5" :fill="`url(#${id}-hub)`" stroke="#a28859" stroke-width="1.6"/>
          <g class="track-roller"><path d="M-6 0H6M0-6V6M-4-4l8 8" stroke="#728176" stroke-width="1.2"/><circle r="2.8" fill="#172932"/></g>
        </g>
        <path d="M15 0H85" stroke="#bdc3ad" stroke-width="1.2" opacity=".6"/>
      </g>
    </defs>

    <ellipse class="contact-shadow" :cx="kind === 'scout' ? 50 : kind === 'roller' ? 64 : 108" :cy="contactY" :rx="kind === 'scout' ? 50 : kind === 'roller' ? 65 : 110" ry="4.3" fill="#071719" opacity=".5"/>
    <!-- Body paint stays separate from highlights, glass, rubber and hydraulics. -->
    <g v-if="kind === 'expedition' || kind === 'cargo'" class="machine-body">
      <path d="M8 46H209V59H8Z" :fill="`url(#${id}-metal)`"/>
      <path class="paint-primary" d="M11 3h126v44H11Z"/><path class="paint-accent" d="M11 5h125v8H11Z"/>
      <path d="M11 3h126v44H11Z" :fill="`url(#${id}-volume)`" stroke="#0c202d" stroke-width="1.5"/>
      <template v-if="kind === 'expedition'">
        <rect x="19" y="19" width="25" height="14" rx="2" :fill="`url(#${id}-glass)`" stroke="#9baaa5" stroke-width="1.3"/>
        <path d="M101 16h26v29h-26Z" fill="#102532" stroke="#69868b" stroke-width="1.2"/><rect x="119" y="30" width="5" height="2" rx="1" fill="#b6bfba"/>
        <path d="M16 39h24v8H16m67-8h14v8H83" fill="#253944" stroke="#6c7e7b" stroke-width=".8"/>
        <image :href="decal" x="48" y="14" width="34" height="30"/>
        <path d="M18 0h110M23-6h104" stroke="#152e3b" stroke-width="4"/><path d="M23-6V0m24-6V0m26-6V0m27-6V0m25-6V0" stroke="#9faca1" stroke-width="1"/>
        <rect x="20" y="-15" width="72" height="8" rx="2" fill="#264350" stroke="#799591"/><rect x="101" y="-19" width="25" height="12" rx="2" fill="#e88e31" stroke="#522f1c"/>
        <path d="M110-19V-7m9-12V-7" stroke="#4e3d2a" stroke-width="2"/>
      </template>
      <template v-else>
        <path d="M22 7v35m28-35v35m28-35v35m29-35v35" stroke="#172c37" stroke-width="2"/>
        <image :href="decal" x="20" y="16" width="23" height="23"/>
      </template>
      <path class="paint-primary" d="M144 3h39l23 22v29h-63Z"/>
      <path d="M144 3h39l23 22v29h-63Z" :fill="`url(#${id}-volume)`" stroke="#0d2733" stroke-width="1.5"/>
      <path class="paint-accent" d="M144 3h39l9 9h-48Zm0 30h61v7h-61Z"/>
      <path d="M149 9h28v18h-28Zm31 1 17 17h-15Z" :fill="`url(#${id}-glass)`" stroke="#0a1c27" stroke-width="2"/>
      <path d="m151 10 4 15m29-12 11 12" stroke="#d9eee6" stroke-width="1" opacity=".55"/>
      <path d="M180 29v22m-29-17h7M201 31v12M139 5V-9h9" fill="none" stroke="#405665" stroke-width="2"/>
      <path d="M146 44h25v7h-25" fill="#213c4b"/><path d="M194 42h11" stroke="#849690" stroke-width="4"/>
      <rect x="195" y="31" width="8" height="5" rx="1" fill="#ffe4a8"/><path d="M202 50h14v7h-20" fill="#223845" stroke="#8f9d96" stroke-width="1.5"/>
      <path d="M145 54h24m-17 3h13" stroke="#9cafaa" stroke-width="2"/>
      <path d="M12 55q17-24 37 0m13 0q17-24 37 0m65 0q18-24 38 0" fill="none" stroke="#132d3e" stroke-width="6"/>
      <text x="75" :y="kind === 'cargo' ? 26 : 55" text-anchor="middle" fill="#e9eee1" font-family="Segoe UI, sans-serif" :font-size="kind === 'cargo' ? 9 : 5.5" font-weight="700">{{ label }}</text>
      <path d="M15 46h119" stroke="#c3d0be" stroke-width="1" opacity=".5"/>
    </g>

    <g v-else-if="kind === 'scout'" class="machine-body">
      <path class="paint-primary" d="M3 21h20L36 0h35l15 21h15v22H3Z"/>
      <path d="M3 21h20L36 0h35l15 21h15v22H3Z" :fill="`url(#${id}-volume)`" stroke="#253943" stroke-width="1.2"/>
      <path class="paint-accent" d="M4 29h95v5H4Z"/>
      <path d="M38 5h13v14H30Zm16 0h14l10 14H54Z" :fill="`url(#${id}-glass)`" stroke="#223942" stroke-width="1"/>
      <path d="M52 23V39m6-15h5M30 23v16" stroke="#172d3c" stroke-width="1"/>
      <path d="M29-3h44m-39-6h34" stroke="#283a43" stroke-width="3"/><rect x="42" y="-8" width="19" height="3" fill="#d5dac9"/>
      <image :href="decal" x="56" y="24" width="14" height="14"/>
      <path d="M6 44q16-21 33 0m22 0q16-21 33 0" stroke="#223743" stroke-width="5" fill="none"/>
      <path d="M84 23h16v5H84" fill="#ecddac"/><path d="M1 42h14m76 0h13M26 44h29" stroke="#8d9b8e" stroke-width="3"/>
    </g>

    <g v-else-if="kind.startsWith('dump')" class="machine-body">
      <path d="M8 37h187v18H8Z" :fill="`url(#${id}-metal)`"/>
      <path d="m21 38 80-5M117 42h21" stroke="#9baea7" stroke-width="3"/><path d="m55 38 41-8" stroke="#394c50" stroke-width="7"/>
      <g class="dump-bed">
        <path class="paint-secondary" d="M4 6h111l-10 30H17Z"/>
        <path d="M4 6h111l-10 30H17Z" :fill="`url(#${id}-volume)`" stroke="#9eac9f" stroke-width="1.5"/>
        <path d="M4 6h112M18 33h86" stroke="#d0d7c3" stroke-width="2"/>
        <path d="M28 10v20m23-20v20m24-20v20m23-20-3 20" stroke="#213c49" stroke-width="4"/>
        <path d="M29 10v19m24-19v19m24-19v19" stroke="#b6c2b1" stroke-width=".8" opacity=".6"/>
        <path class="sand-load" d="M12 5q15-8 32-4 14-12 30-4 11-2 29 8Z" :fill="`url(#${id}-sand)`" stroke="#ecd0a1" stroke-width=".7"/>
        <image :href="decal" x="77" y="13" width="16" height="16"/>
      </g>
      <path class="paint-primary" d="M136 0h43l21 21v28h-67Z"/>
      <path d="M136 0h43l21 21v28h-67Z" :fill="`url(#${id}-volume)`" stroke="#1b3442" stroke-width="1.6"/>
      <path class="paint-accent" d="M134 33h63v5h-63Z"/>
      <path d="M142 5h30v16h-30Zm33 1 16 15h-16Z" :fill="`url(#${id}-glass)`" stroke="#142b3a" stroke-width="1.5"/>
      <path d="M176 24v23m-29-20h7M131 2V-11h9" stroke="#3e535b" stroke-width="2" fill="none"/>
      <path d="M137 0h45m-42 48h21" stroke="#b7c5b5" stroke-width="2"/>
      <path d="M144 26h11M192 25v13" stroke="#254251" stroke-width="3"/>
      <path d="M128 47h75v9h-75" fill="#233e49"/><rect x="193" y="27" width="9" height="5" rx="1" fill="#ffe5a7"/>
      <path d="M197 47h13v8h-13" :fill="`url(#${id}-metal)`"/><path d="M139 57h20" stroke="#a7b7a9" stroke-width="2"/>
    </g>

    <g v-else-if="kind === 'excavator'" class="machine-body">
      <path class="paint-primary" d="M15 22h85v28H15Z"/><path d="M15 22h85v28H15Z" :fill="`url(#${id}-volume)`" stroke="#283e43" stroke-width="1.5"/>
      <path class="paint-secondary" d="M55 27V-10h42v40Z"/><path d="M62-4h13v24H62Zm16 0h13v24H78Z" :fill="`url(#${id}-glass)`" stroke="#203843" stroke-width="1.5"/>
      <path d="M51-12h53M21 20V4h8" stroke="#263a40" stroke-width="4" fill="none"/>
      <path d="M25 28h22m-22 5h22m-22 5h22m-22 5h22" stroke="#28444b" stroke-width="2"/>
      <image :href="decal" x="29" y="23" width="18" height="18"/>
      <path class="paint-primary-stroke excavator-arm" d="m99 25 22-45 30 23 24 41" fill="none" stroke-width="11" stroke-linejoin="round"/>
      <path d="m99 23 22-45 31 22 25 42" stroke="#f5d69d" stroke-width="1.2" fill="none"/>
      <path d="m102 22 15-29m32 11 17 28" stroke="#152d38" stroke-width="6"/><path d="m110 9 12-21m31 18 9 18" stroke="#c4ceca" stroke-width="3"/>
      <circle cx="122" cy="-18" r="4" :fill="`url(#${id}-hub)`"/>
      <path class="paint-accent" d="M160 40h32l-2 27h-38l8-14Z"/><path d="M160 40h32l-2 27h-38l8-14Z" :fill="`url(#${id}-volume)`" stroke="#72837b" stroke-width="2"/>
      <path d="M154 65h36m-29 0v4m10-4v4m10-4v4" stroke="#253e42" stroke-width="3"/>
    </g>

    <g v-else-if="kind === 'paver'" class="machine-body">
      <path class="paint-primary" d="M20 25h102v26H20Z"/><path d="M20 25h102v26H20Z" :fill="`url(#${id}-volume)`" stroke="#2d4648"/>
      <path d="M72 26V-13M117 27V-13" stroke="#485d60" stroke-width="3"/><path class="paint-secondary" d="M60-16h70v6H60Z"/>
      <path d="M86 12V0h16v12" fill="#182e3b"/><path d="M102 9h13" stroke="#71867a" stroke-width="2"/>
      <path class="paint-primary" d="M120 11h39l-7 34h-34Z"/><path d="M120 11h39l-7 34h-34Z" :fill="`url(#${id}-volume)`" stroke="#b8c0a4" stroke-width="1.5"/>
      <path d="M123 11h33l-3 7h-32" fill="#243e42"/><path d="M2 52h45v16H2Z" :fill="`url(#${id}-metal)`"/>
      <path d="M14 39 26 52" stroke="#809287" stroke-width="4"/><path d="M25 30h26m-26 6h26m-26 6h26" stroke="#2b4448" stroke-width="2"/>
      <image :href="decal" x="51" y="27" width="18" height="18"/>
    </g>

    <g v-else-if="kind === 'roller'" class="machine-body">
      <path class="paint-primary" d="M10 27h103v24H10Z"/><path d="M10 27h103v24H10Z" :fill="`url(#${id}-volume)`" stroke="#344e4c"/>
      <path class="paint-secondary" d="M49-7h34v36H49Z"/><path d="M54 0h22v21H54Z" :fill="`url(#${id}-glass)`" stroke="#213b41" stroke-width="2"/>
      <path d="M48-10h35m-70 42h25m-25 5h25" stroke="#415854" stroke-width="3"/>
      <image :href="decal" x="54" y="30" width="15" height="15"/>
      <path d="M78 34h25v15" stroke="#263e43" stroke-width="5" fill="none"/>
    </g>

    <g v-if="kind === 'dump-tracked'">
      <use :href="`#${id}-track`" x="3" y="47"/><use :href="`#${id}-track`" x="118" y="47"/>
    </g>
    <g v-else-if="kind === 'excavator'"><use :href="`#${id}-track`" x="13" y="43"/><use :href="`#${id}-track`" x="55" y="43"/></g>
    <use v-else-if="kind === 'paver'" :href="`#${id}-track`" x="35" y="43"/>
    <g v-else>
      <g v-for="x in wheels" :key="x" :transform="`translate(${x},${wheelY})`" :data-wheel-contact="`${x},${wheelY + 16}`">
        <use :href="`#${id}-wheel`"/>
      </g>
      <g v-if="kind === 'roller'" transform="translate(101,50)">
        <circle r="21" :fill="`url(#${id}-metal)`" stroke="#aab6a6" stroke-width="2"/>
        <g class="rolling-wheel"><circle r="11" :fill="`url(#${id}-hub)`" stroke="#bac3af"/><path d="M-9 0H9M0-9V9" stroke="#738c8b" stroke-width="1.5"/><circle r="3" fill="#233a42"/></g>
        <path d="M-15-13a20 20 0 0 1 29 0" stroke="#cfd4c1" stroke-width="1" fill="none" opacity=".5"/>
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
const props = defineProps<{
  kind: 'expedition' | 'cargo' | 'scout' | 'dump-tracked' | 'dump-wheeled' | 'excavator' | 'paver' | 'roller'
  decal: string
  label?: string
}>()
const id = useId().replace(/:/g, '')
const wheels = computed(() => props.kind === 'scout' ? [22,79] : props.kind === 'roller' ? [26] : props.kind === 'dump-wheeled' ? [24,63,173] : [30,81,183])
const wheelY = computed(() => props.kind === 'scout' ? 40 : props.kind === 'roller' ? 51 : props.kind === 'cargo' ? 53 : 60)
const contactY = computed(() => props.kind === 'scout' ? 56 : props.kind === 'cargo' ? 69 : ['roller','excavator','paver'].includes(props.kind) ? 71 : 76)
</script>

<style scoped>
.journey-vehicle { --vehicle-primary:#e5a640;--vehicle-secondary:#bd7e2e;--vehicle-accent:#ecd298; }
.journey-vehicle--expedition { --vehicle-primary:#173c56;--vehicle-secondary:#22465c;--vehicle-accent:#f58c2e; }
.journey-vehicle--cargo { --vehicle-primary:#284b5a;--vehicle-secondary:#305463;--vehicle-accent:#eda343; }
.journey-vehicle--scout { --vehicle-primary:#c3944d;--vehicle-secondary:#59696a;--vehicle-accent:#e5c780; }
.journey-vehicle--dump-tracked { --vehicle-primary:#4f7889;--vehicle-secondary:#3b657c;--vehicle-accent:#e3b465; }
.paint-primary { fill:var(--company-primary,var(--vehicle-primary)); }
.paint-secondary { fill:var(--company-secondary,var(--vehicle-secondary)); }
.paint-accent { fill:var(--company-accent,var(--vehicle-accent)); }
.paint-primary-stroke { stroke:var(--company-primary,var(--vehicle-primary)); }
.rolling-wheel, .track-roller { transform-box:fill-box;transform-origin:center; }
@media (prefers-reduced-motion:reduce) { * { animation:none !important; } }
</style>
