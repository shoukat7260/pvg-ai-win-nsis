/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PUBLIC_URL?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_WEB_ORIGIN?: string;
  readonly MODE?: string;
  readonly PROD?: boolean;
  readonly DEV?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
