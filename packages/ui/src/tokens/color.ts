export const color = {
  background: '#f5f7f7',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  textPrimary: '#172321',
  textSecondary: '#465653',
  textMuted: '#6b7976',
  border: '#dbe2e0',
  borderStrong: '#aab8b4',
  brand: '#176b5b',
  brandHover: '#115548',
  success: '#18734b',
  warning: '#9a5b08',
  danger: '#b42318',
  info: '#1769aa'
} as const;
export type ColorToken = keyof typeof color;
