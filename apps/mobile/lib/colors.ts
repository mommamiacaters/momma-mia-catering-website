// Canonical brand palette for places that take a raw color string rather than a
// NativeWind className — Stack.Screen header options, `Ionicons color`,
// `placeholderTextColor`, `ActivityIndicator color`, etc. Mirrors the Tailwind
// `brand-*` tokens in tailwind.config so className and prop colors stay in sync.
export const BRAND = {
  primary: '#E36A2E',
  cream: '#F4EBDD',
  secondary: '#F3E7D8',
  text: '#2E2A26',
  muted: '#6B6358',
  divider: '#D9CDBE',
  white: '#fff',
} as const;
