/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DATA_MODE?: string;
  readonly VITE_CUTOVER_AUTH?: string;
  readonly VITE_CUTOVER_CLIENTS?: string;
  readonly VITE_CUTOVER_STAFF?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
