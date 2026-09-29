/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PUBLIC_URL?: string;
  readonly VITE_AUTH_COOKIE_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
