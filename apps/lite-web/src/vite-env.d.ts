interface ImportMetaEnv {
  readonly VITE_LITE_GATEWAY_URL?: string;
  readonly VITE_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
