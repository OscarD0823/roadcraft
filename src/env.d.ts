/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

declare module 'electron-squirrel-startup' {
  const squirrelStartup: boolean
  export default squirrelStartup
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

interface Window {
  roadcraft: import('./shared').RoadCraftApi
}
